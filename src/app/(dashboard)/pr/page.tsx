"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Eye, FileText, Plus, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import { useProject } from "@/context/ProjectContext";
import type { PurchaseRequisition } from "@/types/pr";
import { getPurchaseRequisitionStatusMeta } from "@/lib/purchaseRequisition";

type UserMap = Record<string, string>;

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

const STATUS_FILTERS = [
    { value: "all", label: "ทั้งหมด" },
    { value: "draft", label: "ฉบับร่าง" },
    { value: "pending_need_approval", label: "รออนุมัติ" },
    { value: "approved_for_sourcing", label: "อนุมัติให้จัดหา" },
    { value: "comparing", label: "กำลังเทียบราคา" },
    { value: "selection_pending", label: "รออนุมัติผลเทียบราคา" },
    { value: "selected", label: "เลือกผู้ขายแล้ว" },
    { value: "converted_full", label: "ออกเอกสารแล้ว" },
    { value: "rejected", label: "ไม่อนุมัติ" },
];

export default function PurchaseRequisitionListingPage() {
    const { currentProject } = useProject();
    const [requisitions, setRequisitions] = useState<PurchaseRequisition[] | null>(null);
    const [usersMap, setUsersMap] = useState<UserMap>({});
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    useEffect(() => {
        if (!currentProject) return;

        const usersUnsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
            const nextMap: UserMap = {};
            snapshot.forEach((userDoc) => {
                const data = userDoc.data() as { displayName?: string; email?: string };
                nextMap[userDoc.id] = data.displayName || data.email || userDoc.id;
            });
            setUsersMap(nextMap);
        });

        const requisitionsQuery = query(
            collection(db, "purchase_requisitions"),
            where("projectId", "==", currentProject.id)
        );
        const requisitionsUnsubscribe = onSnapshot(requisitionsQuery, (snapshot) => {
            const nextData: PurchaseRequisition[] = [];
            snapshot.forEach((docSnap) => {
                nextData.push({ id: docSnap.id, ...docSnap.data() } as PurchaseRequisition);
            });

            nextData.sort((a, b) => getCreatedAtMillis(b.createdAt) - getCreatedAtMillis(a.createdAt));
            setRequisitions(nextData);
        });

        return () => {
            usersUnsubscribe();
            requisitionsUnsubscribe();
        };
    }, [currentProject]);

    const renderedRequisitions = useMemo(() => {
        return (requisitions || []).filter((requisition) => {
            const matchesStatus = statusFilter === "all" || requisition.status === statusFilter;
            const searchValue = search.trim().toLowerCase();
            const matchesSearch =
                !searchValue ||
                requisition.prNumber.toLowerCase().includes(searchValue) ||
                requisition.title.toLowerCase().includes(searchValue) ||
                (requisition.requestedByName || "").toLowerCase().includes(searchValue);

            return matchesStatus && matchesSearch;
        });
    }, [requisitions, search, statusFilter]);

    const activeStatusFilter = STATUS_FILTERS.find((item) => item.value === statusFilter) || STATUS_FILTERS[0];
    const hasActiveFilters = statusFilter !== "all" || search.trim().length > 0;
    const totalRequisitions = requisitions?.length || 0;

    if (!currentProject) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
                <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                <h3 className="mb-2 text-lg font-medium text-slate-900">กรุณาเลือกโครงการก่อน</h3>
                <p>เลือกโครงการจากเมนูด้านบนเพื่อดูรายการ PR ทั้งหมด</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">ใบขอซื้อ / ขอจ้าง (PR)</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        โครงการ: <span className="font-semibold text-indigo-600">{currentProject.name}</span>
                    </p>
                </div>
                <Link
                    href="/pr/create"
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
                >
                    <Plus size={18} className="mr-2" />
                    สร้าง PR ใหม่
                </Link>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="relative w-full max-w-xl">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <Search className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="ค้นหาเลขที่ PR, หัวข้อ หรือผู้ขอ..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            />
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-3">
                                <label htmlFor="pr-status-filter" className="text-sm font-medium text-slate-600">
                                    สถานะ
                                </label>
                                <select
                                    id="pr-status-filter"
                                    value={statusFilter}
                                    onChange={(event) => setStatusFilter(event.target.value)}
                                    className="min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                                >
                                    {STATUS_FILTERS.map((item) => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {hasActiveFilters ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearch("");
                                        setStatusFilter("all");
                                    }}
                                    className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                >
                                    ล้างตัวกรอง
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                        <p>
                            แสดง <span className="font-semibold text-slate-700">{renderedRequisitions.length}</span> จาก{" "}
                            <span className="font-semibold text-slate-700">{totalRequisitions}</span> รายการ
                        </p>
                        {statusFilter !== "all" ? (
                            <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                                สถานะ: {activeStatusFilter.label}
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">เลขที่ PR</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">หัวข้อ</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">ประเภท</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">ผู้ขอ</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">มูลค่ารวม</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">สถานะ</th>
                                <th className="px-6 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {requisitions === null ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                        กำลังโหลดข้อมูล...
                                    </td>
                                </tr>
                            ) : renderedRequisitions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <FileText className="mx-auto h-12 w-12 text-slate-300" />
                                        <h3 className="mt-2 text-sm font-semibold text-slate-900">ไม่พบรายการ PR</h3>
                                        <p className="mt-1 text-sm text-slate-500">ยังไม่มีเอกสารหรือไม่พบข้อมูลตามเงื่อนไขที่เลือก</p>
                                    </td>
                                </tr>
                            ) : (
                                renderedRequisitions.map((requisition) => {
                                    const statusMeta = getPurchaseRequisitionStatusMeta(requisition.status);

                                    return (
                                        <tr key={requisition.id} className="transition-colors hover:bg-slate-50">
                                            <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-indigo-600">{requisition.prNumber}</td>
                                            <td className="px-6 py-4 text-sm text-slate-900">{requisition.title}</td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                                                {requisition.requestType === "material" ? "ขอซื้อ / PO" : "ขอจ้าง / WC"}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                                                {requisition.requestedByName || usersMap[requisition.createdBy] || requisition.createdBy}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-slate-900">
                                                ฿ {(requisition.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-center">
                                                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusMeta.color}`}>
                                                    {statusMeta.label}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                                                <Link
                                                    href={`/pr/${requisition.id}`}
                                                    className="inline-flex rounded-lg border border-transparent p-1.5 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                                                    title="ดูรายละเอียด"
                                                >
                                                    <Eye size={18} />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
