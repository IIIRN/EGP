export interface POItem {
    id: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
    isClosed?: boolean;
}

export interface DocumentSignature {
    id?: string;
    name?: string;
    position?: string;
    signatureUrl?: string;
}

export interface PurchaseOrder {
    id: string;
    poNumber: string;
    poType?: "project" | "extra";
    projectId: string;
    sourcePrId?: string;
    sourceComparisonId?: string;
    requestedByUid?: string;
    requestedByName?: string;
    vendorId?: string;
    vendorName?: string;
    items: POItem[];
    subTotal: number;
    vatRate: number;
    vatMode?: "none" | "exclusive" | "inclusive";
    vatAmount: number;
    totalAmount: number;
    status: "draft" | "pending" | "approved" | "rejected";
    createdBy: string;
    createdAt?: string;
    updatedAt?: string;
    creditDays?: number;
    signatureId?: string;
    signatureData?: DocumentSignature | null;
    isCompleted?: boolean;
}
