import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export async function POST(request: Request) {
    try {
        const webhookUrl = process.env.APPS_SCRIPT_EMAIL_WEBHOOK_URL;
        const webhookSecret = process.env.APPS_SCRIPT_EMAIL_SECRET;
        const debugCc = (process.env.APPS_SCRIPT_EMAIL_DEBUG_CC || "").trim();

        if (!webhookUrl || !webhookSecret) {
            return NextResponse.json(
                { error: "ยังไม่ได้ตั้งค่า APPS_SCRIPT_EMAIL_WEBHOOK_URL หรือ APPS_SCRIPT_EMAIL_SECRET ใน .env.local" },
                { status: 500 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const recipient = String(body?.to || debugCc || "").trim();
        const subject = String(body?.subject || `EGP AppScript Test ${new Date().toLocaleString("th-TH")}`).trim();
        const textBody = String(
            body?.textBody ||
            [
                "นี่คืออีเมลทดสอบจาก EGP",
                "",
                "ใช้สำหรับตรวจสอบว่า Apps Script webhook ส่งเมลออกได้จริง",
                `เวลา: ${new Date().toLocaleString("th-TH")}`,
                "",
                "หากได้รับเมลนี้ แปลว่า flow พื้นฐานของ Apps Script ใช้งานได้",
            ].join("\n")
        ).trim();

        if (!recipient) {
            return NextResponse.json(
                { error: "ไม่พบอีเมลปลายทาง กรุณาส่งค่า to มาใน body หรือกำหนด APPS_SCRIPT_EMAIL_DEBUG_CC" },
                { status: 400 }
            );
        }

        const htmlBody = `
            <div style="font-family:Arial,sans-serif;line-height:1.7;color:#0f172a">
                ${escapeHtml(textBody).replaceAll("\n", "<br />")}
            </div>
        `.trim();

        const settingsSnapshot = await adminDb.collection("system_settings").doc("global_config").get();
        const senderName = String(settingsSnapshot.data()?.companySettings?.name || "EGP System").trim() || "EGP System";

        const webhookResponse = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                secret: webhookSecret,
                to: recipient,
                subject,
                textBody,
                htmlBody,
                senderName,
                debugCc,
                includeAttachment: false,
                metadata: {
                    kind: "appscript-test",
                    triggeredAt: new Date().toISOString(),
                },
            }),
        });

        const webhookResult = await webhookResponse.json().catch(() => ({}));
        if (!webhookResponse.ok || webhookResult?.success === false) {
            const errorMessage =
                typeof webhookResult?.error === "string"
                    ? webhookResult.error
                    : typeof webhookResult?.message === "string"
                      ? webhookResult.message
                      : "Apps Script ส่งอีเมลทดสอบไม่สำเร็จ";

            return NextResponse.json(
                {
                    success: false,
                    error: errorMessage,
                    result: webhookResult,
                },
                { status: webhookResponse.status || 500 }
            );
        }

        return NextResponse.json({
            success: true,
            to: recipient,
            subject,
            senderName,
            result: webhookResult,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "ส่งอีเมลทดสอบไม่สำเร็จ";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
