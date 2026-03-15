"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import type { PriceComparison } from "@/types/priceComparison";
import PriceComparisonForm from "@/components/price-comparison/PriceComparisonForm";

export default function EditPriceComparisonPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [comparison, setComparison] = useState<PriceComparison | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchComparison() {
            try {
                const comparisonSnap = await getDoc(doc(db, "pr_price_comparisons", resolvedParams.id));
                if (!comparisonSnap.exists()) {
                    router.push("/price-comparisons");
                    return;
                }

                const data = { id: comparisonSnap.id, ...comparisonSnap.data() } as PriceComparison;
                if (data.status !== "draft" && data.status !== "rejected") {
                    router.push(`/price-comparisons/${data.id}`);
                    return;
                }

                setComparison(data);
            } catch (error) {
                console.error("Error loading price comparison:", error);
                router.push("/price-comparisons");
            } finally {
                setLoading(false);
            }
        }

        void fetchComparison();
    }, [resolvedParams.id, router]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-slate-500">กำลังโหลดข้อมูลเอกสารเทียบราคา...</p>
            </div>
        );
    }

    if (!comparison) return null;
    return <PriceComparisonForm mode="edit" comparison={comparison} comparisonId={resolvedParams.id} />;
}
