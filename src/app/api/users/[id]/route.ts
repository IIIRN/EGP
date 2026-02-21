import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const uid = resolvedParams.id;

        if (!uid) {
            return NextResponse.json({ error: "No user ID provided" }, { status: 400 });
        }

        // 1. Delete user from Firebase Authentication
        await adminAuth.deleteUser(uid);

        // 2. Delete user profile from Firestore
        await adminDb.collection("users").doc(uid).delete();

        return NextResponse.json({ success: true, message: "User deleted successfully" });
    } catch (error: any) {
        console.error("Error deleting user via admin API:", error);

        // Handle case where user is not in Auth but might be in Firestore
        if (error.code === 'auth/user-not-found') {
            try {
                const resolvedParams = await params;
                const uid = resolvedParams.id;
                await adminDb.collection("users").doc(uid).delete();
                return NextResponse.json({ success: true, message: "User not found in Auth, but deleted from Firestore" });
            } catch (fsError: any) {
                return NextResponse.json({ error: fsError.message }, { status: 500 });
            }
        }

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
