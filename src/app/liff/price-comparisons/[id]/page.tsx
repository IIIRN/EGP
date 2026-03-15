"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Edit, FileSearch, Loader2, Trash2, XCircle } from "lucide-react";
import { Timestamp, collection, doc, getDoc, getDocs, limit, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import type { PriceComparison } from "@/types/priceComparison";
import type { PurchaseRequisition } from "@/types/pr";
import {
    finalizePriceComparisonApprovalTrail,
    getPriceComparisonDecisionStatus,
    getPriceComparisonStatusMeta,
    getRecommendationTypeLabel,
    isPriceComparisonPendingApproval,
} from "@/lib/priceComparison";
import { canSeeAllProjectDocuments, formatDateThai, formatMoney } from "@/app/liff/_lib/documentHelpers";

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

export default function LiffPriceComparisonDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { userProfile } = useAuth();

    const [comparison, setComparison] = useState<PriceComparison | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        async function fetchComparison() {
            try {
                const comparisonSnap = await getDoc(doc(db, "pr_price_comparisons", resolvedParams.id));
                if (!comparisonSnap.exists()) {
                    router.push("/liff/price-comparisons");
                    return;
                }

                setComparison({ id: comparisonSnap.id, ...comparisonSnap.data() } as PriceComparison);
            } catch (error) {
                console.error("Error fetching LIFF PC detail:", error);
                router.push("/liff/price-comparisons");
            } finally {
                setLoading(false);
            }
        }

        void fetchComparison();
    }, [resolvedParams.id, router]);

    const handleDecision = async (decision: "approved" | "rejected") => {
        if (!comparison || !userProfile) return;
        if (!window.confirm(decision === "approved" ? "Approve this comparison?" : "Reject this comparison?")) {
            return;
        }

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

            const nextRecord = {
                ...comparison,
                status: nextStatus,
                approvalTrail: nextTrail,
            };
            setComparison(nextRecord);

            if (decision === "approved") {
                try {
                    await fetch("/api/line/notify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: "PC", data: nextRecord }),
                    });
                } catch (error) {
                    console.error("PC approval notification failed:", error);
                }
            }
        } catch (error) {
            console.error("Error updating LIFF PC status:", error);
            alert("Unable to update comparison status");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!comparison) return;
        if (!window.confirm(`Delete comparison ${comparison.comparisonNumber}?`)) {
            return;
        }

        setDeleting(true);
        try {
            const [linkedPoSnapshot, linkedWcSnapshot, requisitionSnap, comparisonSnapshot] = await Promise.all([
                getDocs(query(collection(db, "purchase_orders"), where("sourceComparisonId", "==", comparison.id), limit(1))),
                getDocs(query(collection(db, "work_contracts"), where("sourceComparisonId", "==", comparison.id), limit(1))),
                getDoc(doc(db, "purchase_requisitions", comparison.prId)),
                getDocs(query(collection(db, "pr_price_comparisons"), where("prId", "==", comparison.prId))),
            ]);

            if (!linkedPoSnapshot.empty || !linkedWcSnapshot.empty) {
                alert("Delete blocked: this comparison is already referenced by PO/WC.");
                setDeleting(false);
                return;
            }

            const remainingComparisons = comparisonSnapshot.docs
                .filter((docSnap) => docSnap.id !== comparison.id)
                .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as PriceComparison))
                .sort((left, right) => getCreatedAtMillis(right.createdAt) - getCreatedAtMillis(left.createdAt));

            const batch = writeBatch(db);
            batch.delete(doc(db, "pr_price_comparisons", comparison.id));

            if (requisitionSnap.exists()) {
                const requisition = { id: requisitionSnap.id, ...requisitionSnap.data() } as PurchaseRequisition;
                const selectedStillExists = Boolean(
                    requisition.selectedComparisonId &&
                    requisition.selectedComparisonId !== comparison.id &&
                    remainingComparisons.some((item) => item.id === requisition.selectedComparisonId)
                );
                const currentStillExists = Boolean(
                    requisition.currentComparisonId &&
                    requisition.currentComparisonId !== comparison.id &&
                    remainingComparisons.some((item) => item.id === requisition.currentComparisonId)
                );
                const nextSelectedComparisonId = selectedStillExists ? requisition.selectedComparisonId || "" : "";
                const nextCurrentComparisonId = nextSelectedComparisonId
                    || (currentStillExists ? requisition.currentComparisonId || "" : "")
                    || remainingComparisons[0]?.id
                    || "";
                const hasPendingApproval = remainingComparisons.some((item) => item.status === "pending_approval");
                const hasRemainingComparisons = remainingComparisons.length > 0;
                const hasLinkedDocuments = Boolean(
                    (Array.isArray(requisition.linkedPoIds) && requisition.linkedPoIds.filter(Boolean).length > 0) ||
                    (Array.isArray(requisition.linkedWcIds) && requisition.linkedWcIds.filter(Boolean).length > 0)
                );
                const nextStatus = nextSelectedComparisonId
                    ? (hasLinkedDocuments ? requisition.status : "selected")
                    : hasPendingApproval
                        ? "selection_pending"
                        : hasRemainingComparisons
                            ? "comparing"
                            : "approved_for_sourcing";

                batch.update(doc(db, "purchase_requisitions", comparison.prId), {
                    currentComparisonId: nextCurrentComparisonId,
                    selectedComparisonId: nextSelectedComparisonId,
                    selectedSupplierType: nextSelectedComparisonId ? requisition.selectedSupplierType || "" : "",
                    selectedSupplierId: nextSelectedComparisonId ? requisition.selectedSupplierId || "" : "",
                    status: nextStatus,
                    updatedAt: serverTimestamp(),
                });
            }

            await batch.commit();
            router.push("/liff/price-comparisons");
        } catch (error) {
            console.error("Error deleting LIFF PC:", error);
            alert("Unable to delete comparison");
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-slate-100 p-8">
                <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-600" />
                <p className="text-sm text-slate-500">Loading comparison...</p>
            </div>
        );
    }

    if (!comparison) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-slate-100 p-8 text-center">
                <FileSearch className="mb-4 h-12 w-12 text-slate-300" />
                <h1 className="text-lg font-semibold text-slate-900">Comparison not found</h1>
                <Link href="/liff/price-comparisons" className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                    Back to PC List
                </Link>
            </div>
        );
    }

    const statusMeta = getPriceComparisonStatusMeta(comparison.status);
    const canApprove = userProfile?.role === "admin" || userProfile?.role === "pm";
    const canEdit = (comparison.status === "draft" || comparison.status === "rejected") &&
        (comparison.createdBy === userProfile?.uid || canSeeAllProjectDocuments(userProfile?.role));
    const canDelete = comparison.createdBy === userProfile?.uid || canSeeAllProjectDocuments(userProfile?.role);
    const isPending = isPriceComparisonPendingApproval(comparison.status);

    return (
        <div className="min-h-screen bg-slate-100 pb-28">
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
                <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
                    <Link href="/liff/price-comparisons" className="rounded-md border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50">
                        <ArrowLeft size={18} />
                    </Link>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-base font-semibold text-slate-900">PC Detail</h1>
                        <p className="truncate text-xs text-slate-500">{comparison.comparisonNumber}</p>
                    </div>
                    {canEdit && (
                        <Link href={`/liff/price-comparisons/${comparison.id}/edit`} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800">
                            <Edit size={14} />
                            Edit
                        </Link>
                    )}
                    {canDelete && (
                        <button
                            type="button"
                            onClick={() => void handleDelete()}
                            disabled={deleting}
                            className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
                        >
                            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            Delete
                        </button>
                    )}
                </div>
            </header>

            <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs text-slate-500">Comparison Number</p>
                            <h2 className="text-lg font-semibold text-slate-900">{comparison.comparisonNumber}</h2>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.color}`}>
                            {statusMeta.label}
                        </span>
                    </div>

                    <h3 className="mt-4 text-base font-semibold text-slate-900">{comparison.title}</h3>

                    <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
                        <div>PR: <span className="font-medium text-slate-700">{comparison.prNumber || "-"}</span></div>
                        <div>Requester: <span className="font-medium text-slate-700">{comparison.requestedByName || comparison.requestedByUid || "-"}</span></div>
                        <div>Rule: <span className="font-medium text-slate-700">{getRecommendationTypeLabel(comparison.recommendationType)}</span></div>
                        <div>Created: <span className="font-medium text-slate-700">{formatDateThai(comparison.createdAt, "long")}</span></div>
                        <div>Recommended Supplier: <span className="font-medium text-slate-700">{comparison.recommendedSupplierName || "-"}</span></div>
                        <div>Selected Amount: <span className="font-medium text-slate-700">{formatMoney(comparison.recommendedTotalAmount)}</span></div>
                    </div>

                    {comparison.recommendationReason && (
                        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                            {comparison.recommendationReason}
                        </div>
                    )}

                    <div className="mt-4">
                        <Link href={`/liff/pr/${comparison.prId}`} className="text-sm font-semibold text-blue-700">
                            Open Source PR
                        </Link>
                    </div>
                </section>

                <section className="space-y-3">
                    <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Supplier Quotes</h3>
                    {comparison.quotes.map((quote) => (
                        <div key={quote.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 p-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-900">{quote.supplierName || "-"}</h4>
                                    <p className="mt-1 text-xs text-slate-500">Rank {quote.overallRank || "-"} • Credit {quote.creditDays || 0} days</p>
                                </div>
                                <p className="text-sm font-semibold text-slate-900">{formatMoney(quote.totalAmount)}</p>
                            </div>

                            <div className="space-y-3 p-4">
                                {quote.items.map((item) => (
                                    <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-900">{item.description}</p>
                                                <p className="mt-1 text-xs text-slate-500">{item.quantity} {item.unit}</p>
                                            </div>
                                            <p className="shrink-0 text-sm font-semibold text-slate-900">{formatMoney(item.amount)}</p>
                                        </div>
                                        <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
                                            <div>Unit Price: <span className="font-medium text-slate-700">{formatMoney(item.unitPrice)}</span></div>
                                            <div>Compliance: <span className="font-medium text-slate-700">{item.isCompliant === false ? "Not compliant" : "Compliant"}</span></div>
                                            <div className="sm:col-span-2">Remark: <span className="font-medium text-slate-700">{item.remark || "-"}</span></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </section>
            </main>

            {isPending && canApprove && (
                <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                    <div className="mx-auto flex w-full max-w-3xl gap-3">
                        <button
                            onClick={() => void handleDecision("rejected")}
                            disabled={actionLoading}
                            className="flex-1 rounded-md border border-rose-300 bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-700 disabled:opacity-50"
                        >
                            <span className="inline-flex items-center justify-center">
                                <XCircle size={18} className="mr-2" />
                                Reject
                            </span>
                        </button>
                        <button
                            onClick={() => void handleDecision("approved")}
                            disabled={actionLoading}
                            className="flex-[1.25] rounded-md border border-emerald-600 bg-emerald-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        >
                            <span className="inline-flex items-center justify-center">
                                {actionLoading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <CheckCircle size={18} className="mr-2" />}
                                Approve Comparison
                            </span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
