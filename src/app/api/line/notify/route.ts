import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

type LineSettings = {
    isEnabled?: boolean;
    lineToken?: string;
    groupId?: string;
    userId?: string;
    recipientAdminUid?: string;
    recipientAdminUids?: string[];
};

type NotifyBody = {
    type?: string;
    docId?: string;
    data?: any;
    vendorData?: any;
    projectName?: string;
};

const COLOR = {
    title: "#1e3a8a",
    text: "#334155",
    muted: "#64748b",
    border: "#e2e8f0",
    surface: "#f8fafc",
    primary: "#1d4ed8",
};

function asText(value: unknown, fallback = "-"): string {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return fallback;
}

function toAmount(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function extractLineErrorReason(errorData: unknown): string {
    if (!errorData || typeof errorData !== "object") {
        return "ไม่สามารถระบุสาเหตุได้";
    }

    const data = errorData as { message?: unknown; details?: unknown };
    if (typeof data.message === "string" && data.message.trim()) {
        return data.message.trim();
    }

    if (Array.isArray(data.details) && data.details.length > 0) {
        const first = data.details[0] as { message?: unknown; property?: unknown };
        const detailMessage = typeof first?.message === "string" ? first.message : "";
        const detailProperty = typeof first?.property === "string" ? first.property : "";
        if (detailMessage && detailProperty) {
            return `${detailMessage} (${detailProperty})`;
        }
        if (detailMessage) {
            return detailMessage;
        }
    }

    return "ไม่สามารถระบุสาเหตุได้";
}

function isValidLineRecipientId(value: string): boolean {
    const normalized = value.trim();
    // LINE push target supports User/Group/Room ID (U/C/R prefix).
    return /^[UCR][0-9A-Za-z]{10,}$/.test(normalized);
}

function formatAmount(value: unknown): string {
    return `฿${toAmount(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function infoRow(
    label: string,
    value: string,
    options?: { valueColor?: string; valueWeight?: "regular" | "bold" }
) {
    return {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [
            { type: "text", text: label, size: "sm", color: COLOR.muted, flex: 2, wrap: true },
            {
                type: "text",
                text: value || "-",
                size: "sm",
                color: options?.valueColor || COLOR.text,
                weight: options?.valueWeight || "regular",
                flex: 3,
                wrap: true,
                align: "end",
            },
        ],
    };
}

function buildPOFlex(params: {
    isPending: boolean;
    projectName?: string;
    data?: any;
    vendorData?: any;
    approveUrl: string;
    hasApproveButton: boolean;
}) {
    const { isPending, projectName, data, vendorData, approveUrl, hasApproveButton } = params;
    const statusText = isPending ? "รออนุมัติ" : "อนุมัติแล้ว";

    const footerContents: any[] = [];
    if (hasApproveButton) {
        footerContents.push({
            type: "button",
            style: "primary",
            color: COLOR.primary,
            height: "sm",
            action: { type: "uri", label: "ตรวจสอบและอนุมัติ", uri: approveUrl },
        });
    }

    const secondaryButtons: any[] = [];
    if (vendorData?.phone) {
        secondaryButtons.push({
            type: "button",
            style: "secondary",
            height: "sm",
            action: { type: "uri", label: "โทร", uri: `tel:${vendorData.phone}` },
        });
    }
    if (vendorData?.googleMapUrl) {
        secondaryButtons.push({
            type: "button",
            style: "secondary",
            height: "sm",
            action: { type: "uri", label: "แผนที่", uri: vendorData.googleMapUrl },
        });
    }
    if (secondaryButtons.length > 0) {
        footerContents.push({
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: secondaryButtons,
        });
    }

    return {
        type: "bubble",
        size: "mega",
        body: {
            type: "box",
            layout: "vertical",
            spacing: "md",
            contents: [
                { type: "text", text: asText(projectName, "ไม่ระบุโครงการ"), size: "sm", color: COLOR.title, weight: "bold", wrap: true },
                { type: "separator", color: COLOR.border },
                {
                    type: "box",
                    layout: "vertical",
                    spacing: "sm",
                    contents: [
                        infoRow("ประเภทเอกสาร", "ใบสั่งซื้อ (PO)"),
                        infoRow("สถานะ", statusText, { valueColor: COLOR.title, valueWeight: "bold" }),
                        infoRow("เลขที่เอกสาร", asText(data?.poNumber)),
                        infoRow("คู่ค้า", asText(vendorData?.name || data?.vendorName)),
                        infoRow("เบอร์โทร", asText(vendorData?.phone)),
                        infoRow("ยอดรวมทั้งสิ้น", formatAmount(data?.totalAmount), { valueColor: COLOR.title, valueWeight: "bold" }),
                    ],
                },
            ],
        },
        footer: footerContents.length > 0
            ? {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: footerContents,
            }
            : undefined,
        styles: {
            body: { backgroundColor: "#ffffff" },
            footer: { backgroundColor: COLOR.surface, separator: true },
        },
    };
}

function buildVOFlex(params: {
    isPending: boolean;
    projectName?: string;
    data?: any;
    approveUrl: string;
    hasApproveButton: boolean;
}) {
    const { isPending, projectName, data, approveUrl, hasApproveButton } = params;
    const statusText = isPending ? "รออนุมัติ" : "อนุมัติแล้ว";
    const impactValue = toAmount(data?.totalAmount);

    const footer = hasApproveButton
        ? {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
                {
                    type: "button",
                    style: "primary",
                    color: COLOR.primary,
                    height: "sm",
                    action: { type: "uri", label: "ตรวจสอบและอนุมัติ", uri: approveUrl },
                },
            ],
        }
        : undefined;

    return {
        type: "bubble",
        size: "mega",
        body: {
            type: "box",
            layout: "vertical",
            spacing: "md",
            contents: [
                { type: "text", text: asText(projectName, "ไม่ระบุโครงการ"), size: "sm", color: COLOR.title, weight: "bold", wrap: true },
                { type: "separator", color: COLOR.border },
                {
                    type: "box",
                    layout: "vertical",
                    spacing: "sm",
                    contents: [
                        infoRow("ประเภทเอกสาร", "งานเพิ่ม-ลด (VO)"),
                        infoRow("สถานะ", statusText, { valueColor: COLOR.title, valueWeight: "bold" }),
                        infoRow("เลขที่เอกสาร", asText(data?.voNumber)),
                        infoRow("หัวข้อ", asText(data?.title)),
                        infoRow(
                            "ผลกระทบงบประมาณ",
                            `${impactValue > 0 ? "+" : ""}${formatAmount(impactValue)}`,
                            { valueColor: COLOR.title, valueWeight: "bold" }
                        ),
                    ],
                },
            ],
        },
        footer,
        styles: {
            body: { backgroundColor: "#ffffff" },
            footer: { backgroundColor: COLOR.surface, separator: true },
        },
    };
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as NotifyBody;
        const { type, data, vendorData, projectName } = body;

        const settingsDoc = await adminDb.collection("system_settings").doc("global_config").get();
        if (!settingsDoc.exists) {
            return NextResponse.json({ success: false, message: "LINE settings not found" });
        }

        const settings = (settingsDoc.data()?.lineIntegration || {}) as LineSettings;
        const lineToken = asText(settings.lineToken, "");
        if (!settings.isEnabled || !lineToken) {
            return NextResponse.json({ success: false, message: "LINE integration is disabled or token missing" });
        }

        const configuredTargetIds = new Set<string>();
        const invalidConfiguredTargets: string[] = [];
        const pushTarget = (value: unknown, source: string) => {
            const normalized = asText(value, "");
            if (!normalized) return;
            if (!isValidLineRecipientId(normalized)) {
                invalidConfiguredTargets.push(`${source}:${normalized}`);
                return;
            }
            configuredTargetIds.add(normalized);
        };

        pushTarget(settings.groupId, "groupId");

        const candidateAdminUids = new Set<string>();
        let selectedAdminCount = 0;
        let resolvedAdminLineIdCount = 0;
        if (asText(settings.recipientAdminUid, "")) {
            const candidate = asText(settings.recipientAdminUid, "");
            if (isValidLineRecipientId(candidate)) {
                resolvedAdminLineIdCount += 1;
                pushTarget(candidate, "recipientLineUserId");
            } else {
                candidateAdminUids.add(candidate);
            }
        }
        if (Array.isArray(settings.recipientAdminUids)) {
            for (const uidOrLineId of settings.recipientAdminUids) {
                const normalized = asText(uidOrLineId, "");
                if (!normalized) continue;
                if (isValidLineRecipientId(normalized)) {
                    resolvedAdminLineIdCount += 1;
                    pushTarget(normalized, "recipientLineUserId");
                } else {
                    candidateAdminUids.add(normalized);
                }
            }
        }
        selectedAdminCount = candidateAdminUids.size + resolvedAdminLineIdCount;

        if (candidateAdminUids.size > 0) {
            const adminDocs = await Promise.all(
                Array.from(candidateAdminUids).map((adminUid) => adminDb.collection("users").doc(adminUid).get())
            );
            for (const adminDoc of adminDocs) {
                if (!adminDoc.exists) continue;
                const lineUserId = asText(adminDoc.data()?.lineUserId, "");
                if (lineUserId) {
                    resolvedAdminLineIdCount += 1;
                    pushTarget(lineUserId, `admin:${adminDoc.id}`);
                }
            }
        }

        if (configuredTargetIds.size === 0) {
            pushTarget(settings.userId, "legacyUserId");
        }

        let requesterLineId: string | null = null;
        if (data?.createdBy) {
            const userDoc = await adminDb.collection("users").doc(data.createdBy).get();
            if (userDoc.exists) {
                requesterLineId = asText(userDoc.data()?.lineUserId, "") || null;
            }
        }

        let targetIds = Array.from(configuredTargetIds);
        if (data?.status === "approved" && requesterLineId) {
            if (isValidLineRecipientId(requesterLineId)) {
                targetIds = [requesterLineId];
            } else {
                invalidConfiguredTargets.push(`requester:${requesterLineId}`);
            }
        }

        if (targetIds.length === 0) {
            if (invalidConfiguredTargets.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `พบ LINE ID รูปแบบไม่ถูกต้อง: ${invalidConfiguredTargets.join(", ")}`,
                        invalidTargets: invalidConfiguredTargets,
                    },
                    { status: 400 }
                );
            }

            if (
                selectedAdminCount > 0 &&
                resolvedAdminLineIdCount === 0 &&
                !asText(settings.groupId, "") &&
                !asText(settings.userId, "")
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "ไม่พบ LINE ID ของแอดมินที่เลือก กรุณาผูกบัญชี LINE ในหน้า Users ก่อน",
                    },
                    { status: 400 }
                );
            }

            return NextResponse.json({ success: false, message: "No target LINE ID configured" }, { status: 400 });
        }

        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || "";
        const approveUrl = `https://liff.line.me/${liffId}/approve?type=${type}&id=${data?.id || ""}`;
        const isPending = data?.status === "pending";

        let altText = "แจ้งเตือนเอกสาร";
        let flexContents: any = {};
        if (type === "PO") {
            const poNo = asText(data?.poNumber, "-");
            altText = isPending ? `PO รออนุมัติ - ${poNo}` : `PO อนุมัติแล้ว - ${poNo}`;
            flexContents = buildPOFlex({
                isPending,
                projectName,
                data,
                vendorData,
                approveUrl,
                hasApproveButton: isPending && !!liffId,
            });
        } else if (type === "VO") {
            const voNo = asText(data?.voNumber, "-");
            altText = isPending ? `VO รออนุมัติ - ${voNo}` : `VO อนุมัติแล้ว - ${voNo}`;
            flexContents = buildVOFlex({
                isPending,
                projectName,
                data,
                approveUrl,
                hasApproveButton: isPending && !!liffId,
            });
        } else {
            altText = `แจ้งเตือนเอกสาร - ${asText(type, "N/A")}`;
            flexContents = {
                type: "bubble",
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: asText(projectName, "ไม่ระบุโครงการ"), size: "sm", color: COLOR.title, weight: "bold", wrap: true },
                        { type: "separator", color: COLOR.border, margin: "md" },
                        infoRow("ประเภทเอกสาร", asText(type, "ไม่ระบุ")),
                        infoRow("สถานะ", asText(data?.status, "-"), { valueColor: COLOR.title, valueWeight: "bold" }),
                    ],
                    spacing: "md",
                },
                styles: {
                    body: { backgroundColor: "#ffffff" },
                },
            };
        }

        const failedTargets: { targetId: string; status: number; error: unknown; reason: string }[] = [];
        const successTargets: string[] = [];
        for (const targetId of targetIds) {
            const payload = {
                to: targetId,
                messages: [
                    {
                        type: "flex",
                        altText,
                        contents: flexContents,
                    },
                ],
            };

            const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${lineToken}`,
                },
                body: JSON.stringify(payload),
            });

            if (!lineRes.ok) {
                let errorData: unknown = null;
                try {
                    errorData = await lineRes.json();
                } catch {
                    errorData = { status: lineRes.status, statusText: lineRes.statusText };
                }
                failedTargets.push({
                    targetId,
                    status: lineRes.status,
                    reason: extractLineErrorReason(errorData),
                    error: errorData,
                });
            } else {
                successTargets.push(targetId);
            }
        }

        if (successTargets.length === 0) {
            console.error("LINE API Error:", failedTargets);
            const firstFailedReason = failedTargets[0]?.reason || "ไม่สามารถระบุสาเหตุได้";
            return NextResponse.json(
                {
                    success: false,
                    message: `ส่งแจ้งเตือน LINE ไม่สำเร็จ (${failedTargets.length} ผู้รับ): ${firstFailedReason}`,
                    firstFailedReason,
                    failedTargets,
                },
                { status: 400 }
            );
        }

        if (failedTargets.length > 0) {
            console.warn("LINE API Partial Success:", { successTargets, failedTargets });
            const firstFailedReason = failedTargets[0]?.reason || "ไม่สามารถระบุสาเหตุได้";
            return NextResponse.json({
                success: true,
                partial: true,
                message: `ส่งแจ้งเตือนได้ ${successTargets.length} รายการ และไม่สำเร็จ ${failedTargets.length} รายการ: ${firstFailedReason}`,
                recipientCount: successTargets.length,
                failedCount: failedTargets.length,
                firstFailedReason,
                failedTargets,
            });
        }

        return NextResponse.json({
            success: true,
            message: "ส่งแจ้งเตือนสำเร็จ",
            recipientCount: successTargets.length,
        });
    } catch (error: any) {
        console.error("Error sending LINE notification:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
