export type UserRole = "admin" | "procurement" | "pm" | "engineer";

export interface UserProfile {
    uid: string;
    email: string | null;
    displayName: string | null;
    role: UserRole;
    isActive: boolean;
    phoneNumber?: string | null;
    lineUserId?: string | null;
    lineProfilePic?: string | null;
    createdAt?: string;
    updatedAt?: string;
}
