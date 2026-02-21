import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, docId, data, vendorData, projectName } = body;

        // Fetch LINE Settings
        const settingsDoc = await adminDb.collection("system_settings").doc("global_config").get();
        if (!settingsDoc.exists) {
            return NextResponse.json({ success: false, message: "LINE settings not found" });
        }

        const settings = settingsDoc.data()?.lineIntegration;
        if (!settings?.isEnabled || !settings?.lineToken) {
            return NextResponse.json({ success: false, message: "LINE integration is disabled or token missing" });
        }

        let targetId = settings.groupId || settings.userId;

        // Find requester's LINE ID
        let requesterLineId = null;
        if (data?.createdBy) {
            const userDoc = await adminDb.collection("users").doc(data.createdBy).get();
            if (userDoc.exists) {
                requesterLineId = userDoc.data()?.lineUserId;
            }
        }

        // If an approval notification, prioritize sending to the requester directly
        if (data?.status === "approved" && requesterLineId) {
            targetId = requesterLineId;
        }

        if (!targetId) {
            return NextResponse.json({ success: false, message: "No target LINE ID configured" });
        }

        let flexContents: any = {};
        let altText = "";
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || "";
        const approveUrl = `https://liff.line.me/${liffId}/approve?type=${type}&id=${data.id}`;

        const isPending = data?.status === "pending";

        if (type === "PO") {
            altText = isPending ? `⚠️ ขออนุมัติใบสั่งซื้อ (PO): ${data.poNumber}` : `🎉 อนุมัติใบสั่งซื้อ (PO) เรียบร้อย: ${data.poNumber}`;
            flexContents = {
                type: "bubble",
                size: "mega",
                header: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: isPending ? "⚠️ รออนุมัติใบสั่งซื้อ" : "✅ อนุมัติใบสั่งซื้อสำเร็จ", weight: "bold", color: "#FFFFFF", size: "lg" },
                        { type: "text", text: projectName || "ไม่ระบุโครงการ", color: "#FFFFFFcc", size: "sm", margin: "sm" }
                    ],
                    backgroundColor: isPending ? "#f59e0b" : "#10b981",
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
                        ...(isPending && liffId ? [{
                            type: "button",
                            style: "primary",
                            color: "#10b981",
                            action: { type: "uri", label: "✅ อนุมัติเลย", uri: approveUrl }
                        }] : []),
                        ...(vendorData?.phone ? [{
                            type: "button",
                            style: "secondary",
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
            altText = isPending ? `⚠️ ขออนุมัติงานเพิ่ม-ลด (VO): ${data.voNumber}` : `🎉 อนุมัติงานเพิ่ม-ลด (VO) เรียบร้อย: ${data.voNumber}`;
            flexContents = {
                type: "bubble",
                size: "mega",
                header: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: isPending ? "⚠️ รออนุมัติงานเพิ่ม-ลด (VO)" : "✅ อนุมัติงานเพิ่ม-ลด (VO)", weight: "bold", color: "#FFFFFF", size: "lg" },
                        { type: "text", text: projectName || "ไม่ระบุโครงการ", color: "#FFFFFFcc", size: "sm", margin: "sm" }
                    ],
                    backgroundColor: isPending ? "#f59e0b" : "#3b82f6",
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
                },
                footer: isPending && liffId ? {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                        {
                            type: "button",
                            style: "primary",
                            color: "#10b981",
                            action: { type: "uri", label: "✅ อนุมัติเลย", uri: approveUrl }
                        }
                    ]
                } : undefined
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
