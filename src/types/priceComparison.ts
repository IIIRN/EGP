import type {
    PurchaseRequisitionApprovalAction,
    PurchaseRequisitionFulfillmentType,
    PurchaseRequisitionRequestType,
    PurchaseRequisitionVatMode,
} from "@/types/pr";

export type ComparisonSupplierType = "vendor" | "contractor";
export type PriceComparisonStatus = "draft" | "pending_approval" | "approved" | "rejected";
export type ComparisonRecommendationType = "lowest_price" | "best_value" | "technical_fit";

export interface ComparisonSupplierQuoteItem {
    id: string;
    requisitionItemId: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
    remark?: string;
    leadTimeDays?: number;
    brand?: string;
    isCompliant?: boolean;
}

export interface ComparisonSupplierQuote {
    id: string;
    supplierType: ComparisonSupplierType;
    supplierId: string;
    supplierName: string;
    quotedAt?: string;
    quoteRef?: string;
    vatMode?: PurchaseRequisitionVatMode;
    vatRate?: number;
    creditDays?: number;
    deliveryDays?: number;
    items: ComparisonSupplierQuoteItem[];
    subTotal: number;
    vatAmount: number;
    totalAmount: number;
    note?: string;
    overallRank?: number;
}

export type PriceComparisonApprovalAction = PurchaseRequisitionApprovalAction;

export interface PriceComparison {
    id: string;
    comparisonNumber: string;
    prId: string;
    prNumber?: string;
    projectId: string;
    title: string;
    requestType: PurchaseRequisitionRequestType;
    fulfillmentType: PurchaseRequisitionFulfillmentType;
    requestedByUid?: string;
    requestedByName?: string;
    sourcingBy: string;
    sourcePrStatus?: string;
    quotes: ComparisonSupplierQuote[];
    recommendationType: ComparisonRecommendationType;
    autoRecommendedQuoteId?: string;
    recommendedQuoteId?: string;
    recommendedSupplierType?: ComparisonSupplierType;
    recommendedSupplierId?: string;
    recommendedSupplierName?: string;
    recommendedTotalAmount?: number;
    recommendationReason?: string;
    status: PriceComparisonStatus;
    approvalTrail?: PriceComparisonApprovalAction[];
    createdBy: string;
    createdAt?: unknown;
    updatedAt?: unknown;
}
