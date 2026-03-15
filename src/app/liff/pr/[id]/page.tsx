"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Edit, FileText, Loader2, Trash2, XCircle } from "lucide-react";
import { Timestamp, deleteDoc, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import type { PurchaseRequisition } from "@/types/pr";
import {
    finalizePurchaseRequisitionApprovalTrail,
    getPurchaseRequisitionDeleteBlockReason,
    getPurchaseRequisitionDecisionStatus,
    isPurchaseRequisitionPendingApproval,
} from "@/lib/purchaseRequisition";
import { formatDateThai, formatMoney } from "@/app/liff/_lib/documentHelpers";
import {
    getRequesterFulfillmentTypeLabel,
    getRequesterProgressSteps,
    getRequesterRequestTypeLabel,
    getRequesterStatusMeta,
    getRequesterUrgencyLabel,
} from "@/app/liff/_lib/requesterPortal";

export default function LiffPurchaseRequisitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { user, userProfile } = useAuth();

    const [requisition, setRequisition] = useState<PurchaseRequisition | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        async function fetchRequisition() {
            try {
                const requisitionSnap = await getDoc(doc(db, "purchase_requisitions", resolvedParams.id));
                if (!requisitionSnap.exists()) {
                    router.push("/liff/pr");
                    return;
                }

                setRequisition({ id: requisitionSnap.id, ...requisitionSnap.data() } as PurchaseRequisition);
            } catch (error) {
                console.error("Error fetching LIFF PR detail:", error);
                router.push("/liff/pr");
            } finally {
                setLoading(false);
            }
        }

        void fetchRequisition();
    }, [resolvedParams.id, router]);

    const handleDecision = async (decision: "approved" | "rejected") => {
        if (!requisition || !userProfile) return;
        if (!window.confirm(decision === "approved" ? "ยืนยันการอนุมัติ PR นี้ใช่หรือไม่?" : "ยืนยันการไม่อนุมัติ PR นี้ใช่หรือไม่?")) {
            return;
        }

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

            await updateDoc(doc(db, "purchase_requisitions", requisition.id), {
                status: nextStatus,
                approvalTrail: nextTrail,
                updatedAt: serverTimestamp(),
            });

            const nextRecord = {
                ...requisition,
                status: nextStatus,
                approvalTrail: nextTrail,
            };
            setRequisition(nextRecord);

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
            console.error("Error updating LIFF PR status:", error);
            alert("ไม่สามารถอัปเดตสถานะ PR ได้");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!requisition) return;

        const deleteBlockReason = getPurchaseRequisitionDeleteBlockReason({
            comparisonCount: requisition.currentComparisonId || requisition.selectedComparisonId ? 1 : 0,
            linkedPoIds: requisition.linkedPoIds,
            linkedWcIds: requisition.linkedWcIds,
        });
        if (deleteBlockReason) {
            alert(deleteBlockReason);
            return;
        }

        if (!window.confirm(`ยืนยันลบเอกสาร PR ${requisition.prNumber} ใช่หรือไม่?`)) {
            return;
        }

        setDeleting(true);
        try {
            await deleteDoc(doc(db, "purchase_requisitions", requisition.id));
            router.push("/liff/pr");
        } catch (error) {
            console.error("Error deleting LIFF PR:", error);
            alert("ลบเอกสารไม่สำเร็จ");
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-slate-100 p-8">
                <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-600" />
                <p className="text-sm text-slate-500">กำลังโหลดข้อมูล PR...</p>
            </div>
        );
    }

    if (!requisition) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-slate-100 p-8 text-center">
                <FileText className="mb-4 h-12 w-12 text-slate-300" />
                <h1 className="text-lg font-semibold text-slate-900">ไม่พบเอกสาร PR</h1>
                <Link href="/liff/pr" className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                    กลับไป PR ของฉัน
                </Link>
            </div>
        );
    }

    const statusMeta = getRequesterStatusMeta(requisition.status);
    const progressSteps = getRequesterProgressSteps(requisition.status);
    const canApprove = userProfile?.role === "admin" || userProfile?.role === "pm";
    const canEdit = user?.uid === requisition.createdBy && (requisition.status === "draft" || requisition.status === "rejected");
    const isPending = isPurchaseRequisitionPendingApproval(requisition.status);
    const linkedPoCount = Array.isArray(requisition.linkedPoIds) ? requisition.linkedPoIds.length : 0;
    const linkedWcCount = Array.isArray(requisition.linkedWcIds) ? requisition.linkedWcIds.length : 0;
    const canDelete = user?.uid === requisition.createdBy;
    const deleteBlockReason = getPurchaseRequisitionDeleteBlockReason({
        comparisonCount: requisition.currentComparisonId || requisition.selectedComparisonId ? 1 : 0,
        linkedPoIds: requisition.linkedPoIds,
        linkedWcIds: requisition.linkedWcIds,
    });

    return (
        <div className="min-h-screen bg-slate-100 pb-28">
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
                <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
                    <Link href="/liff/pr" className="rounded-md border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50">
                        <ArrowLeft size={18} />
                    </Link>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-base font-semibold text-slate-900">รายละเอียด PR</h1>
                        <p className="truncate text-xs text-slate-500">{requisition.prNumber}</p>
                    </div>
                    {canEdit && (
                        <Link href={`/liff/pr/${requisition.id}/edit`} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800">
                            <Edit size={14} />
                            แก้ไข
                        </Link>
                    )}
                    {canDelete && (
                        <button
                            type="button"
                            onClick={() => void handleDelete()}
                            disabled={deleting}
                            title={deleteBlockReason || "ลบเอกสาร PR"}
                            className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
                        >
                            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            ลบ
                        </button>
                    )}
                </div>
            </header>

            <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs text-slate-500">เลขที่เอกสาร</p>
                            <h2 className="text-lg font-semibold text-slate-900">{requisition.prNumber}</h2>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.color}`}>
                            {statusMeta.label}
                        </span>
                    </div>

                    <h3 className="mt-4 text-base font-semibold text-slate-900">{requisition.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{statusMeta.description}</p>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-900">สถานะการดำเนินการ</h3>
                    <div className="mt-4 space-y-3">
                        {progressSteps.map((step, index) => {
                            const isDone = step.state === "done";
                            const isCurrent = step.state === "current";

                            return (
                                <div key={step.key} className="flex items-start gap-3">
                                    <div
                                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                            isDone
                                                ? "bg-blue-700 text-white"
                                                : isCurrent
                                                    ? "border border-blue-600 bg-blue-50 text-blue-700"
                                                    : "bg-slate-100 text-slate-500"
                                        }`}
                                    >
                                        {index + 1}
                                    </div>
                                    <div>
                                        <p className={`text-sm font-medium ${isDone || isCurrent ? "text-slate-900" : "text-slate-500"}`}>
                                            {step.label}
                                        </p>
                                        <p
                                            className={`text-xs ${
                                                isDone
                                                    ? "text-blue-700"
                                                    : isCurrent
                                                        ? "text-sky-700"
                                                        : "text-slate-400"
                                            }`}
                                        >
                                            {isDone ? "เสร็จแล้ว" : isCurrent ? "กำลังดำเนินการ" : "รอดำเนินการ"}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-900">สรุปคำขอ</h3>
                    <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
                        <div>ผู้ขอ: <span className="font-medium text-slate-700">{requisition.requestedByName || requisition.createdBy}</span></div>
                        <div>วันที่สร้าง: <span className="font-medium text-slate-700">{formatDateThai(requisition.createdAt, "long")}</span></div>
                        <div>วันที่ต้องการใช้: <span className="font-medium text-slate-700">{requisition.requiredDate || "-"}</span></div>
                        <div>ความเร่งด่วน: <span className="font-medium text-slate-700">{getRequesterUrgencyLabel(requisition.urgency)}</span></div>
                        <div>ประเภทคำขอ: <span className="font-medium text-slate-700">{getRequesterRequestTypeLabel(requisition.requestType)}</span></div>
                        <div>เอกสารปลายทาง: <span className="font-medium text-slate-700">{getRequesterFulfillmentTypeLabel(requisition.fulfillmentType)}</span></div>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        {requisition.reason}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-900">ความคืบหน้า</h3>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <p>{statusMeta.description}</p>
                        <p>อ้างอิง PO: <span className="font-medium text-slate-900">{linkedPoCount}</span></p>
                        <p>อ้างอิง WC: <span className="font-medium text-slate-900">{linkedWcCount}</span></p>
                    </div>
                </section>

                <section className="space-y-3">
                    <h3 className="px-1 text-xs font-semibold tracking-wide text-slate-500">รายการที่ขอ</h3>
                    {requisition.items.map((item, index) => (
                        <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-400">รายการ {index + 1}</p>
                                    <h4 className="mt-1 text-sm font-semibold text-slate-900">{item.description}</h4>
                                    <p className="mt-1 text-xs text-slate-500">{item.quantity} {item.unit}</p>
                                </div>
                                <p className="shrink-0 text-sm font-semibold text-slate-900">{formatMoney(item.amount)}</p>
                            </div>
                        </div>
                    ))}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between text-slate-600">
                            <span>รวมก่อนภาษี</span>
                            <span className="font-medium text-slate-900">{formatMoney(requisition.subTotal)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                            <span>VAT {requisition.vatRate}%</span>
                            <span className="font-medium text-slate-900">{formatMoney(requisition.vatAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base">
                            <span className="font-semibold text-slate-900">รวมทั้งสิ้น</span>
                            <span className="font-semibold text-slate-900">{formatMoney(requisition.totalAmount)}</span>
                        </div>
                    </div>
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
                                ไม่อนุมัติ
                            </span>
                        </button>
                        <button
                            onClick={() => void handleDecision("approved")}
                            disabled={actionLoading}
                            className="flex-[1.3] rounded-md border border-emerald-600 bg-emerald-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        >
                            <span className="inline-flex items-center justify-center">
                                {actionLoading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <CheckCircle size={18} className="mr-2" />}
                                อนุมัติ
                            </span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
