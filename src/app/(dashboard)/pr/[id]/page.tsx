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
import { Timestamp, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
    canConvertPurchaseRequisition,
    canCreatePriceComparison,
    finalizePurchaseRequisitionApprovalTrail,
    getPurchaseRequisitionDeleteBlockReason,
    getPurchaseRequisitionDecisionStatus,
    getPurchaseRequisitionPrimaryLinkedTargetId,
    getPurchaseRequisitionStatusMeta,
    isPurchaseRequisitionPendingApproval,
} from "@/lib/purchaseRequisition";
import { getPriceComparisonStatusMeta } from "@/lib/priceComparison";
import {
    ApprovalTrailTable,
    DocumentStatus,
    formatDocumentDate,
    formatMoney,
    getFulfillmentTypeLabel,
} from "@/components/price-comparison/PriceComparisonDocument";
import {
    PurchaseRequisitionItemsTable,
    PurchaseRequisitionTotalsSummary,
    formatPurchaseRequisitionRequiredDate,
    getPurchaseRequisitionRequestTypeLabel,
    getPurchaseRequisitionStatusTone,
    getPurchaseRequisitionUrgencyLabel,
} from "@/components/pr/PurchaseRequisitionDocument";
import { usePurchaseRequisitionRecord } from "@/components/pr/usePurchaseRequisitionRecord";

export default function PurchaseRequisitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { userProfile } = useAuth();
    const { requisition, comparisons, loading, missing } = usePurchaseRequisitionRecord(resolvedParams.id);

    const [actionLoading, setActionLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (missing) {
            router.push("/pr");
        }
    }, [missing, router]);

    const handleDecision = async (decision: "approved" | "rejected") => {
        if (!requisition || !userProfile) return;

        const confirmed = window.confirm(
            decision === "approved"
                ? "ยืนยันอนุมัติคำขอนี้ใช่หรือไม่?"
                : "ยืนยันไม่อนุมัติคำขอนี้ใช่หรือไม่?"
        );
        if (!confirmed) return;

        setActionLoading(true);
        try {
            const nextStatus = getPurchaseRequisitionDecisionStatus(decision);
            const nextTrail = finalizePurchaseRequisitionApprovalTrail({
                currentTrail: requisition.approvalTrail,
                decision,
                approverUid: userProfile.uid,
                approverName: userProfile.displayName || userProfile.email || userProfile.uid,
                role: userProfile.role,
                actionAt: Timestamp.now(),
            });

            const nextRecord = {
                ...requisition,
                status: nextStatus,
                approvalTrail: nextTrail,
            };

            await updateDoc(doc(db, "purchase_requisitions", requisition.id), {
                status: nextStatus,
                approvalTrail: nextTrail,
                updatedAt: serverTimestamp(),
            });

            if (decision === "approved") {
                try {
                    await fetch("/api/line/notify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "PR",
                            data: nextRecord,
                        }),
                    });
                } catch (error) {
                    console.error("PR approval notification failed:", error);
                }
            }
        } catch (error) {
            console.error("Error updating PR status:", error);
            alert("ไม่สามารถอัปเดตสถานะ PR ได้");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!requisition) return;

        const deleteBlockReason = getPurchaseRequisitionDeleteBlockReason({
            comparisonCount: comparisons.length,
            linkedPoIds: requisition.linkedPoIds,
            linkedWcIds: requisition.linkedWcIds,
        });
        if (deleteBlockReason) {
            alert(deleteBlockReason);
            return;
        }

        const confirmed = window.confirm(`ยืนยันลบเอกสาร PR ${requisition.prNumber} ใช่หรือไม่?`);
        if (!confirmed) return;

        setDeleting(true);
        try {
            await deleteDoc(doc(db, "purchase_requisitions", requisition.id));
            router.push("/pr");
        } catch (error) {
            console.error("Error deleting PR:", error);
            alert("ลบเอกสารไม่สำเร็จ");
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-slate-500">กำลังโหลดข้อมูล PR...</p>
            </div>
        );
    }

    if (!requisition) return null;

    const statusMeta = getPurchaseRequisitionStatusMeta(requisition.status);
    const isPending = isPurchaseRequisitionPendingApproval(requisition.status);
    const canApprove = userProfile?.role === "admin" || userProfile?.role === "pm";
    const canManageComparison = canCreatePriceComparison(requisition.status);
    const comparisonActionHref = requisition.currentComparisonId
        ? `/price-comparisons/${requisition.currentComparisonId}`
        : `/price-comparisons/create?prId=${requisition.id}`;
    const comparisonActionLabel = requisition.currentComparisonId
        ? "ดูเอกสารเทียบราคาล่าสุด"
        : "สร้างเอกสารเทียบราคา";
    const activeComparisonId = requisition.selectedComparisonId || requisition.currentComparisonId || "";
    const activeComparison = comparisons.find((comparison) => comparison.id === activeComparisonId) || null;
    const linkedTargetId = getPurchaseRequisitionPrimaryLinkedTargetId(requisition);
    const targetDocumentLabel = requisition.fulfillmentType === "po" ? "PO" : "WC";
    const targetDetailHref = linkedTargetId
        ? `${requisition.fulfillmentType === "po" ? "/po" : "/wc"}/${linkedTargetId}`
        : "";
    const canCreateTargetDocument = canConvertPurchaseRequisition(requisition.status) && Boolean(activeComparisonId) && !linkedTargetId;
    const targetCreateHref = canCreateTargetDocument
        ? `${requisition.fulfillmentType === "po" ? "/po/create" : "/wc/create"}?prId=${requisition.id}&comparisonId=${activeComparisonId}`
        : "";
    const canDeletePermission = Boolean(
        userProfile?.role === "admin" ||
        userProfile?.role === "pm" ||
        userProfile?.role === "procurement" ||
        userProfile?.uid === requisition.createdBy
    );
    const deleteBlockReason = getPurchaseRequisitionDeleteBlockReason({
        comparisonCount: comparisons.length,
        linkedPoIds: requisition.linkedPoIds,
        linkedWcIds: requisition.linkedWcIds,
    });

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/pr"
                        className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">ข้อมูลใบคำขอซื้อ / ขอจ้าง</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            {requisition.prNumber} • ผู้ขอ {requisition.requestedByName || requisition.createdBy}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <Link
                        href={`/pr/${requisition.id}/document`}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                        <FileText size={16} className="mr-2" />
                        ดูแบบเอกสาร
                    </Link>

                    {canManageComparison ? (
                        <Link
                            href={comparisonActionHref}
                            className="inline-flex items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                        >
                            <FileSearch size={16} className="mr-2" />
                            {comparisonActionLabel}
                        </Link>
                    ) : null}

                    {targetDetailHref ? (
                        <Link
                            href={targetDetailHref}
                            className="inline-flex items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                        >
                            <FileSearch size={16} className="mr-2" />
                            ดู{targetDocumentLabel}ที่สร้างแล้ว
                        </Link>
                    ) : null}

                    {targetCreateHref ? (
                        <Link
                            href={targetCreateHref}
                            className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
                        >
                            <FileSearch size={16} className="mr-2" />
                            ออก{targetDocumentLabel}
                        </Link>
                    ) : null}

                    {(requisition.status === "draft" || requisition.status === "rejected") ? (
                        <Link
                            href={`/pr/${requisition.id}/edit`}
                            className="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                        >
                            <Edit size={16} className="mr-2" />
                            แก้ไข PR
                        </Link>
                    ) : null}

                    {canDeletePermission ? (
                        <button
                            type="button"
                            onClick={() => void handleDelete()}
                            disabled={deleting}
                            title={deleteBlockReason || "ลบเอกสาร PR"}
                            className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                        >
                            {deleting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Trash2 size={16} className="mr-2" />}
                            ลบเอกสาร
                        </button>
                    ) : null}

                    {isPending && canApprove ? (
                        <>
                            <button
                                type="button"
                                onClick={() => void handleDecision("rejected")}
                                disabled={actionLoading}
                                className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                            >
                                <XCircle size={16} className="mr-2" />
                                ไม่อนุมัติ
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleDecision("approved")}
                                disabled={actionLoading}
                                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                            >
                                {actionLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CheckCircle size={16} className="mr-2" />}
                                อนุมัติให้จัดหา
                            </button>
                        </>
                    ) : null}
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">สถานะ</p>
                    <div className="mt-2">
                        <DocumentStatus label={statusMeta.label} tone={getPurchaseRequisitionStatusTone(requisition.status)} />
                    </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">ประเภทคำขอ</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{getPurchaseRequisitionRequestTypeLabel(requisition.requestType)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">ผู้ขอ</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{requisition.requestedByName || requisition.createdBy}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">มูลค่ารวม</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{formatMoney(Number(requisition.totalAmount || 0))}</p>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.62fr,0.38fr]">
                <div className="space-y-6">
                    <section className="rounded-xl border border-slate-200 bg-white p-5">
                        <h2 className="text-base font-semibold text-slate-950">ข้อมูลคำขอ</h2>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                <span className="text-slate-500">เลขที่เอกสาร</span>
                                <p className="mt-1 font-semibold text-slate-950">{requisition.prNumber}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                <span className="text-slate-500">วันที่สร้าง</span>
                                <p className="mt-1 font-semibold text-slate-950">{formatDocumentDate(requisition.createdAt)}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                <span className="text-slate-500">วันที่ต้องการใช้</span>
                                <p className="mt-1 font-semibold text-slate-950">{formatPurchaseRequisitionRequiredDate(requisition.requiredDate)}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                <span className="text-slate-500">ความเร่งด่วน</span>
                                <p className="mt-1 font-semibold text-slate-950">{getPurchaseRequisitionUrgencyLabel(requisition.urgency)}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                <span className="text-slate-500">ปลายทางเอกสาร</span>
                                <p className="mt-1 font-semibold text-slate-950">{getFulfillmentTypeLabel(requisition.fulfillmentType)}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                <span className="text-slate-500">เอกสารเทียบราคาปัจจุบัน</span>
                                <p className="mt-1 font-semibold text-slate-950">{activeComparison?.comparisonNumber || "-"}</p>
                            </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">หัวข้อคำขอ</p>
                            <p className="mt-2 text-base font-semibold text-slate-950">{requisition.title}</p>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{requisition.reason || "-"}</p>
                        </div>
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-5">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-slate-950">รายการที่ขอซื้อ / ขอจ้าง</h2>
                                <p className="mt-1 text-sm text-slate-500">สำหรับตรวจสอบรายละเอียดรายการและมูลค่าของเอกสาร</p>
                            </div>
                            <Link href={`/pr/${requisition.id}/document`} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                                เปิดแบบเอกสาร
                            </Link>
                        </div>

                        <div className="mt-4">
                            <PurchaseRequisitionItemsTable items={requisition.items} />
                        </div>

                        <div className="mt-4 flex justify-end">
                            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <PurchaseRequisitionTotalsSummary requisition={requisition} />
                            </div>
                        </div>
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-5">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-slate-950">เอกสารเทียบราคาที่เกี่ยวข้อง</h2>
                                <p className="mt-1 text-sm text-slate-500">ติดตามรอบการเทียบราคาและผลคัดเลือกจาก PR ฉบับนี้</p>
                            </div>
                            {canManageComparison ? (
                                <Link href={`/price-comparisons/create?prId=${requisition.id}`} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                                    สร้างรอบเทียบราคาใหม่
                                </Link>
                            ) : null}
                        </div>

                        {comparisons.length === 0 ? (
                            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                                ยังไม่มีเอกสารเทียบราคาสำหรับ PR นี้
                            </div>
                        ) : (
                            <div className="mt-4 space-y-3">
                                {comparisons.map((comparison) => {
                                    const comparisonStatusMeta = getPriceComparisonStatusMeta(comparison.status);
                                    const isSelectedComparison = comparison.id === requisition.selectedComparisonId;
                                    const comparisonTone = comparison.status === "approved"
                                        ? "success"
                                        : comparison.status === "pending_approval"
                                            ? "warning"
                                            : comparison.status === "rejected"
                                                ? "danger"
                                                : "neutral";

                                    return (
                                        <div
                                            key={comparison.id}
                                            className={`rounded-xl border p-4 ${isSelectedComparison ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50"}`}
                                        >
                                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="font-semibold text-slate-950">{comparison.comparisonNumber}</p>
                                                        {isSelectedComparison ? (
                                                            <DocumentStatus label="ผลที่อนุมัติ" tone="success" />
                                                        ) : null}
                                                    </div>
                                                    <p className="mt-1 text-sm text-slate-500">
                                                        ผู้เสนอแนะ: {comparison.recommendedSupplierName || "-"} • {formatMoney(Number(comparison.recommendedTotalAmount || 0))}
                                                    </p>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-3">
                                                    <DocumentStatus label={comparisonStatusMeta.label} tone={comparisonTone} />
                                                    <Link href={`/price-comparisons/${comparison.id}`} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                                                        เปิดดู
                                                    </Link>
                                                    <Link href={`/price-comparisons/${comparison.id}/document`} className="text-sm font-semibold text-slate-600 hover:text-slate-900">
                                                        แบบเอกสาร
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>

                <div className="space-y-6">
                    <section className="rounded-xl border border-slate-200 bg-white p-5">
                        <h2 className="text-base font-semibold text-slate-950">สถานะการจัดหา</h2>
                        <div className="mt-4 space-y-4">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                <p className="text-sm text-slate-500">สถานะ PR</p>
                                <div className="mt-2">
                                    <DocumentStatus label={statusMeta.label} tone={getPurchaseRequisitionStatusTone(requisition.status)} />
                                </div>
                            </div>

                            {activeComparison ? (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-sm text-slate-500">ผลเทียบราคาปัจจุบัน</p>
                                    <p className="mt-2 text-sm font-semibold text-slate-950">{activeComparison.comparisonNumber}</p>
                                    <p className="mt-2 text-sm text-slate-600">ผู้เสนอแนะ: <span className="font-semibold text-slate-950">{activeComparison.recommendedSupplierName || "-"}</span></p>
                                    <p className="mt-2 text-sm text-slate-600">มูลค่าที่เลือก: <span className="font-semibold text-slate-950">{formatMoney(Number(activeComparison.recommendedTotalAmount || 0))}</span></p>
                                    <div className="mt-3 flex flex-wrap gap-3">
                                        <Link href={`/price-comparisons/${activeComparison.id}`} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                                            เปิดข้อมูลเทียบราคา
                                        </Link>
                                        <Link href={`/price-comparisons/${activeComparison.id}/document`} className="text-sm font-semibold text-slate-600 hover:text-slate-900">
                                            แบบเอกสารเทียบราคา
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                                    ยังไม่มีผลเทียบราคาที่ถูกเลือกสำหรับ PR นี้
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-5">
                        <h2 className="text-base font-semibold text-slate-950">เอกสารปลายทาง</h2>
                        <div className="mt-4 space-y-3">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                                <p>ประเภทเอกสาร: <span className="font-semibold text-slate-950">{getFulfillmentTypeLabel(requisition.fulfillmentType)}</span></p>
                                <p className="mt-2">
                                    สถานะปัจจุบัน: <span className="font-semibold text-slate-950">{linkedTargetId ? `ออก${targetDocumentLabel}แล้ว` : `ยังไม่ออก${targetDocumentLabel}`}</span>
                                </p>
                            </div>

                            {targetDetailHref ? (
                                <Link href={targetDetailHref} className="inline-flex text-sm font-semibold text-violet-600 hover:text-violet-800">
                                    เปิดดูเอกสาร {targetDocumentLabel}
                                </Link>
                            ) : targetCreateHref ? (
                                <Link href={targetCreateHref} className="inline-flex text-sm font-semibold text-violet-600 hover:text-violet-800">
                                    ไปหน้าออก {targetDocumentLabel}
                                </Link>
                            ) : (
                                <p className="text-sm text-slate-500">ยังไม่พร้อมออกเอกสารปลายทาง</p>
                            )}
                        </div>
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-5">
                        <div className="flex flex-col gap-2">
                            <h2 className="text-base font-semibold text-slate-950">ประวัติการอนุมัติ</h2>
                            {deleteBlockReason ? (
                                <p className="text-sm text-slate-500">หมายเหตุการลบเอกสาร: {deleteBlockReason}</p>
                            ) : null}
                        </div>
                        <div className="mt-4">
                            <ApprovalTrailTable approvalTrail={requisition.approvalTrail} />
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
