import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, docId, data, vendorData, projectName } = body;

        // Fetch LINE Settings
        const settingsDoc = await adminDb.collection("system_settings").doc("line_integration").get();
        if (!settingsDoc.exists) {
            return NextResponse.json({ success: false, message: "LINE settings not found" });
        }

        const settings = settingsDoc.data();
        if (!settings?.isEnabled || !settings?.lineToken) {
            return NextResponse.json({ success: false, message: "LINE integration is disabled or token missing" });
        }

        const targetId = settings.groupId || settings.userId;
        if (!targetId) {
            return NextResponse.json({ success: false, message: "No target LINE ID configured" });
        }

        let flexContents: any = {};
        let altText = "";

        if (type === "PO") {
            altText = `🎉 อนุมัติใบสั่งซื้อ (PO) เรียบร้อย: ${data.poNumber}`;
            flexContents = {
                type: "bubble",
                size: "mega",
                header: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: "✅ อนุมัติใบสั่งซื้อสำเร็จ", weight: "bold", color: "#FFFFFF", size: "lg" },
                        { type: "text", text: projectName || "ไม่ระบุโครงการ", color: "#FFFFFFcc", size: "sm", margin: "sm" }
                    ],
                    backgroundColor: "#10b981",
                    paddingAll: "xxl"
                },
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: `เลขที่: ${data.poNumber}`, weight: "bold", size: "xl", color: "#1e293b" },
                        { type: "text", text: `ยอดรวม: ฿${data.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, size: "md", color: "#64748b", margin: "sm" },
                        { type: "separator", margin: "xl" },
                        {
                            type: "box",
                            layout: "vertical",
                            margin: "xl",
                            spacing: "sm",
                            contents: [
                                { type: "text", text: "ข้อมูลผู้ขาย / คู่ค้า", weight: "bold", color: "#334155", size: "sm" },
                                { type: "text", text: vendorData?.name || data.vendorName || "ไม่ระบุชื่อร้าน", size: "sm", color: "#64748b", wrap: true },
                                { type: "text", text: `โทร: ${vendorData?.phone || "ไม่มีเบอร์ติดต่อ"}`, size: "sm", color: "#64748b" },
                                { type: "text", text: `ที่อยู่: ${vendorData?.address || "-"}`, size: "xs", color: "#94a3b8", wrap: true }
                            ]
                        }
                    ]
                },
                footer: {
                    type: "box",
                    layout: "horizontal",
                    spacing: "sm",
                    contents: [
                        ...(vendorData?.phone ? [{
                            type: "button",
                            style: "primary",
                            color: "#3b82f6",
                            action: { type: "uri", label: "📞 โทรออก", uri: `tel:${vendorData.phone}` }
                        }] : []),
                        ...(vendorData?.googleMapUrl ? [{
                            type: "button",
                            style: "secondary",
                            action: { type: "uri", label: "📍 แผนที่", uri: vendorData.googleMapUrl }
                        }] : [])
                    ]
                }
            };
        } else if (type === "VO") {
            altText = `🎉 อนุมัติงานเพิ่ม-ลด (VO) เรียบร้อย: ${data.voNumber}`;
            flexContents = {
                type: "bubble",
                size: "mega",
                header: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: "✅ อนุมัติงานเพิ่ม-ลด (VO)", weight: "bold", color: "#FFFFFF", size: "lg" },
                        { type: "text", text: projectName || "ไม่ระบุโครงการ", color: "#FFFFFFcc", size: "sm", margin: "sm" }
                    ],
                    backgroundColor: "#f59e0b",
                    paddingAll: "xxl"
                },
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: `เลขที่: ${data.voNumber}`, weight: "bold", size: "xl", color: "#1e293b" },
                        { type: "text", text: data.title || "ไม่มีหัวข้อ", size: "md", color: "#334155", margin: "md", wrap: true },
                        {
                            type: "text",
                            text: `ผลกระทบงบ: ${data.totalAmount > 0 ? '+' : ''}฿${data.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                            size: "md",
                            color: data.totalAmount > 0 ? "#ef4444" : "#10b981",
                            weight: "bold",
                            margin: "sm"
                        }
                    ]
                }
            };
        }

        const payload = {
            to: targetId,
            messages: [
                {
                    type: "flex",
                    altText: altText,
                    contents: flexContents
                }
            ]
        };

        const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${settings.lineToken}`
            },
            body: JSON.stringify(payload)
        });

        if (!lineRes.ok) {
            const errorData = await lineRes.json();
            console.error("LINE API Error:", errorData);
            return NextResponse.json({ success: false, error: errorData }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: "Notification sent successfully" });

    } catch (error: any) {
        console.error("Error sending LINE notification:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
