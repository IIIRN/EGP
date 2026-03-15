"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import PurchaseRequisitionForm from "@/components/pr/PurchaseRequisitionForm";
import { db } from "@/lib/firebase";
import type { PurchaseRequisition } from "@/types/pr";

export default function EditPurchaseRequisitionPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [requisition, setRequisition] = useState<PurchaseRequisition | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchRequisition() {
            try {
                const requisitionRef = doc(db, "purchase_requisitions", resolvedParams.id);
                const requisitionSnap = await getDoc(requisitionRef);

                if (!requisitionSnap.exists()) {
                    alert("ไม่พบข้อมูลใบขอซื้อ/ขอจ้าง");
                    router.push("/pr");
                    return;
                }

                const data = { id: requisitionSnap.id, ...requisitionSnap.data() } as PurchaseRequisition;
                if (data.status !== "draft" && data.status !== "rejected") {
                    alert("ใบขอซื้อ/ขอจ้างนี้อยู่ในสถานะที่ไม่สามารถแก้ไขได้");
                    router.push(`/pr/${data.id}`);
                    return;
                }

                setRequisition(data);
            } catch (error) {
                console.error("Error loading PR for edit:", error);
                alert("ไม่สามารถโหลดข้อมูลสำหรับแก้ไขได้");
                router.push("/pr");
            } finally {
                setLoading(false);
            }
        }

        void fetchRequisition();
    }, [resolvedParams.id, router]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="animate-spin w-8 h-8 text-indigo-600 mb-4" />
                <p className="text-slate-500">กำลังโหลดข้อมูลใบขอซื้อ/ขอจ้าง...</p>
            </div>
        );
    }

    if (!requisition) return null;

    return <PurchaseRequisitionForm mode="edit" requisition={requisition} requisitionId={resolvedParams.id} />;
}
