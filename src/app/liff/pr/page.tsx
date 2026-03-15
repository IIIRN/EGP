"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, FileText, Loader2, Plus, Search } from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { db } from "@/lib/firebase";
import type { PurchaseRequisition } from "@/types/pr";
import { formatDateThai, formatMoney, getTimestampMillis } from "@/app/liff/_lib/documentHelpers";
import {
    getRequesterFilterGroups,
    getRequesterFulfillmentTypeLabel,
    getRequesterRequestTypeLabel,
    getRequesterStatusMeta,
    matchesRequesterFilter,
} from "@/app/liff/_lib/requesterPortal";

const statusOptions = getRequesterFilterGroups();

export default function LiffPurchaseRequisitionListPage() {
    const { user } = useAuth();
    const { currentProject } = useProject();

    const [requisitions, setRequisitions] = useState<PurchaseRequisition[] | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    useEffect(() => {
        if (!currentProject) return;

        const unsubscribe = onSnapshot(
            query(collection(db, "purchase_requisitions"), where("projectId", "==", currentProject.id)),
            (snapshot) => {
                const nextRequisitions = snapshot.docs
                    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as PurchaseRequisition)
                    .filter((requisition) => requisition.createdBy === user?.uid)
                    .sort((left, right) => getTimestampMillis(right.createdAt) - getTimestampMillis(left.createdAt));

                setRequisitions(nextRequisitions);
            }
        );

        return () => unsubscribe();
    }, [currentProject, user?.uid]);

    const filteredRequisitions = (requisitions || []).filter((requisition) => {
        const searchValue = search.trim().toLowerCase();
        const matchesStatus = matchesRequesterFilter(requisition.status, statusFilter);
        const matchesSearch =
            !searchValue ||
            requisition.prNumber.toLowerCase().includes(searchValue) ||
            requisition.title.toLowerCase().includes(searchValue) ||
            (requisition.requestedByName || "").toLowerCase().includes(searchValue);

        return matchesStatus && matchesSearch;
    });

    if (!currentProject) {
        return (
            <div className="min-h-screen bg-slate-100 p-4">
                <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
                    <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                    <h1 className="text-lg font-semibold text-slate-900">ยังไม่ได้เลือกโครงการ</h1>
                    <p className="mt-2 text-sm text-slate-500">กลับไปหน้า LIFF หลักเพื่อเลือกโครงการก่อนดูรายการ PR</p>
                    <Link href="/liff" className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                        กลับหน้า LIFF
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 pb-24">
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
                <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
                    <Link href="/liff" className="rounded-md border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50">
                        <ArrowLeft size={18} />
                    </Link>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-base font-semibold text-slate-900">PR ของฉัน</h1>
                        <p className="truncate text-xs text-slate-500">{currentProject.name}</p>
                    </div>
                    <Link href="/liff/pr/create" className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white">
                        <Plus size={14} />
                        สร้าง PR
                    </Link>
                </div>
            </header>

            <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="ค้นหาเลข PR หรือหัวข้อคำขอ"
                            className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-9 pr-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {statusOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setStatusFilter(option.value)}
                                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                                    statusFilter === option.value
                                        ? "border-blue-700 bg-blue-700 text-white"
                                        : "border-slate-300 bg-white text-slate-600"
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {requisitions === null && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
                        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
                        <p className="text-sm text-slate-500">กำลังโหลดรายการ PR...</p>
                    </div>
                )}

                {requisitions !== null && filteredRequisitions.length === 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
                        <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                        <h2 className="text-lg font-semibold text-slate-900">ไม่พบรายการ PR</h2>
                        <p className="mt-2 text-sm text-slate-500">ไม่พบคำขอตามตัวกรองที่เลือก</p>
                    </div>
                )}

                {filteredRequisitions.map((requisition) => {
                    const statusMeta = getRequesterStatusMeta(requisition.status);

                    return (
                        <Link
                            key={requisition.id}
                            href={`/liff/pr/${requisition.id}`}
                            className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900">{requisition.prNumber}</p>
                                    <h2 className="mt-1 line-clamp-2 text-base font-semibold text-slate-900">{requisition.title}</h2>
                                </div>
                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.color}`}>
                                    {statusMeta.label}
                                </span>
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
                                <div>มูลค่า: <span className="font-medium text-slate-700">{formatMoney(requisition.totalAmount)}</span></div>
                                <div>ประเภทคำขอ: <span className="font-medium text-slate-700">{getRequesterRequestTypeLabel(requisition.requestType)}</span></div>
                                <div>เอกสารปลายทาง: <span className="font-medium text-slate-700">{getRequesterFulfillmentTypeLabel(requisition.fulfillmentType)}</span></div>
                                <div>วันที่สร้าง: <span className="font-medium text-slate-700">{formatDateThai(requisition.createdAt)}</span></div>
                                <div>วันที่ต้องการใช้: <span className="font-medium text-slate-700">{requisition.requiredDate || "-"}</span></div>
                            </div>

                            <p className="mt-3 text-xs text-slate-500">{statusMeta.description}</p>

                            <div className="mt-4 flex items-center justify-end text-sm font-semibold text-blue-700">
                                ดูรายละเอียด
                                <ChevronRight size={16} className="ml-1" />
                            </div>
                        </Link>
                    );
                })}
            </main>
        </div>
    );
}
