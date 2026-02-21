import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password, displayName, role, phoneNumber } = body;

        if (!email || !password || !displayName) {
            return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน (ต้องระบุ Email, Password, ชื่อ)" }, { status: 400 });
        }

        let userUid = "";

        try {
            // Create Firebase Auth user securely without affecting the client-side logged-in session
            const userRecord = await adminAuth.createUser({
                email,
                password,
                displayName,
            });
            userUid = userRecord.uid;
        } catch (authError: any) {
            // If the user already exists in Firebase Auth (e.g. they signed up themselves but have no profile)
            if (authError.code === "auth/email-already-exists") {
                const existingUser = await adminAuth.getUserByEmail(email);
                userUid = existingUser.uid;
                // Optional: update their auth profile to match the new details
                await adminAuth.updateUser(userUid, { password, displayName });
            } else {
                throw authError;
            }
        }

        // Add to Firestore database
        await adminDb.collection("users").doc(userUid).set({
            uid: userUid,
            email,
            displayName,
            role: role || "engineer",
            isActive: true,
            phoneNumber: phoneNumber || null,
            lineUserId: null,
            lineProfilePic: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({ success: true, uid: userUid });
    } catch (error: any) {
        console.error("Error creating user admin API:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
