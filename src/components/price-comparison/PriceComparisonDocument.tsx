"use client";

/* eslint-disable @next/next/no-img-element */

import type { ReactNode } from "react";
import type {
    ComparisonSupplierQuote,
    ComparisonSupplierQuoteItem,
    PriceComparison,
} from "@/types/priceComparison";
import type { PurchaseRequisitionApprovalAction } from "@/types/pr";

export type PriceComparisonCompanySettings = {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    logoUrl?: string;
};

type DocumentShellProps = {
    companySettings?: PriceComparisonCompanySettings | null;
    title: string;
    subtitle?: string;
    documentNumber?: string;
    documentBadge?: string;
    headerAside?: ReactNode;
    children: ReactNode;
};

type MetaItem = {
    label: string;
    value: ReactNode;
};

type MetricItem = {
    label: string;
    value: ReactNode;
    helper?: ReactNode;
};

type ComparisonMatrixProps = {
    quotes: ComparisonSupplierQuote[];
    recommendedQuoteId?: string;
};

type QuoteSectionProps = {
    quote: ComparisonSupplierQuote;
    index: number;
    recommendedQuoteId?: string;
    summarySlot?: ReactNode;
    bodySlot?: ReactNode;
};

type QuoteItemsTableProps = {
    items: ComparisonSupplierQuoteItem[];
    editable?: boolean;
    renderUnitPrice?: (item: ComparisonSupplierQuoteItem) => ReactNode;
    renderRemark?: (item: ComparisonSupplierQuoteItem) => ReactNode;
    renderCompliance?: (item: ComparisonSupplierQuoteItem) => ReactNode;
};

type ApprovalTrailTableProps = {
    approvalTrail?: PurchaseRequisitionApprovalAction[];
};

type DocumentStatusProps = {
    label: string;
    tone?: "neutral" | "info" | "success" | "warning" | "danger";
};

type TimestampLike = {
    toDate?: () => Date;
    seconds?: number;
};

function formatDateFromTimestamp(value: unknown) {
    if (value && typeof value === "object" && "toDate" in value) {
        const timestamp = value as TimestampLike;
        if (typeof timestamp.toDate === "function") {
            return timestamp.toDate();
        }
    }

    if (value instanceof Date) return value;
    if (typeof value === "string" && value) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    if (value && typeof value === "object" && "seconds" in value) {
        const timestamp = value as TimestampLike;
        if (typeof timestamp.seconds === "number") {
            return new Date(timestamp.seconds * 1000);
        }
    }

    return null;
}

export function formatDocumentDate(value: unknown) {
    const parsed = formatDateFromTimestamp(value);
    if (!parsed) return "-";
    return parsed.toLocaleDateString("th-TH");
}

export function formatDocumentDateTime(value: unknown) {
    const parsed = formatDateFromTimestamp(value);
    if (!parsed) return "-";
    return parsed.toLocaleString("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

export function formatMoney(value: number) {
    return `฿ ${Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

export function getVatModeLabel(mode?: string) {
    switch (mode) {
        case "none":
            return "ไม่มี VAT";
        case "inclusive":
            return "VAT รวมในราคา";
        case "exclusive":
        default:
            return "VAT แยกจากราคา";
    }
}

export function getRequestTypeLabel(type?: string) {
    return type === "service" ? "ขอจ้าง / ขอรับบริการ" : "ขอซื้อวัสดุ";
}

export function getFulfillmentTypeLabel(type?: string) {
    return type === "wc" ? "ออก Work Contract" : "ออก Purchase Order";
}

export function getComplianceLabel(items: ComparisonSupplierQuoteItem[]) {
    if (!items.length) return "ยังไม่มีรายการ";
    const failedCount = items.filter((item) => item.isCompliant === false).length;
    if (failedCount === 0) return "ผ่านครบทุกข้อ";
    return `ไม่ผ่าน ${failedCount} รายการ`;
}

export function getDocumentStatusTone(status?: string): DocumentStatusProps["tone"] {
    switch (status) {
        case "approved":
            return "success";
        case "pending":
        case "pending_approval":
            return "warning";
        case "rejected":
            return "danger";
        case "draft":
        default:
            return "neutral";
    }
}

export function getApprovalStatusLabel(status?: string) {
    switch (status) {
        case "approved":
            return "อนุมัติแล้ว";
        case "rejected":
            return "ไม่อนุมัติ";
        case "pending":
            return "รออนุมัติ";
        case "skipped":
            return "ข้ามขั้นตอน";
        default:
            return status || "-";
    }
}

export function getSelectedQuote(
    comparison: Pick<PriceComparison, "quotes" | "recommendedQuoteId" | "autoRecommendedQuoteId">
) {
    const quoteId = comparison.recommendedQuoteId || comparison.autoRecommendedQuoteId || "";
    return comparison.quotes.find((quote) => quote.id === quoteId) || null;
}

export function DocumentStatus({ label, tone = "neutral" }: DocumentStatusProps) {
    const toneClass =
        tone === "success"
            ? "border-emerald-300 bg-white text-emerald-700"
            : tone === "warning"
                ? "border-amber-300 bg-white text-amber-700"
                : tone === "danger"
                    ? "border-rose-300 bg-white text-rose-700"
                    : tone === "info"
                        ? "border-sky-300 bg-white text-sky-700"
                        : "border-slate-300 bg-white text-slate-700";

    return (
        <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
            {label}
        </span>
    );
}

export function PriceComparisonDocumentShell({
    companySettings,
    title,
    subtitle,
    documentNumber,
    documentBadge = "PRICE COMPARISON",
    headerAside,
    children,
}: DocumentShellProps) {
    return (
        <div className="overflow-hidden rounded-lg border border-slate-300 bg-white print:rounded-none print:border-0">
            <div className="border-b border-slate-300 bg-white px-6 py-6 md:px-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-slate-300 bg-white">
                            {companySettings?.logoUrl ? (
                                <img src={companySettings.logoUrl} alt="Company logo" className="max-h-12 max-w-12 object-contain" />
                            ) : (
                                <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400">LOGO</span>
                            )}
                        </div>
                        <div className="space-y-2">
                            <div className="space-y-1">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    {documentBadge}
                                </p>
                                <h1 className="text-xl font-semibold text-slate-950 md:text-2xl">
                                    {title}
                                </h1>
                                {subtitle ? (
                                    <p className="max-w-2xl text-sm leading-6 text-slate-600">
                                        {subtitle}
                                    </p>
                                ) : null}
                            </div>

                            <div className="space-y-1 text-sm text-slate-600">
                                <p className="font-semibold text-slate-900">{companySettings?.name || "ข้อมูลบริษัท"}</p>
                                {companySettings?.address ? <p>{companySettings.address}</p> : null}
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                    {companySettings?.phone ? <span>โทรศัพท์ {companySettings.phone}</span> : null}
                                    {companySettings?.email ? <span>Email {companySettings.email}</span> : null}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 lg:items-end">
                        <div className="inline-flex border border-slate-300 bg-white px-4 py-3 text-right">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    Document No.
                                </p>
                                <p className="mt-1 text-base font-semibold text-slate-950">
                                    {documentNumber || "-"}
                                </p>
                            </div>
                        </div>
                        {headerAside}
                    </div>
                </div>
            </div>

            <div className="space-y-6 px-6 py-6 md:px-8 md:py-8 print:px-0 print:py-0">
                {children}
            </div>
        </div>
    );
}

export function DocumentSection({
    title,
    description,
    actions,
    children,
}: {
    title: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h2 className="text-base font-semibold text-slate-950">{title}</h2>
                    {description ? (
                        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
                    ) : null}
                </div>
                {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>
            {children}
        </section>
    );
}

export function DocumentMetaGrid({ items }: { items: MetaItem[] }) {
    return (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
                <div key={item.label} className="border border-slate-300 bg-white p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {item.label}
                    </p>
                    <div className="mt-2 text-sm font-medium text-slate-900">{item.value}</div>
                </div>
            ))}
        </div>
    );
}

export function DocumentMetricGrid({ items }: { items: MetricItem[] }) {
    return (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
                <div key={item.label} className="border border-slate-300 bg-white p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {item.label}
                    </p>
                    <div className="mt-2 text-base font-semibold text-slate-950">
                        {item.value}
                    </div>
                    {item.helper ? (
                        <div className="mt-2 text-xs leading-5 text-slate-500">{item.helper}</div>
                    ) : null}
                </div>
            ))}
        </div>
    );
}

export function ComparisonMatrix({ quotes, recommendedQuoteId }: ComparisonMatrixProps) {
    return (
        <div className="overflow-hidden border border-slate-300">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-100 text-slate-700">
                        <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em]">
                            <th className="px-4 py-3">ผู้เสนอราคา</th>
                            <th className="px-4 py-3">อ้างอิง</th>
                            <th className="px-4 py-3">เครดิต</th>
                            <th className="px-4 py-3">ส่งมอบ</th>
                            <th className="px-4 py-3">VAT</th>
                            <th className="px-4 py-3">Compliance</th>
                            <th className="px-4 py-3 text-right">Subtotal</th>
                            <th className="px-4 py-3 text-right">VAT</th>
                            <th className="px-4 py-3 text-right">Total</th>
                            <th className="px-4 py-3 text-center">Rank</th>
                            <th className="px-4 py-3 text-center">ผลเลือก</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {quotes.length === 0 ? (
                            <tr>
                                <td colSpan={11} className="px-4 py-10 text-center text-sm text-slate-500">
                                    ยังไม่มีผู้เสนอราคา
                                </td>
                            </tr>
                        ) : quotes.map((quote) => {
                            const isRecommended = recommendedQuoteId === quote.id;
                            return (
                                <tr key={quote.id} className={isRecommended ? "bg-slate-50" : ""}>
                                    <td className="px-4 py-3">
                                        <div className="min-w-[180px]">
                                            <p className="text-sm font-semibold text-slate-900">
                                                {quote.supplierName || "-"}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {quote.supplierType === "contractor" ? "ผู้รับจ้าง" : "ผู้ขาย / คู่ค้า"}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{quote.quoteRef || "-"}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{quote.creditDays || 0} วัน</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{quote.deliveryDays || 0} วัน</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{getVatModeLabel(quote.vatMode)}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{getComplianceLabel(quote.items)}</td>
                                    <td className="px-4 py-3 text-right text-sm text-slate-700">{formatMoney(Number(quote.subTotal || 0))}</td>
                                    <td className="px-4 py-3 text-right text-sm text-slate-700">{formatMoney(Number(quote.vatAmount || 0))}</td>
                                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-950">{formatMoney(Number(quote.totalAmount || 0))}</td>
                                    <td className="px-4 py-3 text-center text-sm font-semibold text-slate-900">{quote.overallRank || "-"}</td>
                                    <td className="px-4 py-3 text-center">
                                        {isRecommended ? (
                                            <DocumentStatus label="ผู้เสนอที่เลือก" tone="success" />
                                        ) : (
                                            <span className="text-sm text-slate-400">-</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function QuoteSection({
    quote,
    index,
    recommendedQuoteId,
    summarySlot,
    bodySlot,
}: QuoteSectionProps) {
    const isRecommended = quote.id === recommendedQuoteId;

    return (
        <article className={`overflow-hidden border ${isRecommended ? "border-slate-950" : "border-slate-300"} bg-white`}>
            <div className="border-b border-slate-300 px-4 py-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                ผู้เสนอราคา #{index + 1}
                            </span>
                            {isRecommended ? <DocumentStatus label="ผู้เสนอที่เลือก" tone="success" /> : null}
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-slate-950">
                            {quote.supplierName || "ยังไม่ได้ระบุชื่อผู้เสนอราคา"}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
                            <span>Rank {quote.overallRank || "-"}</span>
                            <span>{quote.quoteRef || "ยังไม่ได้ระบุเลขอ้างอิง"}</span>
                            <span>{getVatModeLabel(quote.vatMode)}</span>
                            <span>เครดิต {quote.creditDays || 0} วัน</span>
                            <span>ส่งมอบ {quote.deliveryDays || 0} วัน</span>
                        </div>
                    </div>
                    <div className="border border-slate-300 bg-white px-4 py-3 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Total Amount
                        </p>
                        <p className="mt-1 text-lg font-semibold text-slate-950">
                            {formatMoney(Number(quote.totalAmount || 0))}
                        </p>
                    </div>
                </div>

                {summarySlot ? <div className="mt-4">{summarySlot}</div> : null}
            </div>

            <div className="space-y-4 p-4">
                {bodySlot}
            </div>
        </article>
    );
}

export function QuoteItemsTable({
    items,
    editable = false,
    renderUnitPrice,
    renderRemark,
    renderCompliance,
}: QuoteItemsTableProps) {
    return (
        <div className="overflow-hidden rounded-lg border border-slate-300">
            <div className="overflow-x-auto">
                <table className="min-w-[920px] w-full divide-y divide-slate-200">
                    <thead className="bg-slate-100">
                        <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                            <th className="min-w-[18rem] px-3 py-2.5">รายการ</th>
                            <th className="w-20 px-3 py-2.5 text-right">จำนวน</th>
                            <th className="w-36 px-3 py-2.5 text-right">ราคาต่อหน่วย</th>
                            <th className="w-32 px-3 py-2.5 text-right">รวม</th>
                            <th className="min-w-[12rem] px-3 py-2.5">หมายเหตุ</th>
                            <th className="w-32 px-3 py-2.5 text-center">Spec</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {items.map((item) => (
                            <tr key={item.id} className="align-top">
                                <td className="px-3 py-2.5">
                                    <p className="text-sm font-medium text-slate-900">{item.description}</p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        อ้างอิง {item.quantity} {item.unit}
                                    </p>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm text-slate-700">{item.quantity}</td>
                                <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm text-slate-700">
                                    {editable && renderUnitPrice ? renderUnitPrice(item) : formatMoney(Number(item.unitPrice || 0))}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm font-semibold text-slate-950">
                                    {formatMoney(Number(item.amount || 0))}
                                </td>
                                <td className="px-3 py-2.5 text-sm text-slate-600">
                                    {editable && renderRemark ? renderRemark(item) : (item.remark || "-")}
                                </td>
                                <td className="px-3 py-2.5 text-center text-sm">
                                    {editable && renderCompliance
                                        ? renderCompliance(item)
                                        : (
                                            <DocumentStatus
                                                label={item.isCompliant === false ? "ไม่ผ่าน" : "ผ่าน"}
                                                tone={item.isCompliant === false ? "danger" : "success"}
                                            />
                                        )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function QuoteTotalsGrid({ quote }: { quote: ComparisonSupplierQuote }) {
    return (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 xl:w-fit">
            <div className="min-w-[7rem] rounded-lg border border-slate-300 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Subtotal</p>
                <p className="mt-1.5 whitespace-nowrap text-base font-semibold text-slate-950">{formatMoney(Number(quote.subTotal || 0))}</p>
            </div>
            <div className="min-w-[7rem] rounded-lg border border-slate-300 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">VAT</p>
                <p className="mt-1.5 whitespace-nowrap text-base font-semibold text-slate-950">{formatMoney(Number(quote.vatAmount || 0))}</p>
            </div>
            <div className="min-w-[7rem] rounded-lg border border-slate-300 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Compliance</p>
                <p className="mt-1.5 text-base font-semibold text-slate-950">{getComplianceLabel(quote.items)}</p>
            </div>
            <div className="min-w-[7rem] rounded-lg border border-slate-950 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Total</p>
                <p className="mt-1.5 whitespace-nowrap text-base font-semibold text-slate-950">{formatMoney(Number(quote.totalAmount || 0))}</p>
            </div>
        </div>
    );
}

export function ApprovalTrailTable({ approvalTrail }: ApprovalTrailTableProps) {
    const rows = Array.isArray(approvalTrail) ? approvalTrail : [];

    return (
        <div className="overflow-hidden border border-slate-300">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-100">
                        <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                            <th className="px-4 py-3">ขั้นตอน</th>
                            <th className="px-4 py-3">ผู้ดำเนินการ</th>
                            <th className="px-4 py-3">บทบาท</th>
                            <th className="px-4 py-3">สถานะ</th>
                            <th className="px-4 py-3">วันที่</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                                    ยังไม่มีประวัติการอนุมัติ
                                </td>
                            </tr>
                        ) : rows.map((step) => (
                            <tr key={`${step.stepKey}-${step.status}`}>
                                <td className="px-4 py-3 text-sm font-medium text-slate-900">{step.stepLabel}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{step.approverName || "-"}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{step.role || "-"}</td>
                                <td className="px-4 py-3">
                                    <DocumentStatus
                                        label={getApprovalStatusLabel(step.status)}
                                        tone={getDocumentStatusTone(step.status)}
                                    />
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">{formatDocumentDateTime(step.actionAt)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
