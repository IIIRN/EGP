import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { phoneNumber, lineUserId, lineProfilePic } = body;

        if (!phoneNumber || !lineUserId) {
            return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน (ต้องระบุเบอร์โทรศัพท์และ LINE ID)" }, { status: 400 });
        }

        // 1. Find the user with this phoneNumber
        const usersSnapshot = await adminDb.collection("users").where("phoneNumber", "==", phoneNumber).get();

        if (usersSnapshot.empty) {
            return NextResponse.json({ error: "ไม่พบเบอร์โทรศัพท์นี้ในระบบ (กรุณาแจ้งแอดมินให้เพิ่มเบอร์ก่อน)" }, { status: 404 });
        }

        // Assuming phoneNumber is unique, we take the first match
        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();

        // 2. Security Check (Optional but recommended):
        // If this user already has a DIFFERENT lineUserId
        if (userData.lineUserId && userData.lineUserId !== lineUserId) {
            return NextResponse.json({ error: "เบอร์โทรนี้ถูกผูกกับ LINE บัญชีอื่นไปแล้ว" }, { status: 403 });
        }

        // 3. Optional: Check if the provided lineUserId is already linked to ANOTHER user
        const existingLineQuery = await adminDb.collection("users").where("lineUserId", "==", lineUserId).get();
        if (!existingLineQuery.empty) {
            const currentLinkedDoc = existingLineQuery.docs[0];
            if (currentLinkedDoc.id !== userDoc.id) {
                return NextResponse.json({ error: "บัญชี LINE ของคุณถูกผูกกับพนักงานคนอื่นแล้ว" }, { status: 403 });
            }
            // If it's the exact same user, just update the profile pic (fine to proceed)
        }

        // 4. Update the user document
        await userDoc.ref.update({
            lineUserId: lineUserId,
            lineProfilePic: lineProfilePic || null,
            updatedAt: new Date().toISOString(),
        });

        // 5. Create Custom Token for immediate login
        const customToken = await adminAuth.createCustomToken(userDoc.id);

        return NextResponse.json({ success: true, uid: userDoc.id, customToken });
    } catch (error: any) {
        console.error("Error binding LINE user:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
