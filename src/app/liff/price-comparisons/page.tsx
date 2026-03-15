"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, FileSearch, Loader2, Search } from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { db } from "@/lib/firebase";
import { getPriceComparisonStatusMeta } from "@/lib/priceComparison";
import type { PriceComparison } from "@/types/priceComparison";
import {
    canSeeAllProjectDocuments,
    formatDateThai,
    formatMoney,
    getTimestampMillis,
} from "@/app/liff/_lib/documentHelpers";

export default function LiffPriceComparisonListPage() {
    const { user, userProfile } = useAuth();
    const { currentProject } = useProject();

    const [comparisons, setComparisons] = useState<PriceComparison[] | null>(null);
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (!currentProject) return;

        const unsubscribe = onSnapshot(query(
            collection(db, "pr_price_comparisons"),
            where("projectId", "==", currentProject.id)
        ), (snapshot) => {
            const canSeeAll = canSeeAllProjectDocuments(userProfile?.role);
            const nextComparisons = snapshot.docs
                .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as PriceComparison)
                .filter((comparison) => {
                    if (canSeeAll) return true;
                    return comparison.createdBy === user?.uid || comparison.requestedByUid === user?.uid;
                })
                .sort((left, right) => getTimestampMillis(right.createdAt) - getTimestampMillis(left.createdAt));

            setComparisons(nextComparisons);
        });

        return () => unsubscribe();
    }, [currentProject, user?.uid, userProfile?.role]);

    const filteredComparisons = (comparisons || []).filter((comparison) => {
        const searchValue = search.trim().toLowerCase();
        return !searchValue ||
            comparison.comparisonNumber.toLowerCase().includes(searchValue) ||
            (comparison.prNumber || "").toLowerCase().includes(searchValue) ||
            comparison.title.toLowerCase().includes(searchValue) ||
            (comparison.recommendedSupplierName || "").toLowerCase().includes(searchValue);
    });

    if (!currentProject) {
        return (
            <div className="min-h-screen bg-slate-100 p-4">
                <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
                    <FileSearch className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                    <h1 className="text-lg font-semibold text-slate-900">ยังไม่ได้เลือกโครงการ</h1>
                    <p className="mt-2 text-sm text-slate-500">กลับไปหน้า LIFF หลักเพื่อเลือกโครงการก่อนดูรายการ PC</p>
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
                        <h1 className="truncate text-base font-semibold text-slate-900">Price Comparisons</h1>
                        <p className="truncate text-xs text-slate-500">{currentProject.name}</p>
                    </div>
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
                            placeholder="Search PC, PR, title, supplier"
                            className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-9 pr-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {comparisons === null && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
                        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
                        <p className="text-sm text-slate-500">Loading price comparisons...</p>
                    </div>
                )}

                {comparisons !== null && filteredComparisons.length === 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
                        <FileSearch className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                        <h2 className="text-lg font-semibold text-slate-900">No PC found</h2>
                        <p className="mt-2 text-sm text-slate-500">There is no comparison document matching the current filter</p>
                    </div>
                )}

                {filteredComparisons.map((comparison) => {
                    const statusMeta = getPriceComparisonStatusMeta(comparison.status);

                    return (
                        <Link
                            key={comparison.id}
                            href={`/liff/price-comparisons/${comparison.id}`}
                            className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900">{comparison.comparisonNumber}</p>
                                    <h2 className="mt-1 line-clamp-2 text-base font-semibold text-slate-900">{comparison.title}</h2>
                                </div>
                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.color}`}>
                                    {statusMeta.label}
                                </span>
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
                                <div>PR: <span className="font-medium text-slate-700">{comparison.prNumber || "-"}</span></div>
                                <div>Selected Amount: <span className="font-medium text-slate-700">{formatMoney(comparison.recommendedTotalAmount)}</span></div>
                                <div>Recommended Supplier: <span className="font-medium text-slate-700">{comparison.recommendedSupplierName || "-"}</span></div>
                                <div>Recommendation Rule: <span className="font-medium text-slate-700">{comparison.recommendationType}</span></div>
                                <div>Created: <span className="font-medium text-slate-700">{formatDateThai(comparison.createdAt)}</span></div>
                                <div>Requester: <span className="font-medium text-slate-700">{comparison.requestedByName || comparison.requestedByUid || "-"}</span></div>
                            </div>

                            <div className="mt-4 flex items-center justify-end text-sm font-semibold text-blue-700">
                                Open Detail
                                <ChevronRight size={16} className="ml-1" />
                            </div>
                        </Link>
                    );
                })}
            </main>
        </div>
    );
}
