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

        let poFooterButtons: any[] = [];
        if (isPending && liffId) {
            poFooterButtons.push({
                type: "button",
                style: "primary",
                color: "#10b981",
                height: "sm",
                action: { type: "uri", label: "ตรวจสอบและอนุมัติ", uri: approveUrl }
            });
        }

        let secondaryPoButtons = [];
        if (vendorData?.phone) {
            secondaryPoButtons.push({
                type: "button",
                style: "secondary",
                height: "sm",
                action: { type: "uri", label: "โทรติดต่อ", uri: `tel:${vendorData.phone}` }
            });
        }
        if (vendorData?.googleMapUrl) {
            secondaryPoButtons.push({
                type: "button",
                style: "secondary",
                height: "sm",
                action: { type: "uri", label: "แผนที่", uri: vendorData.googleMapUrl }
            });
        }
        if (secondaryPoButtons.length > 0) {
            poFooterButtons.push({
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: secondaryPoButtons
            });
        }

        if (type === "PO") {
            altText = isPending ? `แจ้งเตือน: รออนุมัติใบสั่งซื้อ (PO) - ${data.poNumber}` : `แจ้งเตือน: อนุมัติใบสั่งซื้อ (PO) เรียบร้อย - ${data.poNumber}`;
            flexContents = {
                type: "bubble",
                size: "mega",
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: isPending ? "เอกสารรอการอนุมัติ (PO)" : "อนุมัติเอกสารเรียบร้อย (PO)", weight: "bold", color: isPending ? "#d97706" : "#059669", size: "md" },
                        { type: "text", text: projectName || "ไม่ระบุโครงการ", size: "xs", color: "#64748b", margin: "sm", wrap: true },
                        { type: "separator", margin: "lg" },
                        {
                            type: "box",
                            layout: "vertical",
                            margin: "lg",
                            spacing: "sm",
                            contents: [
                                {
                                    type: "box",
                                    layout: "horizontal",
                                    contents: [
                                        { type: "text", text: "เลขที่เอกสาร", size: "sm", color: "#64748b", flex: 1 },
                                        { type: "text", text: data.poNumber || "-", size: "sm", color: "#1e293b", flex: 2, weight: "bold", wrap: true }
                                    ]
                                },
                                {
                                    type: "box",
                                    layout: "horizontal",
                                    contents: [
                                        { type: "text", text: "ผู้ขาย/คู่ค้า", size: "sm", color: "#64748b", flex: 1 },
                                        { type: "text", text: vendorData?.name || data.vendorName || "-", size: "sm", color: "#1e293b", flex: 2, wrap: true }
                                    ]
                                },
                                {
                                    type: "box",
                                    layout: "horizontal",
                                    contents: [
                                        { type: "text", text: "เบอร์โทร", size: "sm", color: "#64748b", flex: 1 },
                                        { type: "text", text: vendorData?.phone || "-", size: "sm", color: "#1e293b", flex: 2, wrap: true }
                                    ]
                                },
                                {
                                    type: "box",
                                    layout: "horizontal",
                                    contents: [
                                        { type: "text", text: "ยอดรวมทั้งสิ้น", size: "sm", color: "#64748b", flex: 1 },
                                        { type: "text", text: `฿${(data.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, size: "sm", color: "#1e293b", flex: 2, weight: "bold" }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                footer: poFooterButtons.length > 0 ? {
                    type: "box",
                    layout: "vertical",
                    spacing: "sm",
                    contents: poFooterButtons
                } : undefined
            };
        } else if (type === "VO") {
            altText = isPending ? `แจ้งเตือน: รออนุมัติงานเพิ่ม-ลด (VO) - ${data.voNumber}` : `แจ้งเตือน: อนุมัติงานเพิ่ม-ลด (VO) เรียบร้อย - ${data.voNumber}`;
            flexContents = {
                type: "bubble",
                size: "mega",
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: isPending ? "เอกสารรอการอนุมัติ (VO)" : "อนุมัติเอกสารเรียบร้อย (VO)", weight: "bold", color: isPending ? "#d97706" : "#2563eb", size: "md" },
                        { type: "text", text: projectName || "ไม่ระบุโครงการ", size: "xs", color: "#64748b", margin: "sm", wrap: true },
                        { type: "separator", margin: "lg" },
                        {
                            type: "box",
                            layout: "vertical",
                            margin: "lg",
                            spacing: "sm",
                            contents: [
                                {
                                    type: "box",
                                    layout: "horizontal",
                                    contents: [
                                        { type: "text", text: "เลขที่เอกสาร", size: "sm", color: "#64748b", flex: 1 },
                                        { type: "text", text: data.voNumber || "-", size: "sm", color: "#1e293b", flex: 2, weight: "bold", wrap: true }
                                    ]
                                },
                                {
                                    type: "box",
                                    layout: "horizontal",
                                    contents: [
                                        { type: "text", text: "หัวข้อ", size: "sm", color: "#64748b", flex: 1 },
                                        { type: "text", text: data.title || "-", size: "sm", color: "#1e293b", flex: 2, wrap: true }
                                    ]
                                },
                                {
                                    type: "box",
                                    layout: "horizontal",
                                    contents: [
                                        { type: "text", text: "ผลกระทบงบ", size: "sm", color: "#64748b", flex: 1 },
                                        {
                                            type: "text",
                                            text: `${(data.totalAmount || 0) > 0 ? '+' : ''}฿${(data.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                                            size: "sm",
                                            color: (data.totalAmount || 0) > 0 ? "#ef4444" : "#059669",
                                            flex: 2,
                                            weight: "bold"
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                footer: isPending && liffId ? {
                    type: "box",
                    layout: "vertical",
                    spacing: "sm",
                    contents: [
                        {
                            type: "button",
                            style: "primary",
                            color: "#10b981",
                            height: "sm",
                            action: { type: "uri", label: "ตรวจสอบและอนุมัติ", uri: approveUrl }
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
