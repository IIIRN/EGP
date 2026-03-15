export type SupportedDocumentKind = "PO" | "VO" | "WC" | "PR" | "PC";

export const DOC_KIND_COLLECTION: Record<SupportedDocumentKind, string> = {
    PO: "purchase_orders",
    VO: "variation_orders",
    WC: "work_contracts",
    PR: "purchase_requisitions",
    PC: "pr_price_comparisons",
};

export function resolveDocumentKind(rawType: string): SupportedDocumentKind | null {
    const normalized = rawType.trim().replace(/[\s-]+/g, "_").toUpperCase();
    if (normalized === "PO" || normalized === "PURCHASE_ORDER" || normalized === "PURCHASE_ORDERS") return "PO";
    if (normalized === "VO" || normalized === "VARIATION_ORDER" || normalized === "VARIATION_ORDERS") return "VO";
    if (normalized === "WC" || normalized === "WORK_CONTRACT" || normalized === "WORK_CONTRACTS") return "WC";
    if (normalized === "PR" || normalized === "PURCHASE_REQUISITION" || normalized === "PURCHASE_REQUISITIONS") return "PR";
    if (normalized === "PC" || normalized === "PRICE_COMPARISON" || normalized === "PRICE_COMPARISONS") return "PC";
    return null;
}

export function getDocumentKindLabel(docKind: SupportedDocumentKind | null): string {
    if (docKind === "PO") return "ใบสั่งซื้อ (PO)";
    if (docKind === "VO") return "งานเพิ่ม-ลด (VO)";
    if (docKind === "WC") return "ใบจ้างงาน (WC)";
    if (docKind === "PR") return "ใบขอซื้อ/ขอจ้าง (PR)";
    if (docKind === "PC") return "เอกสารเทียบราคา (PC)";
    return "-";
}

export function getDocumentNumber(record: {
    comparisonNumber?: unknown;
    poNumber?: unknown;
    voNumber?: unknown;
    wcNumber?: unknown;
    prNumber?: unknown;
}) {
    const candidates = [record.comparisonNumber, record.prNumber, record.poNumber, record.voNumber, record.wcNumber];
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }
    return "-";
}

export function isPendingDocumentStatus(docKind: SupportedDocumentKind, status?: string) {
    if (docKind === "PR") return status === "pending_need_approval";
    if (docKind === "PC") return status === "pending_approval";
    return status === "pending";
}

export function isApprovedDocumentStatus(docKind: SupportedDocumentKind, status?: string) {
    if (docKind === "PR") return status === "approved_for_sourcing";
    if (docKind === "PC") return status === "approved";
    return status === "approved";
}
