export interface Contractor {
    id?: string;
    idContractor: string;
    nickname: string;
    fullName: string;
    bankAccount: string;
    bankCode: string;
    nationalId: string;
    phone: string;
    address: string;
    yearlyLimit: number;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}
