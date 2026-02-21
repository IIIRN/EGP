import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { lineUserId } = body;

        if (!lineUserId) {
            return NextResponse.json({ error: "Missing lineUserId" }, { status: 400 });
        }

        // Find the user with this lineUserId
        const usersSnapshot = await adminDb.collection("users").where("lineUserId", "==", lineUserId).get();

        if (usersSnapshot.empty) {
            return NextResponse.json({ error: "User not linked" }, { status: 404 });
        }

        // Assuming lineUserId is unique, we take the first match
        const userDoc = usersSnapshot.docs[0];
        const uid = userDoc.id;

        // Create Custom Token
        const customToken = await adminAuth.createCustomToken(uid);

        return NextResponse.json({ success: true, customToken: customToken });
    } catch (error: any) {
        console.error("Error creating custom token:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
