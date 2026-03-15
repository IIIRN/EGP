"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PurchaseRequisition } from "@/types/pr";
import type { PriceComparison } from "@/types/priceComparison";
import type { PriceComparisonCompanySettings } from "@/components/price-comparison/PriceComparisonDocument";

type FirestoreTimestampLike = {
    toDate?: () => Date;
    seconds?: number;
};

type UsePurchaseRequisitionRecordResult = {
    requisition: PurchaseRequisition | null;
    comparisons: PriceComparison[];
    companySettings: PriceComparisonCompanySettings | null;
    loading: boolean;
    missing: boolean;
};

function getCreatedAtMillis(value: unknown) {
    if (!value || typeof value !== "object") return 0;

    const timestamp = value as FirestoreTimestampLike;
    if (typeof timestamp.toDate === "function") return timestamp.toDate().getTime();
    if (typeof timestamp.seconds === "number") return timestamp.seconds * 1000;
    return 0;
}

export function usePurchaseRequisitionRecord(id: string): UsePurchaseRequisitionRecordResult {
    const [requisition, setRequisition] = useState<PurchaseRequisition | null>(null);
    const [comparisons, setComparisons] = useState<PriceComparison[]>([]);
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

        const requisitionRef = doc(db, "purchase_requisitions", id);
        const unsubscribe = onSnapshot(
            requisitionRef,
            (snapshot) => {
                if (!snapshot.exists()) {
                    setRequisition(null);
                    setMissing(true);
                    setLoading(false);
                    return;
                }

                setRequisition({ id: snapshot.id, ...snapshot.data() } as PurchaseRequisition);
                setMissing(false);
                setLoading(false);
            },
            (error) => {
                console.error("Error loading PR detail:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [id]);

    useEffect(() => {
        if (!id) return;

        const comparisonQuery = query(collection(db, "pr_price_comparisons"), where("prId", "==", id));
        const unsubscribe = onSnapshot(
            comparisonQuery,
            (snapshot) => {
                const nextComparisons: PriceComparison[] = [];
                snapshot.forEach((docSnap) => {
                    nextComparisons.push({ id: docSnap.id, ...docSnap.data() } as PriceComparison);
                });
                nextComparisons.sort((left, right) => getCreatedAtMillis(right.createdAt) - getCreatedAtMillis(left.createdAt));
                setComparisons(nextComparisons);
            },
            (error) => {
                console.error("Error loading PR comparisons:", error);
            }
        );

        return () => unsubscribe();
    }, [id]);

    return {
        requisition,
        comparisons,
        companySettings,
        loading,
        missing,
    };
}
