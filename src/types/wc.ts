export interface WCItem {
    id: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
}

export interface WorkContract {
    id: string;
    wcNumber: string;
    wcType: "project" | "extra"; // "project" = ใบจ้างงานในโครงการ, "extra" = ใบจ้างงานเพิ่มเติม
    projectId: string;
    vendorId?: string;
    vendorName?: string;
    title?: string;         // หัวข้องาน/ชื่อสัญญา
    items: WCItem[];
    subTotal: number;
    vatRate: number;
    vatAmount: number;
    totalAmount: number;
    status: "draft" | "pending" | "approved" | "rejected";
    startDate?: string;     // วันเริ่มงาน
    endDate?: string;       // วันสิ้นสุดงาน
    paymentTerms?: string;  // เงื่อนไขการจ่าย เช่น "งวดที่ 1 = 50%, งวดที่ 2 = 50%"
    notes?: string;         // หมายเหตุ/ข้อกำหนดพิเศษ
    createdBy: string;
    createdAt?: any;
    updatedAt?: any;
    signatureId?: string;
    signatureData?: any;
}
