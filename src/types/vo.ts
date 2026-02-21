export interface VOItem {
    id?: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
    type: 'add' | 'omit'; // "add" for extra work, "omit" for negative/deduction
}

export interface VariationOrder {
    id: string;
    voNumber: string;
    projectId: string;
    title: string;
    reason: string;
    items: VOItem[];
    subTotal: number;
    vatRate: number;
    vatAmount: number;
    totalAmount: number; // Final impact on budget (could be negative if omit > add)

    status: 'draft' | 'pending' | 'approved' | 'rejected';

    createdBy: string;
    createdAt?: any;
    updatedAt?: any;
}
