"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import PriceComparisonForm from "@/components/price-comparison/PriceComparisonForm";
import { useProject } from "@/context/ProjectContext";
import { db } from "@/lib/firebase";
import {
    canCreatePriceComparison,
    getPurchaseRequisitionStatusMeta,
} from "@/lib/purchaseRequisition";
import type { PurchaseRequisition } from "@/types/pr";

type FirestoreTimestampLike = {
    toDate?: () => Date;
    seconds?: number;
};

function getCreatedAtMillis(value: unknown) {
    if (!value || typeof value !== "object") return 0;

    const timestamp = value as FirestoreTimestampLike;
    if (typeof timestamp.toDate === "function") {
        return timestamp.toDate().getTime();
    }
    if (typeof timestamp.seconds === "number") {
        return timestamp.seconds * 1000;
    }

    return 0;
}

function formatCurrency(value: number) {
    return Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function LiffCreatePriceComparisonContent() {
    const { currentProject } = useProject();
    const searchParams = useSearchParams();
    const requisitionId = searchParams.get("prId") || "";
    const projectId = currentProject?.id || "";

    const [loading, setLoading] = useState(false);
    const [eligibleRequisitions, setEligibleRequisitions] = useState<PurchaseRequisition[]>([]);

    useEffect(() => {
        if (requisitionId || !projectId) return;

        let active = true;

        async function fetchEligibleRequisitions() {
            setLoading(true);
            try {
                const snapshot = await getDocs(query(
                    collection(db, "purchase_requisitions"),
                    where("projectId", "==", projectId)
                ));

                if (!active) return;

                const nextRequisitions = snapshot.docs
                    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as PurchaseRequisition)
                    .filter((requisition) => canCreatePriceComparison(requisition.status))
                    .sort((left, right) => getCreatedAtMillis(right.createdAt) - getCreatedAtMillis(left.createdAt));

                setEligibleRequisitions(nextRequisitions);
            } catch (error) {
                console.error("Error fetching LIFF requisitions for comparison:", error);
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        void fetchEligibleRequisitions();

        return () => {
            active = false;
        };
    }, [projectId, requisitionId]);

    if (requisitionId) {
        return (
            <div className="min-h-screen bg-slate-100 p-4 pb-24">
                <PriceComparisonForm
                    mode="create"
                    backHref="/liff/price-comparisons/create"
                    missingRequisitionHref="/liff/price-comparisons/create"
                    redirectAfterSaveBasePath="/liff/price-comparisons"
                />
            </div>
        );
    }

    if (!currentProject) {
        return (
            <div className="min-h-screen bg-slate-100 p-4">
                <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-center">
                    <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                    <h1 className="text-lg font-semibold text-slate-900">ยังไม่ได้เลือกโครงการ</h1>
                    <p className="mt-2 text-sm text-slate-500">กรุณากลับไปหน้า LIFF หลักเพื่อเลือกโครงการก่อนสร้างเอกสารเทียบราคา</p>
                    <Link href="/liff" className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                        กลับหน้า LIFF
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 p-4 pb-20">
            <div className="mx-auto max-w-3xl space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-blue-100 p-4">
                    <div className="flex items-start gap-3">
                        <Link href="/liff" className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700">
                            <ArrowLeft size={18} />
                        </Link>
                        <div className="min-w-0">
                            <h1 className="text-xl font-semibold text-slate-900">เลือก PR ต้นทางสำหรับสร้าง PC</h1>
                            <p className="mt-1 text-sm text-slate-500">
                                โครงการ: <span className="font-medium text-slate-700">{currentProject.name}</span>
                                {currentProject.code ? ` (${currentProject.code})` : ""}
                            </p>
                        </div>
                    </div>
                </div>

                {loading && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
                        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
                        <p className="text-sm text-slate-500">กำลังโหลด PR ที่พร้อมเทียบราคา...</p>
                    </div>
                )}

                {!loading && eligibleRequisitions.length === 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
                        <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                        <h2 className="text-lg font-semibold text-slate-900">ยังไม่มี PR ที่พร้อมสำหรับเทียบราคา</h2>
                        <p className="mt-2 text-sm text-slate-500">PR ต้องอยู่ในสถานะที่อนุมัติให้จัดหาแล้ว หรืออยู่ระหว่างจัดหา/เทียบราคา</p>
                        <Link href="/liff/pr/create" className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                            สร้าง PR ใหม่
                        </Link>
                    </div>
                )}

                {!loading && eligibleRequisitions.map((requisition) => {
                    const statusMeta = getPurchaseRequisitionStatusMeta(requisition.status);

                    return (
                        <div key={requisition.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900">{requisition.prNumber}</p>
                                    <h2 className="mt-1 text-base font-semibold text-slate-900">{requisition.title}</h2>
                                </div>
                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.color}`}>
                                    {statusMeta.label}
                                </span>
                            </div>

                            <p className="mt-2 text-sm text-slate-500 line-clamp-2">{requisition.reason}</p>

                            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
                                <div>ผู้ขอ: <span className="font-medium text-slate-700">{requisition.requestedByName || requisition.createdBy}</span></div>
                                <div>มูลค่า PR: <span className="font-medium text-slate-700">฿ {formatCurrency(requisition.totalAmount)}</span></div>
                                <div>เอกสารปลายทาง: <span className="font-medium text-slate-700">{requisition.fulfillmentType === "wc" ? "WC" : "PO"}</span></div>
                                <div>ประเภทคำขอ: <span className="font-medium text-slate-700">{requisition.requestType === "service" ? "ขอจ้าง/บริการ" : "ขอซื้อวัสดุ"}</span></div>
                            </div>

                            {requisition.currentComparisonId && (
                                <p className="mt-3 text-xs font-medium text-indigo-600">PR นี้มีเอกสารเทียบราคาที่กำลังใช้งานอยู่แล้ว แต่ยังสามารถเปิดฟอร์มเพื่อทำรอบใหม่ได้</p>
                            )}

                            <div className="mt-4 flex justify-end">
                                <Link
                                    href={`/liff/price-comparisons/create?prId=${requisition.id}`}
                                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                                >
                                    เลือก PR นี้
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function LiffCreatePriceComparisonPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-slate-100 p-8">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                </div>
            }
        >
            <LiffCreatePriceComparisonContent />
        </Suspense>
    );
}
