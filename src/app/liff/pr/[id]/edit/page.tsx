"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import PurchaseRequisitionForm from "@/components/pr/PurchaseRequisitionForm";
import { db } from "@/lib/firebase";
import type { PurchaseRequisition } from "@/types/pr";

export default function LiffEditPurchaseRequisitionPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();

    const [requisition, setRequisition] = useState<PurchaseRequisition | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchRequisition() {
            try {
                const requisitionSnap = await getDoc(doc(db, "purchase_requisitions", resolvedParams.id));
                if (!requisitionSnap.exists()) {
                    router.push("/liff/pr");
                    return;
                }

                const data = { id: requisitionSnap.id, ...requisitionSnap.data() } as PurchaseRequisition;
                if (data.status !== "draft" && data.status !== "rejected") {
                    router.push(`/liff/pr/${data.id}`);
                    return;
                }

                setRequisition(data);
            } catch (error) {
                console.error("Error loading LIFF PR for edit:", error);
                router.push("/liff/pr");
            } finally {
                setLoading(false);
            }
        }

        void fetchRequisition();
    }, [resolvedParams.id, router]);

    if (loading) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-slate-100 p-8">
                <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-600" />
                <p className="text-sm text-slate-500">กำลังโหลดข้อมูล PR...</p>
            </div>
        );
    }

    if (!requisition) return null;

    return (
        <div className="min-h-screen bg-slate-100 p-4 pb-24">
            <PurchaseRequisitionForm
                mode="edit"
                requisition={requisition}
                requisitionId={resolvedParams.id}
                backHref={`/liff/pr/${resolvedParams.id}`}
                projectFallbackHref="/liff/pr"
                redirectAfterSaveBasePath="/liff/pr"
            />
        </div>
    );
}
