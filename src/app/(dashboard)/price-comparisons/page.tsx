"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Eye, FileSearch, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import { useProject } from "@/context/ProjectContext";
import type { PriceComparison } from "@/types/priceComparison";
import { getPriceComparisonStatusMeta } from "@/lib/priceComparison";

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

export default function PriceComparisonListPage() {
    const { currentProject } = useProject();
    const [comparisons, setComparisons] = useState<PriceComparison[] | null>(null);
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (!currentProject) return;

        const comparisonQuery = query(
            collection(db, "pr_price_comparisons"),
            where("projectId", "==", currentProject.id)
        );

        const unsubscribe = onSnapshot(comparisonQuery, (snapshot) => {
            const nextData: PriceComparison[] = [];
            snapshot.forEach((docSnap) => {
                nextData.push({ id: docSnap.id, ...docSnap.data() } as PriceComparison);
            });

            nextData.sort((left, right) => getCreatedAtMillis(right.createdAt) - getCreatedAtMillis(left.createdAt));
            setComparisons(nextData);
        });

        return () => unsubscribe();
    }, [currentProject]);

    const filtered = (comparisons || []).filter((comparison) => {
        const term = search.trim().toLowerCase();
        return (
            !term ||
            comparison.comparisonNumber.toLowerCase().includes(term) ||
            (comparison.prNumber || "").toLowerCase().includes(term) ||
            comparison.title.toLowerCase().includes(term) ||
            (comparison.recommendedSupplierName || "").toLowerCase().includes(term)
        );
    });

    if (!currentProject) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
                <FileSearch className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                <h3 className="text-lg font-medium text-slate-900">กรุณาเลือกโครงการก่อน</h3>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">เอกสารเทียบราคา (PC)</h1>
                <p className="mt-1 text-sm text-slate-500">
                    โครงการ: <span className="font-semibold text-indigo-600">{currentProject.name}</span>
                </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-4">
                    <div className="relative max-w-sm">
                        <Search className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="ค้นหาเลขที่ PC, PR, หัวข้อ หรือผู้ที่ถูกเสนอ..."
                            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">เลขที่ PC</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">PR</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">หัวข้อ</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">ผู้เสนอแนะ</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">ยอดที่เลือก</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">สถานะ</th>
                                <th className="px-6 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {comparisons === null ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                        กำลังโหลดข้อมูล...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                        ยังไม่พบเอกสารเทียบราคา
                                    </td>
                                </tr>
                            ) : filtered.map((comparison) => {
                                const statusMeta = getPriceComparisonStatusMeta(comparison.status);

                                return (
                                    <tr key={comparison.id} className="transition-colors hover:bg-slate-50">
                                        <td className="px-6 py-4 text-sm font-semibold text-indigo-600">{comparison.comparisonNumber}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{comparison.prNumber || "-"}</td>
                                        <td className="px-6 py-4 text-sm text-slate-900">{comparison.title}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{comparison.recommendedSupplierName || "-"}</td>
                                        <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                                            ฿ {Number(comparison.recommendedTotalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusMeta.color}`}>
                                                {statusMeta.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                href={`/price-comparisons/${comparison.id}`}
                                                className="inline-flex rounded-lg border border-transparent p-1.5 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                                            >
                                                <Eye size={18} />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
