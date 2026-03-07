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
    poType?: "project" | "extra"; // เพิ่มเข้ามาเพื่อแยกประเภท PO 
    projectId: string; // ถ้าเป็น "extra" อาจจะใส่ projectId ไปด้วยเพื่อให้รู้ว่าเบิกของ project ไหน (ถ้ามี) หรือออฟฟิศ
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
