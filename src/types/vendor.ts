export interface Vendor {
    id: string;
    name: string;
    taxId?: string;
    contactName: string;
    phone: string;
    email?: string;
    address?: string;
    googleMapUrl?: string; // Link to Google Maps
    vendorTypes?: string[]; // Array of categories this vendor belongs to
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}
