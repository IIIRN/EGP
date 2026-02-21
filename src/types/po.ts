export interface POItem {
    id: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
}

export interface PurchaseOrder {
    id: string;
    poNumber: string;
    projectId: string;
    vendorId?: string;
    vendorName?: string;
    items: POItem[];
    subTotal: number;
    vatRate: number;
    vatAmount: number;
    totalAmount: number;
    status: "draft" | "pending" | "approved" | "rejected";
    createdBy: string;
    createdAt?: string;
    updatedAt?: string;
}
