export interface Vendor {
    id: string;
    name: string;
    taxId?: string;
    isVatRegistered?: boolean;
    vatMode?: "none" | "exclusive" | "inclusive";
    contactName: string;
    phone: string;
    secondaryPhone?: string;
    email?: string;
    address?: string;
    googleMapUrl?: string; // Link to Google Maps
    vendorTypes?: string[]; // Array of categories this vendor belongs to
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}
