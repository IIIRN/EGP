"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PriceComparison } from "@/types/priceComparison";
import type { PurchaseRequisition } from "@/types/pr";
import type { PriceComparisonCompanySettings } from "@/components/price-comparison/PriceComparisonDocument";

type UsePriceComparisonRecordResult = {
    comparison: PriceComparison | null;
    sourceRequisition: PurchaseRequisition | null;
    companySettings: PriceComparisonCompanySettings | null;
    loading: boolean;
    missing: boolean;
};

export function usePriceComparisonRecord(id: string): UsePriceComparisonRecordResult {
    const [comparison, setComparison] = useState<PriceComparison | null>(null);
    const [sourceRequisition, setSourceRequisition] = useState<PurchaseRequisition | null>(null);
    const [companySettings, setCompanySettings] = useState<PriceComparisonCompanySettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [missing, setMissing] = useState(false);

    useEffect(() => {
        let active = true;

        async function fetchCompanySettings() {
            try {
                const configSnap = await getDoc(doc(db, "system_settings", "global_config"));
                if (!active || !configSnap.exists()) return;

                const nextSettings = configSnap.data().companySettings as PriceComparisonCompanySettings | undefined;
                setCompanySettings(nextSettings || null);
            } catch (error) {
                console.error("Error fetching company settings:", error);
            }
        }

        void fetchCompanySettings();
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!id) return;

        const comparisonRef = doc(db, "pr_price_comparisons", id);
        const unsubscribe = onSnapshot(
            comparisonRef,
            (snapshot) => {
                if (!snapshot.exists()) {
                    setComparison(null);
                    setSourceRequisition(null);
                    setMissing(true);
                    setLoading(false);
                    return;
                }

                setComparison({ id: snapshot.id, ...snapshot.data() } as PriceComparison);
                setMissing(false);
                setLoading(false);
            },
            (error) => {
                console.error("Error loading price comparison:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [id]);

    useEffect(() => {
        if (!comparison?.prId) return;

        const requisitionRef = doc(db, "purchase_requisitions", comparison.prId);
        const unsubscribe = onSnapshot(
            requisitionRef,
            (snapshot) => {
                if (!snapshot.exists()) {
                    setSourceRequisition(null);
                    return;
                }

                setSourceRequisition({ id: snapshot.id, ...snapshot.data() } as PurchaseRequisition);
            },
            (error) => {
                console.error("Error loading source PR:", error);
            }
        );

        return () => {
            unsubscribe();
            setSourceRequisition(null);
        };
    }, [comparison?.prId]);

    return {
        comparison,
        sourceRequisition,
        companySettings,
        loading,
        missing,
    };
}
