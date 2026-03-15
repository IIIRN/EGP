import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import {
    getDocumentKindLabel,
    isApprovedDocumentStatus,
    isPendingDocumentStatus,
    resolveDocumentKind,
} from "@/lib/documentKinds";

type LineSettings = {
    isEnabled?: boolean;
    lineToken?: string;
    groupId?: string;
    userId?: string;
    recipientAdminUid?: string;
    recipientAdminUids?: string[];
};

type NotifyRecord = Record<string, unknown>;

type NotifyBody = {
    type?: string;
    docId?: string;
    data?: NotifyRecord;
    vendorData?: NotifyRecord;
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
        return "à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸£à¸°à¸šà¸¸à¸ªà¸²à¹€à¸«à¸•à¸¸à¹„à¸”à¹‰";
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

    return "à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸£à¸°à¸šà¸¸à¸ªà¸²à¹€à¸«à¸•à¸¸à¹„à¸”à¹‰";
}

function isValidLineRecipientId(value: string): boolean {
    const normalized = value.trim();
    // LINE push target supports User/Group/Room ID (U/C/R prefix).
    return /^[UCR][0-9A-Za-z]{10,}$/.test(normalized);
}

function formatAmount(value: unknown): string {
    return `à¸¿${toAmount(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    data?: NotifyRecord;
    vendorData?: NotifyRecord;
    approveUrl: string;
    hasApproveButton: boolean;
}) {
    const { isPending, projectName, data, vendorData, approveUrl, hasApproveButton } = params;
    const statusText = isPending ? "à¸£à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´" : "à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹à¸¥à¹‰à¸§";

    const footerContents: unknown[] = [];
    if (hasApproveButton) {
        footerContents.push({
            type: "button",
            style: "primary",
            color: COLOR.primary,
            height: "sm",
            action: { type: "uri", label: "à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹à¸¥à¸°à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´", uri: approveUrl },
        });
    }

    const secondaryButtons: unknown[] = [];
    if (vendorData?.phone) {
        secondaryButtons.push({
            type: "button",
            style: "secondary",
            height: "sm",
            action: { type: "uri", label: "à¹‚à¸—à¸£à¸«à¸¥à¸±à¸", uri: `tel:${vendorData.phone}` },
        });
    }
    if (vendorData?.secondaryPhone) {
        secondaryButtons.push({
            type: "button",
            style: "secondary",
            height: "sm",
            action: { type: "uri", label: "à¹‚à¸—à¸£à¸ªà¸³à¸£à¸­à¸‡", uri: `tel:${vendorData.secondaryPhone}` },
        });
    }
    if (vendorData?.googleMapUrl) {
        secondaryButtons.push({
            type: "button",
            style: "secondary",
            height: "sm",
            action: { type: "uri", label: "à¹à¸œà¸™à¸—à¸µà¹ˆ", uri: vendorData.googleMapUrl },
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
                { type: "text", text: asText(projectName, "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¹‚à¸„à¸£à¸‡à¸à¸²à¸£"), size: "sm", color: COLOR.title, weight: "bold", wrap: true },
                { type: "separator", color: COLOR.border },
                {
                    type: "box",
                    layout: "vertical",
                    spacing: "sm",
                    contents: [
                        infoRow("à¸›à¸£à¸°à¹€à¸ à¸—à¹€à¸­à¸à¸ªà¸²à¸£", "à¹ƒà¸šà¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­ (PO)"),
                        infoRow("à¸ªà¸–à¸²à¸™à¸°", statusText, { valueColor: COLOR.title, valueWeight: "bold" }),
                        infoRow("à¹€à¸¥à¸‚à¸—à¸µà¹ˆà¹€à¸­à¸à¸ªà¸²à¸£", asText(data?.poNumber)),
                        infoRow("à¸„à¸¹à¹ˆà¸„à¹‰à¸²", asText(vendorData?.name || data?.vendorName)),
                        infoRow("à¹€à¸šà¸­à¸£à¹Œà¹‚à¸—à¸£", asText(vendorData?.phone)),
                        ...(vendorData?.secondaryPhone ? [infoRow("à¹€à¸šà¸­à¸£à¹Œà¸ªà¸³à¸£à¸­à¸‡", asText(vendorData.secondaryPhone))] : []),
                        infoRow("à¸¢à¸­à¸”à¸£à¸§à¸¡à¸—à¸±à¹‰à¸‡à¸ªà¸´à¹‰à¸™", formatAmount(data?.totalAmount), { valueColor: COLOR.title, valueWeight: "bold" }),
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
    data?: NotifyRecord;
    approveUrl: string;
    hasApproveButton: boolean;
}) {
    const { isPending, projectName, data, approveUrl, hasApproveButton } = params;
    const statusText = isPending ? "à¸£à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´" : "à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹à¸¥à¹‰à¸§";
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
                    action: { type: "uri", label: "à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹à¸¥à¸°à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´", uri: approveUrl },
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
                { type: "text", text: asText(projectName, "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¹‚à¸„à¸£à¸‡à¸à¸²à¸£"), size: "sm", color: COLOR.title, weight: "bold", wrap: true },
                { type: "separator", color: COLOR.border },
                {
                    type: "box",
                    layout: "vertical",
                    spacing: "sm",
                    contents: [
                        infoRow("à¸›à¸£à¸°à¹€à¸ à¸—à¹€à¸­à¸à¸ªà¸²à¸£", "à¸‡à¸²à¸™à¹€à¸žà¸´à¹ˆà¸¡-à¸¥à¸” (VO)"),
                        infoRow("à¸ªà¸–à¸²à¸™à¸°", statusText, { valueColor: COLOR.title, valueWeight: "bold" }),
                        infoRow("à¹€à¸¥à¸‚à¸—à¸µà¹ˆà¹€à¸­à¸à¸ªà¸²à¸£", asText(data?.voNumber)),
                        infoRow("à¸«à¸±à¸§à¸‚à¹‰à¸­", asText(data?.title)),
                        infoRow(
                            "à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸‡à¸šà¸›à¸£à¸°à¸¡à¸²à¸“",
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

function buildWCFlex(params: {
    isPending: boolean;
    projectName?: string;
    data?: unknown;
    vendorData?: unknown;
    approveUrl: string;
    hasApproveButton: boolean;
}) {
    const { isPending, projectName, data, vendorData, approveUrl, hasApproveButton } = params;
    const statusText = isPending ? "à¸£à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´" : "à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹à¸¥à¹‰à¸§";
    const docData = (data && typeof data === "object") ? (data as Record<string, unknown>) : {};
    const vendorInfo = (vendorData && typeof vendorData === "object") ? (vendorData as Record<string, unknown>) : {};

    const footerContents: unknown[] = [];
    if (hasApproveButton) {
        footerContents.push({
            type: "button",
            style: "primary",
            color: COLOR.primary,
            height: "sm",
            action: { type: "uri", label: "à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹à¸¥à¸°à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´", uri: approveUrl },
        });
    }

    const secondaryButtons: unknown[] = [];
    if (vendorInfo.phone) {
        secondaryButtons.push({
            type: "button",
            style: "secondary",
            height: "sm",
            action: { type: "uri", label: "à¹‚à¸—à¸£à¸«à¸¥à¸±à¸", uri: `tel:${asText(vendorInfo.phone, "")}` },
        });
    }
    if (vendorInfo.secondaryPhone) {
        secondaryButtons.push({
            type: "button",
            style: "secondary",
            height: "sm",
            action: { type: "uri", label: "à¹‚à¸—à¸£à¸ªà¸³à¸£à¸­à¸‡", uri: `tel:${asText(vendorInfo.secondaryPhone, "")}` },
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
                { type: "text", text: asText(projectName, "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¹‚à¸„à¸£à¸‡à¸à¸²à¸£"), size: "sm", color: COLOR.title, weight: "bold", wrap: true },
                { type: "separator", color: COLOR.border },
                {
                    type: "box",
                    layout: "vertical",
                    spacing: "sm",
                    contents: [
                        infoRow("à¸›à¸£à¸°à¹€à¸ à¸—à¹€à¸­à¸à¸ªà¸²à¸£", "à¹ƒà¸šà¸ˆà¹‰à¸²à¸‡à¸‡à¸²à¸™ (WC)"),
                        infoRow("à¸ªà¸–à¸²à¸™à¸°", statusText, { valueColor: COLOR.title, valueWeight: "bold" }),
                        infoRow("à¹€à¸¥à¸‚à¸—à¸µà¹ˆà¹€à¸­à¸à¸ªà¸²à¸£", asText(docData.wcNumber)),
                        infoRow("à¸œà¸¹à¹‰à¸£à¸±à¸šà¸ˆà¹‰à¸²à¸‡", asText(vendorInfo.name || docData.vendorName)),
                        infoRow("à¹€à¸šà¸­à¸£à¹Œà¹‚à¸—à¸£", asText(vendorInfo.phone)),
                        ...(vendorInfo.secondaryPhone ? [infoRow("à¹€à¸šà¸­à¸£à¹Œà¸ªà¸³à¸£à¸­à¸‡", asText(vendorInfo.secondaryPhone))] : []),
                        infoRow("à¸¢à¸­à¸”à¸£à¸§à¸¡à¸—à¸±à¹‰à¸‡à¸ªà¸´à¹‰à¸™", formatAmount(docData.totalAmount), { valueColor: COLOR.title, valueWeight: "bold" }),
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

function buildPRFlex(params: {
    isPending: boolean;
    projectName?: string;
    data?: NotifyRecord;
    approveUrl: string;
    hasApproveButton: boolean;
}) {
    const { isPending, projectName, data, approveUrl, hasApproveButton } = params;
    const statusText = isPending ? "à¸£à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´" : "à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹ƒà¸«à¹‰à¸ˆà¸±à¸”à¸«à¸²à¹à¸¥à¹‰à¸§";
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
                    action: { type: "uri", label: "à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹à¸¥à¸°à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´", uri: approveUrl },
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
                { type: "text", text: asText(projectName, "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¹‚à¸„à¸£à¸‡à¸à¸²à¸£"), size: "sm", color: COLOR.title, weight: "bold", wrap: true },
                { type: "separator", color: COLOR.border },
                {
                    type: "box",
                    layout: "vertical",
                    spacing: "sm",
                    contents: [
                        infoRow("à¸›à¸£à¸°à¹€à¸ à¸—à¹€à¸­à¸à¸ªà¸²à¸£", "à¹ƒà¸šà¸‚à¸­à¸‹à¸·à¹‰à¸­/à¸‚à¸­à¸ˆà¹‰à¸²à¸‡ (PR)"),
                        infoRow("à¸ªà¸–à¸²à¸™à¸°", statusText, { valueColor: COLOR.title, valueWeight: "bold" }),
                        infoRow("à¹€à¸¥à¸‚à¸—à¸µà¹ˆà¹€à¸­à¸à¸ªà¸²à¸£", asText(data?.prNumber)),
                        infoRow("à¸«à¸±à¸§à¸‚à¹‰à¸­", asText(data?.title)),
                        infoRow("à¸œà¸¹à¹‰à¸‚à¸­", asText(data?.requestedByName)),
                        infoRow("à¸£à¸¹à¸›à¹à¸šà¸šà¸›à¸¥à¸²à¸¢à¸—à¸²à¸‡", asText(data?.fulfillmentType === "wc" ? "à¸­à¸­à¸ WC" : "à¸­à¸­à¸ PO")),
                        infoRow("à¸¡à¸¹à¸¥à¸„à¹ˆà¸²à¸£à¸§à¸¡à¹‚à¸”à¸¢à¸›à¸£à¸°à¸¡à¸²à¸“", formatAmount(data?.totalAmount), { valueColor: COLOR.title, valueWeight: "bold" }),
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

function buildPCFlex(params: {
    isPending: boolean;
    projectName?: string;
    data?: NotifyRecord;
    approveUrl: string;
    hasApproveButton: boolean;
}) {
    const { isPending, projectName, data, approveUrl, hasApproveButton } = params;
    const statusText = isPending ? "à¸£à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¸œà¸¥à¹€à¸—à¸µà¸¢à¸šà¸£à¸²à¸„à¸²" : "à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¸œà¸¥à¹€à¸—à¸µà¸¢à¸šà¸£à¸²à¸„à¸²à¹à¸¥à¹‰à¸§";
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
                    action: { type: "uri", label: "à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹à¸¥à¸°à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´", uri: approveUrl },
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
                { type: "text", text: asText(projectName, "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¹‚à¸„à¸£à¸‡à¸à¸²à¸£"), size: "sm", color: COLOR.title, weight: "bold", wrap: true },
                { type: "separator", color: COLOR.border },
                {
                    type: "box",
                    layout: "vertical",
                    spacing: "sm",
                    contents: [
                        infoRow("à¸›à¸£à¸°à¹€à¸ à¸—à¹€à¸­à¸à¸ªà¸²à¸£", "à¹€à¸­à¸à¸ªà¸²à¸£à¹€à¸—à¸µà¸¢à¸šà¸£à¸²à¸„à¸² (PC)"),
                        infoRow("à¸ªà¸–à¸²à¸™à¸°", statusText, { valueColor: COLOR.title, valueWeight: "bold" }),
                        infoRow("à¹€à¸¥à¸‚à¸—à¸µà¹ˆà¹€à¸­à¸à¸ªà¸²à¸£", asText(data?.comparisonNumber)),
                        infoRow("PR à¸•à¹‰à¸™à¸—à¸²à¸‡", asText(data?.prNumber)),
                        infoRow("à¸«à¸±à¸§à¸‚à¹‰à¸­", asText(data?.title)),
                        infoRow("à¸œà¸¹à¹‰à¸—à¸µà¹ˆà¹€à¸ªà¸™à¸­à¹€à¸¥à¸·à¸­à¸", asText(data?.recommendedSupplierName)),
                        infoRow("à¸¢à¸­à¸”à¸—à¸µà¹ˆà¹€à¸ªà¸™à¸­à¹€à¸¥à¸·à¸­à¸", formatAmount(data?.recommendedTotalAmount), { valueColor: COLOR.title, valueWeight: "bold" }),
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
        const requesterUid = asText(data?.requestedByUid || data?.createdBy, "");
        if (requesterUid) {
            const userDoc = await adminDb.collection("users").doc(requesterUid).get();
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
                        message: `à¸žà¸š LINE ID à¸£à¸¹à¸›à¹à¸šà¸šà¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡: ${invalidConfiguredTargets.join(", ")}`,
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
                        message: "à¹„à¸¡à¹ˆà¸žà¸š LINE ID à¸‚à¸­à¸‡à¹à¸­à¸”à¸¡à¸´à¸™à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸ à¸à¸£à¸¸à¸“à¸²à¸œà¸¹à¸à¸šà¸±à¸à¸Šà¸µ LINE à¹ƒà¸™à¸«à¸™à¹‰à¸² Users à¸à¹ˆà¸­à¸™",
                    },
                    { status: 400 }
                );
            }

            return NextResponse.json({ success: false, message: "No target LINE ID configured" }, { status: 400 });
        }

        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || "";
        const approveUrl = `https://liff.line.me/${liffId}/approve?type=${type}&id=${data?.id || ""}`;
        const viewUrl = `https://liff.line.me/${liffId}/view?type=${type}&id=${data?.id || ""}`;
        const normalizedKind = type ? resolveDocumentKind(type) : null;
        const documentStatus = asText(data?.status, "") || undefined;
        const isPending = normalizedKind ? isPendingDocumentStatus(normalizedKind, documentStatus) : documentStatus === "pending";
        const isApproved = normalizedKind ? isApprovedDocumentStatus(normalizedKind, documentStatus) : documentStatus === "approved";
        const actionUrl = isPending ? approveUrl : viewUrl;
        const hasActionButton = (isPending || isApproved) && !!liffId;

        let altText = "à¹à¸ˆà¹‰à¸‡à¹€à¸•à¸·à¸­à¸™à¹€à¸­à¸à¸ªà¸²à¸£";
        let flexContents: unknown = {};
        if (type === "PO") {
            const poNo = asText(data?.poNumber, "-");
            altText = isPending ? `PO à¸£à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´ - ${poNo}` : `PO à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹à¸¥à¹‰à¸§ - ${poNo}`;
            flexContents = buildPOFlex({
                isPending,
                projectName,
                data,
                vendorData,
                approveUrl: actionUrl,
                hasApproveButton: hasActionButton,
            });
        } else if (type === "VO") {
            const voNo = asText(data?.voNumber, "-");
            altText = isPending ? `VO à¸£à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´ - ${voNo}` : `VO à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹à¸¥à¹‰à¸§ - ${voNo}`;
            flexContents = buildVOFlex({
                isPending,
                projectName,
                data,
                approveUrl: actionUrl,
                hasApproveButton: hasActionButton,
            });
        } else if (type === "WC") {
            const wcNo = asText(data?.wcNumber, "-");
            altText = isPending ? `WC à¸£à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´ - ${wcNo}` : `WC à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹à¸¥à¹‰à¸§ - ${wcNo}`;
            flexContents = buildWCFlex({
                isPending,
                projectName,
                data,
                vendorData,
                approveUrl: actionUrl,
                hasApproveButton: hasActionButton,
            });
        } else if (type === "PR") {
            const prNo = asText(data?.prNumber, "-");
            altText = isPending ? `PR à¸£à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´ - ${prNo}` : `PR à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹ƒà¸«à¹‰à¸ˆà¸±à¸”à¸«à¸² - ${prNo}`;
            flexContents = buildPRFlex({
                isPending,
                projectName,
                data,
                approveUrl: actionUrl,
                hasApproveButton: hasActionButton,
            });
        } else if (type === "PC") {
            const comparisonNo = asText(data?.comparisonNumber, "-");
            altText = isPending ? `PC à¸£à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´ - ${comparisonNo}` : `PC à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹à¸¥à¹‰à¸§ - ${comparisonNo}`;
            flexContents = buildPCFlex({
                isPending,
                projectName,
                data,
                approveUrl: actionUrl,
                hasApproveButton: hasActionButton,
            });
        } else {
            altText = `à¹à¸ˆà¹‰à¸‡à¹€à¸•à¸·à¸­à¸™à¹€à¸­à¸à¸ªà¸²à¸£ - ${asText(type, "N/A")}`;
            flexContents = {
                type: "bubble",
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: asText(projectName, "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¹‚à¸„à¸£à¸‡à¸à¸²à¸£"), size: "sm", color: COLOR.title, weight: "bold", wrap: true },
                        { type: "separator", color: COLOR.border, margin: "md" },
                        infoRow("à¸›à¸£à¸°à¹€à¸ à¸—à¹€à¸­à¸à¸ªà¸²à¸£", normalizedKind ? getDocumentKindLabel(normalizedKind) : asText(type, "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸")),
                        infoRow("à¸ªà¸–à¸²à¸™à¸°", asText(data?.status, "-"), { valueColor: COLOR.title, valueWeight: "bold" }),
                    ],
                    spacing: "md",
                },
                styles: {
                    body: { backgroundColor: "#ffffff" },
                },
            };
        }

        if (isApproved && flexContents && typeof flexContents === "object") {
            const bubble = flexContents as { footer?: { contents?: Array<{ type?: string; action?: { label?: string } }> } };
            const primaryButton = bubble.footer?.contents?.find((item) => item?.type === "button");
            if (primaryButton?.action) {
                primaryButton.action.label = "à¸”à¸¹à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹€à¸­à¸à¸ªà¸²à¸£";
            }
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
            const firstFailedReason = failedTargets[0]?.reason || "à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸£à¸°à¸šà¸¸à¸ªà¸²à¹€à¸«à¸•à¸¸à¹„à¸”à¹‰";
            return NextResponse.json(
                {
                    success: false,
                    message: `à¸ªà¹ˆà¸‡à¹à¸ˆà¹‰à¸‡à¹€à¸•à¸·à¸­à¸™ LINE à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ (${failedTargets.length} à¸œà¸¹à¹‰à¸£à¸±à¸š): ${firstFailedReason}`,
                    firstFailedReason,
                    failedTargets,
                },
                { status: 400 }
            );
        }

        if (failedTargets.length > 0) {
            console.warn("LINE API Partial Success:", { successTargets, failedTargets });
            const firstFailedReason = failedTargets[0]?.reason || "à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸£à¸°à¸šà¸¸à¸ªà¸²à¹€à¸«à¸•à¸¸à¹„à¸”à¹‰";
            return NextResponse.json({
                success: true,
                partial: true,
                message: `à¸ªà¹ˆà¸‡à¹à¸ˆà¹‰à¸‡à¹€à¸•à¸·à¸­à¸™à¹„à¸”à¹‰ ${successTargets.length} à¸£à¸²à¸¢à¸à¸²à¸£ à¹à¸¥à¸°à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ ${failedTargets.length} à¸£à¸²à¸¢à¸à¸²à¸£: ${firstFailedReason}`,
                recipientCount: successTargets.length,
                failedCount: failedTargets.length,
                firstFailedReason,
                failedTargets,
            });
        }

        return NextResponse.json({
            success: true,
            message: "à¸ªà¹ˆà¸‡à¹à¸ˆà¹‰à¸‡à¹€à¸•à¸·à¸­à¸™à¸ªà¸³à¹€à¸£à¹‡à¸ˆ",
            recipientCount: successTargets.length,
        });
    } catch (error: unknown) {
        console.error("Error sending LINE notification:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

