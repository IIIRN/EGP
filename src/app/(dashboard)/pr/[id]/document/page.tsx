"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import PurchaseRequisitionDocumentView from "@/components/pr/PurchaseRequisitionDocumentView";
import { usePurchaseRequisitionRecord } from "@/components/pr/usePurchaseRequisitionRecord";

export default function PurchaseRequisitionDocumentPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { requisition, companySettings, loading, missing } = usePurchaseRequisitionRecord(resolvedParams.id);

    useEffect(() => {
        if (missing) {
            router.push("/pr");
        }
    }, [missing, router]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-slate-500">กำลังโหลดแบบเอกสาร PR...</p>
            </div>
        );
    }

    if (!requisition) return null;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between print:hidden">
                <div className="flex items-center gap-4">
                    <Link href={`/pr/${requisition.id}`} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">แบบเอกสารใบคำขอซื้อ / ขอจ้าง</h1>
                        <p className="mt-1 text-sm text-slate-500">{requisition.prNumber}</p>
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

            <PurchaseRequisitionDocumentView
                requisition={requisition}
                companySettings={companySettings}
                showBackLink
            />
        </div>
    );
}
