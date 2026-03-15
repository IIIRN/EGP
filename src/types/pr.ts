export type PurchaseRequisitionStatus =
    | "draft"
    | "pending_need_approval"
    | "approved_for_sourcing"
    | "sourcing"
    | "comparing"
    | "selection_pending"
    | "selected"
    | "converted_partial"
    | "converted_full"
    | "rejected"
    | "cancelled";

export type PurchaseRequisitionRequestType = "material" | "service";
export type PurchaseRequisitionFulfillmentType = "po" | "wc";
export type PurchaseRequisitionUrgency = "low" | "normal" | "high" | "urgent";
export type PurchaseRequisitionVatMode = "none" | "exclusive" | "inclusive";

export interface PurchaseRequisitionItem {
    id: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
    category?: string;
    notes?: string;
}

export interface PurchaseRequisitionApprovalAction {
    stepKey: string;
    stepLabel: string;
    approverUid?: string;
    approverName?: string;
    role?: string;
    status: "pending" | "approved" | "rejected" | "skipped";
    actionAt?: unknown;
    comment?: string;
}

export interface PurchaseRequisition {
    id: string;
    prNumber: string;
    projectId: string;
    requestType: PurchaseRequisitionRequestType;
    fulfillmentType: PurchaseRequisitionFulfillmentType;
    title: string;
    requiredDate?: string;
    reason: string;
    urgency: PurchaseRequisitionUrgency;
    items: PurchaseRequisitionItem[];
    subTotal: number;
    vatRate: number;
    vatMode?: PurchaseRequisitionVatMode;
    vatAmount: number;
    totalAmount: number;
    status: PurchaseRequisitionStatus;
    createdBy: string;
    requestedByUid?: string;
    requestedByName?: string;
    currentComparisonId?: string;
    selectedComparisonId?: string;
    selectedSupplierType?: "vendor" | "contractor";
    selectedSupplierId?: string;
    linkedPoIds?: string[];
    linkedWcIds?: string[];
    approvalTrail?: PurchaseRequisitionApprovalAction[];
    createdAt?: unknown;
    updatedAt?: unknown;
}
