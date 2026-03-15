"use client";

import Link from "next/link";
import {
    DocumentSection,
    DocumentStatus,
    PriceComparisonDocumentShell,
    formatMoney,
    getFulfillmentTypeLabel,
    type PriceComparisonCompanySettings,
} from "@/components/price-comparison/PriceComparisonDocument";
import { getPurchaseRequisitionStatusMeta } from "@/lib/purchaseRequisition";
import type { PurchaseRequisition } from "@/types/pr";
import {
    PurchaseRequisitionItemsTable,
    PurchaseRequisitionTotalsSummary,
    getPurchaseRequisitionStatusTone,
    getPurchaseRequisitionUrgencyLabel,
} from "@/components/pr/PurchaseRequisitionDocument";

type PurchaseRequisitionDocumentViewProps = {
    requisition: PurchaseRequisition;
    companySettings?: PriceComparisonCompanySettings | null;
    showBackLink?: boolean;
    backHref?: string;
};

export default function PurchaseRequisitionDocumentView({
    requisition,
    companySettings,
    showBackLink = false,
    backHref = `/pr/${requisition.id}`,
}: PurchaseRequisitionDocumentViewProps) {
    const statusMeta = getPurchaseRequisitionStatusMeta(requisition.status);

    return (
        <PriceComparisonDocumentShell
            companySettings={companySettings}
            title="ใบคำขอซื้อ / ขอจ้าง"
            subtitle={`เอกสารต้นทางสำหรับการ${requisition.fulfillmentType === "wc" ? "ว่าจ้าง" : "สั่งซื้อ"}และดำเนินการจัดหาต่อไป`}
            documentNumber={requisition.prNumber}
            documentBadge="PURCHASE REQUISITION"
            headerAside={<DocumentStatus label={statusMeta.label} tone={getPurchaseRequisitionStatusTone(requisition.status)} />}
        >
            <DocumentSection title="รายละเอียดคำขอ">
                <div className="grid gap-2 md:grid-cols-[1.35fr,0.65fr]">
                    <div className="border border-slate-300 bg-white p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">หัวข้อคำขอ</p>
                        <p className="mt-2 text-base font-semibold text-slate-950">{requisition.title}</p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{requisition.reason || "-"}</p>
                    </div>
                    <div className="border border-slate-300 bg-white p-4 text-sm text-slate-700">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">สรุปเอกสาร</p>
                        <div className="mt-3 space-y-3">
                            <p>สถานะปัจจุบัน: <span className="font-semibold text-slate-950">{statusMeta.label}</span></p>
                            <p>ปลายทางการดำเนินการ: <span className="font-semibold text-slate-950">{getFulfillmentTypeLabel(requisition.fulfillmentType)}</span></p>
                            <p>ความเร่งด่วน: <span className="font-semibold text-slate-950">{getPurchaseRequisitionUrgencyLabel(requisition.urgency)}</span></p>
                            <p>มูลค่าประมาณการ: <span className="font-semibold text-slate-950">{formatMoney(Number(requisition.totalAmount || 0))}</span></p>
                        </div>
                    </div>
                </div>
            </DocumentSection>

            <DocumentSection title="รายการที่ขอซื้อ / ขอจ้าง">
                <PurchaseRequisitionItemsTable items={requisition.items} />
            </DocumentSection>

            <DocumentSection title="สรุปมูลค่า">
                <div className="flex justify-end">
                    <div className="w-full max-w-md border border-slate-300 bg-white p-4">
                        <PurchaseRequisitionTotalsSummary requisition={requisition} />
                    </div>
                </div>
            </DocumentSection>

            {showBackLink ? (
                <div className="print:hidden">
                    <Link href={backHref} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                        กลับไปหน้าข้อมูล
                    </Link>
                </div>
            ) : null}
        </PriceComparisonDocumentShell>
    );
}
