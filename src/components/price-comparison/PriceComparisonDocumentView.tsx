"use client";

import Link from "next/link";
import {
    ComparisonMatrix,
    DocumentMetaGrid,
    DocumentSection,
    DocumentStatus,
    PriceComparisonDocumentShell,
    formatDocumentDate,
    formatMoney,
    getFulfillmentTypeLabel,
    getRequestTypeLabel,
    type PriceComparisonCompanySettings,
} from "@/components/price-comparison/PriceComparisonDocument";
import { getPriceComparisonStatusMeta, getRecommendationTypeLabel } from "@/lib/priceComparison";
import type { PriceComparison } from "@/types/priceComparison";
import type { PurchaseRequisition } from "@/types/pr";

type PriceComparisonDocumentViewProps = {
    comparison: PriceComparison;
    sourceRequisition: PurchaseRequisition | null;
    companySettings?: PriceComparisonCompanySettings | null;
    showBackLink?: boolean;
    backHref?: string;
};

function getStatusTone(status?: string) {
    if (status === "approved") return "success";
    if (status === "pending_approval") return "warning";
    if (status === "rejected") return "danger";
    return "neutral";
}

export default function PriceComparisonDocumentView({
    comparison,
    sourceRequisition,
    companySettings,
    showBackLink = false,
    backHref = `/price-comparisons/${comparison.id}`,
}: PriceComparisonDocumentViewProps) {
    const statusMeta = getPriceComparisonStatusMeta(comparison.status);
    const matrixQuotes = [...comparison.quotes].sort((left, right) => (left.overallRank || 999) - (right.overallRank || 999));
    const recommendedQuoteId = comparison.recommendedQuoteId || comparison.autoRecommendedQuoteId || "";

    return (
        <PriceComparisonDocumentShell
            companySettings={companySettings}
            title="เอกสารเปรียบเทียบราคา"
            subtitle={`เอกสารสรุปเพื่อประกอบการอนุมัติและออก ${comparison.fulfillmentType === "wc" ? "Work Contract" : "Purchase Order"}`}
            documentNumber={comparison.comparisonNumber}
            headerAside={<DocumentStatus label={statusMeta.label} tone={getStatusTone(comparison.status)} />}
        >
            <DocumentSection title="ข้อมูลอ้างอิง">
                <DocumentMetaGrid
                    items={[
                        { label: "เลขที่เอกสาร", value: comparison.comparisonNumber },
                        { label: "PR ต้นทาง", value: comparison.prNumber || "-" },
                        { label: "ประเภทคำขอ", value: getRequestTypeLabel(comparison.requestType) },
                        { label: "วันที่จัดทำ", value: formatDocumentDate(comparison.createdAt) },
                    ]}
                />
            </DocumentSection>

            <DocumentSection title="ขอบเขตงานและเหตุผล">
                <div className="grid gap-2 md:grid-cols-2">
                    <div className="border border-slate-300 bg-white p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">หัวข้อ</p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">{comparison.title}</p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                            {sourceRequisition?.reason || "-"}
                        </p>
                    </div>
                    <div className="border border-slate-300 bg-white p-4 text-sm">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">ผู้ขอ</p>
                            <p className="mt-1 font-semibold text-slate-950">{comparison.requestedByName || comparison.requestedByUid || "-"}</p>
                        </div>
                        <div className="mt-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">เอกสารปลายทาง</p>
                            <p className="mt-1 font-semibold text-slate-950">{getFulfillmentTypeLabel(comparison.fulfillmentType)}</p>
                        </div>
                        <div className="mt-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">เกณฑ์การตัดสิน</p>
                            <p className="mt-1 font-semibold text-slate-950">{getRecommendationTypeLabel(comparison.recommendationType)}</p>
                        </div>
                        <div className="mt-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">มูลค่า PR อ้างอิง</p>
                            <p className="mt-1 font-semibold text-slate-950">{formatMoney(Number(sourceRequisition?.totalAmount || 0))}</p>
                        </div>
                    </div>
                </div>
            </DocumentSection>

            <DocumentSection title="ตารางเปรียบเทียบราคา">
                <ComparisonMatrix quotes={matrixQuotes} recommendedQuoteId={recommendedQuoteId} />
            </DocumentSection>

            <DocumentSection title="สรุปผลเสนออนุมัติ">
                <div className="grid gap-2 md:grid-cols-2">
                    <div className="border border-slate-300 bg-white p-4 text-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">ผู้เสนอที่ได้รับคัดเลือก</p>
                        <p className="mt-2 text-base font-semibold text-slate-950">{comparison.recommendedSupplierName || "-"}</p>
                        <p className="mt-3 text-sm text-slate-600">
                            มูลค่าที่เลือก {formatMoney(Number(comparison.recommendedTotalAmount || 0))}
                        </p>
                    </div>
                    <div className="border border-slate-300 bg-white p-4 text-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">เหตุผลประกอบการเลือก</p>
                        <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-700">
                            {comparison.recommendationReason || "-"}
                        </p>
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
