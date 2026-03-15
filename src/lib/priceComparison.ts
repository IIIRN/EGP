import type {
    ComparisonRecommendationType,
    ComparisonSupplierQuote,
    ComparisonSupplierQuoteItem,
    PriceComparisonApprovalAction,
    PriceComparisonStatus,
} from "@/types/priceComparison";

export const DEFAULT_PC_VAT_RATE = 7;

export function getPriceComparisonStatusMeta(status?: string) {
    switch (status) {
        case "draft":
            return { label: "ฉบับร่าง", color: "bg-slate-100 text-slate-800" };
        case "pending_approval":
            return { label: "รออนุมัติผลเทียบราคา", color: "bg-amber-100 text-amber-800" };
        case "approved":
            return { label: "อนุมัติแล้ว", color: "bg-emerald-100 text-emerald-800" };
        case "rejected":
            return { label: "ไม่อนุมัติ", color: "bg-rose-100 text-rose-800" };
        default:
            return { label: status || "-", color: "bg-slate-100 text-slate-800" };
    }
}

export function getRecommendationTypeLabel(type?: string) {
    switch (type) {
        case "lowest_price":
            return "ราคาต่ำสุด";
        case "best_value":
            return "ความคุ้มค่าที่เหมาะสม";
        case "technical_fit":
            return "ความเหมาะสมทางเทคนิค";
        default:
            return "-";
    }
}

export function isPriceComparisonPendingApproval(status?: string) {
    return status === "pending_approval";
}

export function buildPendingPriceComparisonApprovalTrail(): PriceComparisonApprovalAction[] {
    return [
        {
            stepKey: "comparison_approval",
            stepLabel: "อนุมัติเอกสารเทียบราคา",
            status: "pending",
        },
    ];
}

export function getPriceComparisonDecisionStatus(
    decision: "approved" | "rejected"
): PriceComparisonStatus {
    return decision === "approved" ? "approved" : "rejected";
}

export function finalizePriceComparisonApprovalTrail(params: {
    currentTrail?: PriceComparisonApprovalAction[];
    decision: "approved" | "rejected";
    approverUid?: string;
    approverName?: string;
    role?: string;
    actionAt: unknown;
}) {
    const {
        currentTrail,
        decision,
        approverUid,
        approverName,
        role,
        actionAt,
    } = params;

    const nextStatus = decision === "approved" ? "approved" : "rejected";
    const trail = Array.isArray(currentTrail) && currentTrail.length > 0
        ? [...currentTrail]
        : buildPendingPriceComparisonApprovalTrail();

    const targetIndex = trail.findIndex((step) => step.stepKey === "comparison_approval");
    const nextAction: PriceComparisonApprovalAction = {
        stepKey: "comparison_approval",
        stepLabel: "อนุมัติเอกสารเทียบราคา",
        approverUid,
        approverName,
        role,
        status: nextStatus,
        actionAt,
    };

    if (targetIndex >= 0) {
        trail[targetIndex] = {
            ...trail[targetIndex],
            ...nextAction,
        };
        return trail;
    }

    trail.push(nextAction);
    return trail;
}

function normalizeQuoteItem(item: ComparisonSupplierQuoteItem): ComparisonSupplierQuoteItem {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;

    return {
        ...item,
        quantity,
        unitPrice,
        amount: quantity * unitPrice,
        leadTimeDays: Number(item.leadTimeDays) || 0,
        isCompliant: item.isCompliant !== false,
    };
}

export function computePriceComparisonTotals(
    items: ComparisonSupplierQuoteItem[],
    vatMode: ComparisonSupplierQuote["vatMode"] = "exclusive"
) {
    const vatRate = vatMode === "none" ? 0 : DEFAULT_PC_VAT_RATE;
    const itemsTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const vatAmount = vatMode === "exclusive"
        ? (itemsTotal * DEFAULT_PC_VAT_RATE) / 100
        : vatMode === "inclusive"
            ? (itemsTotal * DEFAULT_PC_VAT_RATE) / (100 + DEFAULT_PC_VAT_RATE)
            : 0;
    const subTotal = vatMode === "inclusive" ? itemsTotal - vatAmount : itemsTotal;
    const totalAmount = vatMode === "exclusive" ? itemsTotal + vatAmount : itemsTotal;

    return {
        vatRate,
        subTotal,
        vatAmount,
        totalAmount,
    };
}

export function rankPriceComparisonQuotes(quotes: ComparisonSupplierQuote[]) {
    const normalizedQuotes = quotes.map((quote) => {
        const items = Array.isArray(quote.items) ? quote.items.map(normalizeQuoteItem) : [];
        const totals = computePriceComparisonTotals(items, quote.vatMode);

        return {
            ...quote,
            items,
            vatRate: totals.vatRate,
            subTotal: totals.subTotal,
            vatAmount: totals.vatAmount,
            totalAmount: totals.totalAmount,
        };
    });

    const sorted = [...normalizedQuotes].sort((left, right) => {
        const leftPenalty = left.items.every((item) => item.isCompliant !== false) ? 0 : 1;
        const rightPenalty = right.items.every((item) => item.isCompliant !== false) ? 0 : 1;

        if (leftPenalty !== rightPenalty) return leftPenalty - rightPenalty;
        if (left.totalAmount !== right.totalAmount) return left.totalAmount - right.totalAmount;
        return (left.deliveryDays || 0) - (right.deliveryDays || 0);
    });

    return normalizedQuotes.map((quote) => ({
        ...quote,
        overallRank: sorted.findIndex((item) => item.id === quote.id) + 1,
    }));
}

export function getAutoRecommendedQuote(quotes: ComparisonSupplierQuote[]) {
    if (!Array.isArray(quotes) || quotes.length === 0) return null;
    const ranked = rankPriceComparisonQuotes(quotes)
        .sort((left, right) => (left.overallRank || 0) - (right.overallRank || 0));

    return ranked[0] || null;
}

export function shouldRequireManualRecommendationReason(params: {
    recommendationType: ComparisonRecommendationType;
    selectedQuoteId?: string;
    autoRecommendedQuoteId?: string;
}) {
    const { recommendationType, selectedQuoteId, autoRecommendedQuoteId } = params;
    if (!selectedQuoteId || !autoRecommendedQuoteId) return false;
    if (recommendationType !== "lowest_price") return true;
    return selectedQuoteId !== autoRecommendedQuoteId;
}
