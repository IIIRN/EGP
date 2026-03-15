"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    CheckCircle,
    Edit,
    FileSearch,
    FileText,
    Loader2,
    Trash2,
    XCircle,
} from "lucide-react";
import {
    Timestamp,
    collection,
    doc,
    getDocs,
    limit,
    query,
    serverTimestamp,
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
    finalizePriceComparisonApprovalTrail,
    getPriceComparisonDecisionStatus,
    getPriceComparisonStatusMeta,
    getRecommendationTypeLabel,
    isPriceComparisonPendingApproval,
} from "@/lib/priceComparison";
import {
    canConvertPurchaseRequisition,
    getPurchaseRequisitionPrimaryLinkedTargetId,
    getPurchaseRequisitionStatusMeta,
} from "@/lib/purchaseRequisition";
import {
    ApprovalTrailTable,
    DocumentStatus,
    QuoteItemsTable,
    QuoteTotalsGrid,
    formatDocumentDate,
    formatMoney,
    getFulfillmentTypeLabel,
    getSelectedQuote,
    getVatModeLabel,
} from "@/components/price-comparison/PriceComparisonDocument";
import { usePriceComparisonRecord } from "@/components/price-comparison/usePriceComparisonRecord";
import type { PriceComparison } from "@/types/priceComparison";

type FirestoreTimestampLike = {
    toDate?: () => Date;
    seconds?: number;
};

function getCreatedAtMillis(value: unknown) {
    if (!value || typeof value !== "object") return 0;
    const timestamp = value as FirestoreTimestampLike;
    if (typeof timestamp.toDate === "function") return timestamp.toDate().getTime();
    if (typeof timestamp.seconds === "number") return timestamp.seconds * 1000;
    return 0;
}

export default function PriceComparisonDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { userProfile } = useAuth();
    const { comparison, sourceRequisition, loading, missing } = usePriceComparisonRecord(resolvedParams.id);

    const [actionLoading, setActionLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (missing) {
            router.push("/price-comparisons");
        }
    }, [missing, router]);

    const handleDecision = async (decision: "approved" | "rejected") => {
        if (!comparison || !userProfile) return;

        const confirmed = window.confirm(
            decision === "approved"
                ? "ยืนยันอนุมัติผลเทียบราคาใช่หรือไม่?"
                : "ยืนยันไม่อนุมัติผลเทียบราคาใช่หรือไม่?"
        );
        if (!confirmed) return;

        setActionLoading(true);
        try {
            const nextStatus = getPriceComparisonDecisionStatus(decision);
            const nextTrail = finalizePriceComparisonApprovalTrail({
                currentTrail: comparison.approvalTrail,
                decision,
                approverUid: userProfile.uid,
                approverName: userProfile.displayName || userProfile.email || userProfile.uid,
                role: userProfile.role,
                actionAt: Timestamp.now(),
            });

            await updateDoc(doc(db, "pr_price_comparisons", comparison.id), {
                status: nextStatus,
                approvalTrail: nextTrail,
                updatedAt: serverTimestamp(),
            });

            await updateDoc(doc(db, "purchase_requisitions", comparison.prId), {
                currentComparisonId: comparison.id,
                selectedComparisonId: decision === "approved" ? comparison.id : "",
                selectedSupplierType: decision === "approved" ? comparison.recommendedSupplierType || "" : "",
                selectedSupplierId: decision === "approved" ? comparison.recommendedSupplierId || "" : "",
                status: decision === "approved" ? "selected" : "comparing",
                updatedAt: serverTimestamp(),
            });

            if (decision === "approved") {
                try {
                    await fetch("/api/line/notify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "PC",
                            data: {
                                ...comparison,
                                status: nextStatus,
                                approvalTrail: nextTrail,
                            },
                        }),
                    });
                } catch (error) {
                    console.error("Comparison approval notification failed:", error);
                }
            }
        } catch (error) {
            console.error("Error updating price comparison status:", error);
            alert("ไม่สามารถอัปเดตสถานะเอกสารเทียบราคาได้");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!comparison) return;

        const confirmed = window.confirm(`ยืนยันลบเอกสารเทียบราคา ${comparison.comparisonNumber} ใช่หรือไม่?`);
        if (!confirmed) return;

        setDeleting(true);
        try {
            const [linkedPoSnapshot, linkedWcSnapshot, comparisonSnapshot] = await Promise.all([
                getDocs(query(collection(db, "purchase_orders"), where("sourceComparisonId", "==", comparison.id), limit(1))),
                getDocs(query(collection(db, "work_contracts"), where("sourceComparisonId", "==", comparison.id), limit(1))),
                getDocs(query(collection(db, "pr_price_comparisons"), where("prId", "==", comparison.prId))),
            ]);

            if (!linkedPoSnapshot.empty || !linkedWcSnapshot.empty) {
                alert("ลบเอกสารเทียบราคาไม่ได้ เพราะมี PO/WC อ้างอิงเอกสารนี้แล้ว");
                setDeleting(false);
                return;
            }

            const remainingComparisons = comparisonSnapshot.docs
                .filter((docSnap) => docSnap.id !== comparison.id)
                .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as PriceComparison))
                .sort((left, right) => getCreatedAtMillis(right.createdAt) - getCreatedAtMillis(left.createdAt));

            const batch = writeBatch(db);
            batch.delete(doc(db, "pr_price_comparisons", comparison.id));

            if (sourceRequisition) {
                const selectedStillExists = Boolean(
                    sourceRequisition.selectedComparisonId &&
                    sourceRequisition.selectedComparisonId !== comparison.id &&
                    remainingComparisons.some((item) => item.id === sourceRequisition.selectedComparisonId)
                );
                const currentStillExists = Boolean(
                    sourceRequisition.currentComparisonId &&
                    sourceRequisition.currentComparisonId !== comparison.id &&
                    remainingComparisons.some((item) => item.id === sourceRequisition.currentComparisonId)
                );
                const nextSelectedComparisonId = selectedStillExists ? sourceRequisition.selectedComparisonId || "" : "";
                const nextCurrentComparisonId = nextSelectedComparisonId
                    || (currentStillExists ? sourceRequisition.currentComparisonId || "" : "")
                    || remainingComparisons[0]?.id
                    || "";
                const hasPendingApproval = remainingComparisons.some((item) => item.status === "pending_approval");
                const hasRemainingComparisons = remainingComparisons.length > 0;
                const hasLinkedDocuments = Boolean(
                    (Array.isArray(sourceRequisition.linkedPoIds) && sourceRequisition.linkedPoIds.filter(Boolean).length > 0) ||
                    (Array.isArray(sourceRequisition.linkedWcIds) && sourceRequisition.linkedWcIds.filter(Boolean).length > 0)
                );

                const nextStatus = nextSelectedComparisonId
                    ? (hasLinkedDocuments ? sourceRequisition.status : "selected")
                    : hasPendingApproval
                        ? "selection_pending"
                        : hasRemainingComparisons
                            ? "comparing"
                            : "approved_for_sourcing";

                batch.update(doc(db, "purchase_requisitions", comparison.prId), {
                    currentComparisonId: nextCurrentComparisonId,
                    selectedComparisonId: nextSelectedComparisonId,
                    selectedSupplierType: nextSelectedComparisonId ? sourceRequisition.selectedSupplierType || "" : "",
                    selectedSupplierId: nextSelectedComparisonId ? sourceRequisition.selectedSupplierId || "" : "",
                    status: nextStatus,
                    updatedAt: serverTimestamp(),
                });
            }

            await batch.commit();
            router.push("/price-comparisons");
        } catch (error) {
            console.error("Error deleting price comparison:", error);
            alert("ลบเอกสารเทียบราคาไม่สำเร็จ");
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-slate-500">กำลังโหลดข้อมูลเอกสารเทียบราคา...</p>
            </div>
        );
    }

    if (!comparison) return null;

    const statusMeta = getPriceComparisonStatusMeta(comparison.status);
    const isPending = isPriceComparisonPendingApproval(comparison.status);
    const canApprove = userProfile?.role === "admin" || userProfile?.role === "pm";
    const canDelete = Boolean(
        userProfile?.role === "admin" ||
        userProfile?.role === "pm" ||
        userProfile?.role === "procurement" ||
        userProfile?.uid === comparison.createdBy
    );
    const recommendedQuote = getSelectedQuote(comparison);
    const linkedTargetId = sourceRequisition ? getPurchaseRequisitionPrimaryLinkedTargetId(sourceRequisition) : "";
    const targetDocumentLabel = comparison.fulfillmentType === "po" ? "PO" : "WC";
    const targetDetailHref = linkedTargetId ? `${comparison.fulfillmentType === "po" ? "/po" : "/wc"}/${linkedTargetId}` : "";
    const canCreateTargetDocument = comparison.status === "approved"
        && Boolean(sourceRequisition)
        && canConvertPurchaseRequisition(sourceRequisition?.status)
        && !linkedTargetId;
    const targetCreateHref = canCreateTargetDocument
        ? `${comparison.fulfillmentType === "po" ? "/po/create" : "/wc/create"}?prId=${comparison.prId}&comparisonId=${comparison.id}`
        : "";
    const recommendedQuoteId = comparison.recommendedQuoteId || comparison.autoRecommendedQuoteId || "";

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/price-comparisons" className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">ข้อมูลเอกสารเทียบราคา</h1>
                        <p className="mt-1 text-sm text-slate-500">{comparison.comparisonNumber} • PR {comparison.prNumber || "-"}</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <Link href={`/price-comparisons/${comparison.id}/document`} className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                        <FileText size={16} className="mr-2" />
                        ดูแบบเอกสาร
                    </Link>
                    {(comparison.status === "draft" || comparison.status === "rejected") ? (
                        <Link href={`/price-comparisons/${comparison.id}/edit`} className="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100">
                            <Edit size={16} className="mr-2" />
                            แก้ไขเอกสาร
                        </Link>
                    ) : null}
                    {canDelete ? (
                        <button type="button" onClick={() => void handleDelete()} disabled={deleting} className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50">
                            {deleting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Trash2 size={16} className="mr-2" />}
                            ลบเอกสาร
                        </button>
                    ) : null}
                    {targetDetailHref ? (
                        <Link href={targetDetailHref} className="inline-flex items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100">
                            <FileSearch size={16} className="mr-2" />
                            ดู{targetDocumentLabel}ที่สร้างแล้ว
                        </Link>
                    ) : null}
                    {targetCreateHref ? (
                        <Link href={targetCreateHref} className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500">
                            <FileSearch size={16} className="mr-2" />
                            ออก{targetDocumentLabel}
                        </Link>
                    ) : null}
                    {isPending && canApprove ? (
                        <>
                            <button type="button" onClick={() => void handleDecision("rejected")} disabled={actionLoading} className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50">
                                <XCircle size={16} className="mr-2" />
                                ไม่อนุมัติ
                            </button>
                            <button type="button" onClick={() => void handleDecision("approved")} disabled={actionLoading} className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50">
                                {actionLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CheckCircle size={16} className="mr-2" />}
                                อนุมัติผลเทียบราคา
                            </button>
                        </>
                    ) : null}
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">สถานะ</p>
                    <div className="mt-2">
                        <DocumentStatus label={statusMeta.label} />
                    </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">ผู้เสนอที่เลือก</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{comparison.recommendedSupplierName || "-"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">มูลค่าที่เลือก</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{formatMoney(Number(comparison.recommendedTotalAmount || 0))}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">เกณฑ์การตัดสิน</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{getRecommendationTypeLabel(comparison.recommendationType)}</p>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.62fr,0.38fr]">
                <div className="space-y-6">
                    <section className="rounded-xl border border-slate-200 bg-white p-5">
                        <h2 className="text-base font-semibold text-slate-950">ข้อมูลเอกสาร</h2>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                <span className="text-slate-500">เลขที่เอกสาร</span>
                                <p className="mt-1 font-semibold text-slate-950">{comparison.comparisonNumber}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                <span className="text-slate-500">PR ต้นทาง</span>
                                <p className="mt-1 font-semibold text-slate-950">{comparison.prNumber || "-"}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                <span className="text-slate-500">ผู้ขอ</span>
                                <p className="mt-1 font-semibold text-slate-950">{comparison.requestedByName || comparison.requestedByUid || "-"}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                <span className="text-slate-500">วันที่จัดทำ</span>
                                <p className="mt-1 font-semibold text-slate-950">{formatDocumentDate(comparison.createdAt)}</p>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-5">
                        <h2 className="text-base font-semibold text-slate-950">ข้อมูลอ้างอิงจาก PR</h2>
                        <div className="mt-4 space-y-4">
                            <div>
                                <p className="text-sm font-semibold text-slate-950">{comparison.title}</p>
                                {sourceRequisition?.reason ? (
                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{sourceRequisition.reason}</p>
                                ) : null}
                            </div>
                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                    <span className="text-slate-500">ประเภทคำขอ</span>
                                    <p className="mt-1 font-semibold text-slate-950">{comparison.requestType === "service" ? "ขอจ้าง / ขอรับบริการ" : "ขอซื้อวัสดุ"}</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                    <span className="text-slate-500">เอกสารปลายทาง</span>
                                    <p className="mt-1 font-semibold text-slate-950">{getFulfillmentTypeLabel(comparison.fulfillmentType)}</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                    <span className="text-slate-500">งบประมาณอ้างอิง</span>
                                    <p className="mt-1 font-semibold text-slate-950">{formatMoney(Number(sourceRequisition?.totalAmount || 0))}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-5">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-slate-950">ข้อมูลผู้เสนอราคา</h2>
                                <p className="mt-1 text-sm text-slate-500">หน้าข้อมูลใช้สำหรับตรวจสอบรายละเอียดเชิงลึก ส่วนเอกสารทางการอยู่ที่หน้าแบบเอกสาร</p>
                            </div>
                            <Link href={`/price-comparisons/${comparison.id}/document`} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                                เปิดแบบเอกสาร
                            </Link>
                        </div>

                        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-100">
                                        <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                                            <th className="px-4 py-3">ผู้เสนอราคา</th>
                                            <th className="px-4 py-3">อ้างอิง</th>
                                            <th className="px-4 py-3">เครดิต</th>
                                            <th className="px-4 py-3">ส่งมอบ</th>
                                            <th className="px-4 py-3 text-right">รวม</th>
                                            <th className="px-4 py-3 text-center">Rank</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {comparison.quotes.map((quote) => (
                                            <tr key={quote.id}>
                                                <td className="px-4 py-3 text-sm text-slate-900">
                                                    {quote.supplierName || "-"}
                                                    {quote.id === recommendedQuoteId ? (
                                                        <div className="mt-1">
                                                            <DocumentStatus label="ผู้เสนอที่เลือก" tone="success" />
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600">{quote.quoteRef || "-"}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600">{quote.creditDays || 0} วัน</td>
                                                <td className="px-4 py-3 text-sm text-slate-600">{quote.deliveryDays || 0} วัน</td>
                                                <td className="px-4 py-3 text-right text-sm font-semibold text-slate-950">{formatMoney(Number(quote.totalAmount || 0))}</td>
                                                <td className="px-4 py-3 text-center text-sm text-slate-700">{quote.overallRank || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="mt-4 space-y-3">
                            {comparison.quotes.map((quote, index) => (
                                <details key={quote.id} className="rounded-xl border border-slate-200 bg-slate-50 open:bg-white">
                                    <summary className="cursor-pointer list-none px-4 py-3">
                                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-950">
                                                    ผู้เสนอราคา #{index + 1} {quote.supplierName ? `• ${quote.supplierName}` : ""}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {quote.quoteRef || "-"} • {getVatModeLabel(quote.vatMode)} • เครดิต {quote.creditDays || 0} วัน
                                                </p>
                                            </div>
                                            <p className="text-sm font-semibold text-slate-950">{formatMoney(Number(quote.totalAmount || 0))}</p>
                                        </div>
                                    </summary>
                                    <div className="border-t border-slate-200 bg-white p-4">
                                        <QuoteItemsTable items={quote.items} />
                                        <div className="mt-4">
                                            <QuoteTotalsGrid quote={quote} />
                                        </div>
                                        {quote.note ? (
                                            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                                {quote.note}
                                            </div>
                                        ) : null}
                                    </div>
                                </details>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="space-y-6">
                    <section className="rounded-xl border border-slate-200 bg-white p-5">
                        <h2 className="text-base font-semibold text-slate-950">ผลที่เสนออนุมัติ</h2>
                        <div className="mt-4 space-y-3 text-sm text-slate-600">
                            <p>ผู้เสนอที่เลือก: <span className="font-semibold text-slate-950">{comparison.recommendedSupplierName || "-"}</span></p>
                            <p>มูลค่าที่เลือก: <span className="font-semibold text-slate-950">{formatMoney(Number(comparison.recommendedTotalAmount || 0))}</span></p>
                            <p>เกณฑ์การตัดสิน: <span className="font-semibold text-slate-950">{getRecommendationTypeLabel(comparison.recommendationType)}</span></p>
                            {recommendedQuote ? (
                                <p>VAT: <span className="font-semibold text-slate-950">{getVatModeLabel(recommendedQuote.vatMode)}</span></p>
                            ) : null}
                        </div>
                        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                            {comparison.recommendationReason || "-"}
                        </div>
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-5">
                        <h2 className="text-base font-semibold text-slate-950">การเชื่อมโยงเอกสาร</h2>
                        <div className="mt-4 space-y-4">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                                <p className="font-semibold text-slate-950">PR ต้นทาง</p>
                                {sourceRequisition ? (
                                    <div className="mt-3 space-y-2">
                                        <DocumentStatus label={getPurchaseRequisitionStatusMeta(sourceRequisition.status).label} tone="info" />
                                        <Link href={`/pr/${comparison.prId}`} className="inline-flex font-semibold text-indigo-600 hover:text-indigo-800">
                                            เปิดดู PR ต้นทาง
                                        </Link>
                                    </div>
                                ) : (
                                    <p className="mt-3">ไม่พบข้อมูล PR ต้นทาง</p>
                                )}
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                                <p className="font-semibold text-slate-950">เอกสารปลายทาง</p>
                                <div className="mt-3 space-y-2">
                                    <p>ประเภท: <span className="font-semibold text-slate-950">{getFulfillmentTypeLabel(comparison.fulfillmentType)}</span></p>
                                    {linkedTargetId ? (
                                        <Link href={targetDetailHref} className="inline-flex font-semibold text-violet-600 hover:text-violet-800">
                                            เปิดดู{targetDocumentLabel}ที่สร้างแล้ว
                                        </Link>
                                    ) : targetCreateHref ? (
                                        <Link href={targetCreateHref} className="inline-flex font-semibold text-violet-600 hover:text-violet-800">
                                            ไปหน้าออก {targetDocumentLabel}
                                        </Link>
                                    ) : (
                                        <p>ยังไม่พร้อมออกเอกสารปลายทาง</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-5">
                        <h2 className="text-base font-semibold text-slate-950">ประวัติการอนุมัติ</h2>
                        <div className="mt-4">
                            <ApprovalTrailTable approvalTrail={comparison.approvalTrail} />
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
