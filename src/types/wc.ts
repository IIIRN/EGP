export interface WCItem {
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

export interface WorkContract {
    id: string;
    wcNumber: string;
    wcType: "project" | "extra";
    projectId: string;
    sourcePrId?: string;
    sourceComparisonId?: string;
    requestedByUid?: string;
    requestedByName?: string;
    vendorId?: string;
    vendorName?: string;
    title?: string;
    items: WCItem[];
    subTotal: number;
    vatRate: number;
    vatMode?: "none" | "exclusive" | "inclusive";
    vatAmount: number;
    totalAmount: number;
    status: "draft" | "pending" | "approved" | "rejected";
    startDate?: string;
    endDate?: string;
    issueDate?: string;
    paymentTerms?: string;
    notes?: string;
    createdBy: string;
    createdAt?: unknown;
    updatedAt?: unknown;
    signatureId?: string;
    signatureData?: DocumentSignature | null;
}
