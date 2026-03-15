"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import PriceComparisonDocumentView from "@/components/price-comparison/PriceComparisonDocumentView";
import { usePriceComparisonRecord } from "@/components/price-comparison/usePriceComparisonRecord";

export default function PriceComparisonDocumentPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { comparison, sourceRequisition, companySettings, loading, missing } = usePriceComparisonRecord(resolvedParams.id);

    useEffect(() => {
        if (missing) {
            router.push("/price-comparisons");
        }
    }, [missing, router]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-slate-500">กำลังโหลดเอกสารเทียบราคา...</p>
            </div>
        );
    }

    if (!comparison) return null;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between print:hidden">
                <div className="flex items-center gap-4">
                    <Link href={`/price-comparisons/${comparison.id}`} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">แบบเอกสารเปรียบเทียบราคา</h1>
                        <p className="mt-1 text-sm text-slate-500">{comparison.comparisonNumber}</p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                    <Printer size={16} className="mr-2" />
                    พิมพ์ / PDF
                </button>
            </div>

            <PriceComparisonDocumentView
                comparison={comparison}
                sourceRequisition={sourceRequisition}
                companySettings={companySettings}
                showBackLink
            />
        </div>
    );
}
