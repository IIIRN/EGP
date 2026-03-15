"use client";

import type { PurchaseRequisition, PurchaseRequisitionItem } from "@/types/pr";
import { formatMoney } from "@/components/price-comparison/PriceComparisonDocument";

export function getPurchaseRequisitionRequestTypeLabel(requestType?: string) {
    return requestType === "service" ? "ขอจ้าง / ขอรับบริการ" : "ขอซื้อวัสดุ";
}

export function getPurchaseRequisitionUrgencyLabel(urgency?: string) {
    switch (urgency) {
        case "low":
            return "ต่ำ";
        case "normal":
            return "ปกติ";
        case "high":
            return "สูง";
        case "urgent":
            return "เร่งด่วน";
        default:
            return urgency || "-";
    }
}

export function formatPurchaseRequisitionRequiredDate(value?: string) {
    if (!value) return "-";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("th-TH");
}

export function getPurchaseRequisitionStatusTone(status?: string) {
    switch (status) {
        case "approved_for_sourcing":
        case "selected":
        case "converted_partial":
        case "converted_full":
            return "success" as const;
        case "pending_need_approval":
        case "selection_pending":
            return "warning" as const;
        case "rejected":
        case "cancelled":
            return "danger" as const;
        case "sourcing":
        case "comparing":
            return "info" as const;
        case "draft":
        default:
            return "neutral" as const;
    }
}

export function PurchaseRequisitionItemsTable({ items }: { items: PurchaseRequisitionItem[] }) {
    return (
        <div className="overflow-hidden border border-slate-300">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-100">
                        <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                            <th className="px-4 py-3">ลำดับ</th>
                            <th className="px-4 py-3">รายละเอียด</th>
                            <th className="px-4 py-3">จำนวน</th>
                            <th className="px-4 py-3">หน่วย</th>
                            <th className="px-4 py-3 text-right">ราคา/หน่วย</th>
                            <th className="px-4 py-3 text-right">รวม</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                                    ยังไม่มีรายการในเอกสารนี้
                                </td>
                            </tr>
                        ) : items.map((item, index) => (
                            <tr key={item.id}>
                                <td className="px-4 py-3 text-sm text-slate-500">{index + 1}</td>
                                <td className="px-4 py-3 text-sm text-slate-900">
                                    <p className="font-medium">{item.description}</p>
                                    {item.category ? (
                                        <p className="mt-1 text-xs text-slate-500">หมวดหมู่: {item.category}</p>
                                    ) : null}
                                    {item.notes ? (
                                        <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{item.notes}</p>
                                    ) : null}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">{Number(item.quantity || 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{item.unit || "-"}</td>
                                <td className="px-4 py-3 text-right text-sm text-slate-900">{formatMoney(Number(item.unitPrice || 0))}</td>
                                <td className="px-4 py-3 text-right text-sm font-semibold text-slate-950">{formatMoney(Number(item.amount || 0))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function PurchaseRequisitionTotalsSummary({
    requisition,
    className = "",
}: {
    requisition: Pick<PurchaseRequisition, "subTotal" | "vatRate" | "vatAmount" | "totalAmount">;
    className?: string;
}) {
    return (
        <div className={`space-y-3 ${className}`.trim()}>
            <div className="flex items-center justify-between text-sm text-slate-600">
                <span>ยอดรวมก่อนภาษี</span>
                <span className="font-medium text-slate-950">{formatMoney(Number(requisition.subTotal || 0))}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600">
                <span>ภาษีมูลค่าเพิ่ม (VAT {Number(requisition.vatRate || 0)}%)</span>
                <span className="font-medium text-slate-950">{formatMoney(Number(requisition.vatAmount || 0))}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base">
                <span className="font-semibold text-slate-950">มูลค่ารวมทั้งสิ้น</span>
                <span className="font-bold text-slate-950">{formatMoney(Number(requisition.totalAmount || 0))}</span>
            </div>
        </div>
    );
}
