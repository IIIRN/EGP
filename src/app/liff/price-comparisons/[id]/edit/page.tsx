"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import PriceComparisonForm from "@/components/price-comparison/PriceComparisonForm";
import { db } from "@/lib/firebase";
import type { PriceComparison } from "@/types/priceComparison";

export default function LiffEditPriceComparisonPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();

    const [comparison, setComparison] = useState<PriceComparison | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchComparison() {
            try {
                const comparisonSnap = await getDoc(doc(db, "pr_price_comparisons", resolvedParams.id));
                if (!comparisonSnap.exists()) {
                    router.push("/liff/price-comparisons");
                    return;
                }

                const data = { id: comparisonSnap.id, ...comparisonSnap.data() } as PriceComparison;
                if (data.status !== "draft" && data.status !== "rejected") {
                    router.push(`/liff/price-comparisons/${data.id}`);
                    return;
                }

                setComparison(data);
            } catch (error) {
                console.error("Error loading LIFF PC for edit:", error);
                router.push("/liff/price-comparisons");
            } finally {
                setLoading(false);
            }
        }

        void fetchComparison();
    }, [resolvedParams.id, router]);

    if (loading) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-slate-100 p-8">
                <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-600" />
                <p className="text-sm text-slate-500">Loading comparison...</p>
            </div>
        );
    }

    if (!comparison) return null;

    return (
        <div className="min-h-screen bg-slate-100 p-4 pb-24">
            <PriceComparisonForm
                mode="edit"
                comparison={comparison}
                comparisonId={resolvedParams.id}
                backHref={`/liff/price-comparisons/${resolvedParams.id}`}
                missingRequisitionHref="/liff/price-comparisons"
                redirectAfterSaveBasePath="/liff/price-comparisons"
            />
        </div>
    );
}
