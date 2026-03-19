import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import {
    getDocumentNumber,
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

type FooterAction = {
    label: string;
    uri: string;
    style?: "primary" | "secondary";
    color?: string;
    inline?: boolean;
};

const COLOR = {
    title: "#1e3a8a",
    text: "#334155",
    muted: "#64748b",
    border: "#e2e8f0",
    surface: "#f8fafc",
    primary: "#1d4ed8",
    success: "#16a34a",
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

    if (typeof data.message === "string" && data.message.trim()) {
        return data.message.trim();
    }

    return "ไม่สามารถระบุสาเหตุได้";
}

function isValidLineRecipientId(value: string): boolean {
    const normalized = value.trim();
    // LINE push target supports User/Group/Room IDs in the form U/C/R + 32 hex chars.
    return /^[UCR][0-9a-f]{32}$/i.test(normalized);
}

function formatAmount(value: unknown): string {
    return `฿${toAmount(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shouldRetryAsPlainText(errorData: unknown) {
    if (!errorData || typeof errorData !== "object") return false;

    const data = errorData as { message?: unknown; details?: unknown };
    if (typeof data.message === "string" && data.message.toLowerCase().includes("messages[0]")) {
        return true;
    }

    return Array.isArray(data.details) && data.details.length > 0;
}

function getNotifyDocumentLabel(docKind: ReturnType<typeof resolveDocumentKind>) {
    if (docKind === "PO") return "ใบสั่งซื้อ (PO)";
    if (docKind === "VO") return "งานเพิ่ม-ลด (VO)";
    if (docKind === "WC") return "ใบจ้างงาน (WC)";
    if (docKind === "PR") return "ใบขอซื้อ/ขอจ้าง (PR)";
    if (docKind === "PC") return "เอกสารเทียบราคา (PC)";
    return "-";
}

function buildPlainTextMessage(params: {
    type?: string;
    projectName?: string;
    data?: NotifyRecord;
    vendorData?: NotifyRecord;
}) {
    const { type, projectName, data, vendorData } = params;
    const normalizedKind = type ? resolveDocumentKind(type) : null;
    const documentStatus = asText(data?.status, "") || undefined;
    const isPending = normalizedKind ? isPendingDocumentStatus(normalizedKind, documentStatus) : documentStatus === "pending";
    const isApproved = normalizedKind ? isApprovedDocumentStatus(normalizedKind, documentStatus) : documentStatus === "approved";
    const docLabel = normalizedKind ? getNotifyDocumentLabel(normalizedKind) : asText(type, "เอกสาร");
    const docNumber = getDocumentNumber({
        comparisonNumber: data?.comparisonNumber,
        poNumber: data?.poNumber,
        voNumber: data?.voNumber,
        wcNumber: data?.wcNumber,
        prNumber: data?.prNumber,
    });

    let statusText = asText(data?.status, "-");
    if (isPending) {
        statusText = "รออนุมัติ";
    } else if (isApproved) {
        statusText = "อนุมัติแล้ว";
    }

    const detailLines: string[] = [];
    if (type === "PO") {
        detailLines.push(`คู่ค้า: ${asText(vendorData?.name || data?.vendorName)}`);
        detailLines.push(`ยอดรวม: ${formatAmount(data?.totalAmount)}`);
    } else if (type === "WC") {
        detailLines.push(`ผู้รับจ้าง: ${asText(vendorData?.name || data?.vendorName)}`);
        detailLines.push(`ยอดรวม: ${formatAmount(data?.totalAmount)}`);
    } else if (type === "VO") {
        detailLines.push(`หัวข้อ: ${asText(data?.title)}`);
        detailLines.push(`มูลค่า: ${formatAmount(data?.totalAmount)}`);
    } else if (type === "PR") {
        detailLines.push(`หัวข้อ: ${asText(data?.title)}`);
        detailLines.push(`ผู้ขอ: ${asText(data?.requestedByName)}`);
        detailLines.push(`มูลค่า: ${formatAmount(data?.totalAmount)}`);
    } else if (type === "PC") {
        detailLines.push(`PR: ${asText(data?.prNumber)}`);
        detailLines.push(`ผู้ที่เสนอเลือก: ${asText(data?.recommendedSupplierName)}`);
        detailLines.push(`ยอดที่เลือก: ${formatAmount(data?.recommendedTotalAmount)}`);
    }

    return [
        `แจ้งเตือน${docLabel}`,
        `โครงการ: ${asText(projectName, "ไม่ระบุโครงการ")}`,
        `เลขที่: ${docNumber}`,
        `สถานะ: ${statusText}`,
        ...detailLines,
    ].join("\n");
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

function sanitizePhoneUri(value: unknown): string | null {
    const raw = asText(value, "");
    if (!raw) return null;
    const normalized = raw.replace(/\s+/g, "");
    return normalized ? `tel:${normalized}` : null;
}

function sanitizeMapUri(value: unknown): string | null {
    const raw = asText(value, "");
    if (!raw) return null;
    return /^https?:\/\//i.test(raw) ? raw : null;
}

function buildVendorFooterActions(vendorData?: NotifyRecord): FooterAction[] {
    const actions: FooterAction[] = [];
    const primaryPhoneUri = sanitizePhoneUri(vendorData?.phone);
    const secondaryPhoneUri = sanitizePhoneUri(vendorData?.secondaryPhone);
    const mapUri = sanitizeMapUri(vendorData?.googleMapUrl);

    if (primaryPhoneUri) {
        actions.push({
            label: "โทรหลัก",
            uri: primaryPhoneUri,
            style: "secondary",
            inline: true,
        });
    }

    if (secondaryPhoneUri) {
        actions.push({
            label: "โทรสำรอง",
            uri: secondaryPhoneUri,
            style: "secondary",
            inline: true,
        });
    }

    if (mapUri) {
        actions.push({
            label: "แผนที่",
            uri: mapUri,
            style: "secondary",
        });
    }

    return actions;
}

function buildFooterButton(item: FooterAction, options?: { flex?: number }) {
    return {
        type: "button",
        style: item.style || "secondary",
        ...(item.color ? { color: item.color } : {}),
        ...(options?.flex ? { flex: options.flex } : {}),
        height: "sm",
        action: { type: "uri", label: item.label, uri: item.uri },
    };
}

function buildDocumentFooter(
    actionUrl: string,
    hasActionButton: boolean,
    actionLabel: string,
    actionColor = COLOR.primary,
    extraActions: FooterAction[] = []
) {
    if (!hasActionButton && extraActions.length === 0) return undefined;

    const extraActionContents: Array<Record<string, unknown>> = [];
    for (let index = 0; index < extraActions.length; index += 1) {
        const currentAction = extraActions[index];
        const nextAction = extraActions[index + 1];

        if (currentAction.inline && nextAction?.inline) {
            extraActionContents.push({
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                    buildFooterButton(currentAction, { flex: 1 }),
                    buildFooterButton(nextAction, { flex: 1 }),
                ],
            });
            index += 1;
            continue;
        }

        extraActionContents.push(buildFooterButton(currentAction));
    }

    return {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
            ...(hasActionButton ? [{
                type: "button",
                style: "primary",
                color: actionColor,
                height: "sm",
                action: { type: "uri", label: actionLabel, uri: actionUrl },
            }] : []),
            ...extraActionContents,
        ],
    };
}

function buildDocumentFlexBubble(params: {
    projectName?: string;
    docTypeLabel: string;
    statusText: string;
    statusColor?: string;
    documentNumber: string;
    detailRows: ReturnType<typeof infoRow>[];
    actionUrl: string;
    hasActionButton: boolean;
    actionLabel: string;
    actionColor?: string;
    extraActions?: FooterAction[];
}) {
    const {
        projectName,
        docTypeLabel,
        statusText,
        statusColor = COLOR.title,
        documentNumber,
        detailRows,
        actionUrl,
        hasActionButton,
        actionLabel,
        actionColor = COLOR.primary,
        extraActions = [],
    } = params;

    return {
        type: "bubble",
        size: "mega",
        body: {
            type: "box",
            layout: "vertical",
            spacing: "md",
            contents: [
                {
                    type: "text",
                    text: asText(projectName, "ไม่ระบุโครงการ"),
                    size: "sm",
                    color: COLOR.title,
                    weight: "bold",
                    wrap: true,
                },
                { type: "separator", color: COLOR.border },
                {
                    type: "box",
                    layout: "vertical",
                    spacing: "sm",
                    contents: [
                        infoRow("ประเภทเอกสาร", docTypeLabel),
                        infoRow("สถานะ", statusText, { valueColor: statusColor, valueWeight: "bold" }),
                        infoRow("เลขที่เอกสาร", documentNumber),
                        ...detailRows,
                    ],
                },
            ],
        },
        footer: buildDocumentFooter(
            actionUrl,
            hasActionButton,
            actionLabel,
            actionColor,
            extraActions
        ),
        styles: {
            body: { backgroundColor: "#ffffff" },
            footer: { backgroundColor: COLOR.surface, separator: true },
        },
    };
}

function buildPOFlex(params: {
    isPending: boolean;
    projectName?: string;
    data?: NotifyRecord;
    vendorData?: NotifyRecord;
    approveUrl: string;
    hasApproveButton: boolean;
    actionLabel: string;
}) {
    const { isPending, projectName, data, vendorData, approveUrl, hasApproveButton, actionLabel } = params;

    return buildDocumentFlexBubble({
        projectName,
        docTypeLabel: "ใบสั่งซื้อ (PO)",
        statusText: isPending ? "รออนุมัติ" : "อนุมัติแล้ว",
        statusColor: isPending ? COLOR.title : COLOR.success,
        documentNumber: asText(data?.poNumber),
        detailRows: [
            infoRow("คู่ค้า", asText(vendorData?.name || data?.vendorName)),
            infoRow("เบอร์โทร", asText(vendorData?.phone)),
            ...(vendorData?.secondaryPhone ? [infoRow("เบอร์สำรอง", asText(vendorData.secondaryPhone))] : []),
            infoRow("ยอดรวมทั้งสิ้น", formatAmount(data?.totalAmount), { valueColor: COLOR.title, valueWeight: "bold" }),
        ],
        actionUrl: approveUrl,
        hasActionButton: hasApproveButton,
        actionLabel,
        actionColor: isPending ? COLOR.primary : COLOR.success,
        extraActions: buildVendorFooterActions(vendorData),
    });
}

function buildVOFlex(params: {
    isPending: boolean;
    projectName?: string;
    data?: NotifyRecord;
    approveUrl: string;
    hasApproveButton: boolean;
    actionLabel: string;
}) {
    const { isPending, projectName, data, approveUrl, hasApproveButton, actionLabel } = params;
    const impactValue = toAmount(data?.totalAmount);

    return buildDocumentFlexBubble({
        projectName,
        docTypeLabel: "งานเพิ่ม-ลด (VO)",
        statusText: isPending ? "รออนุมัติ" : "อนุมัติแล้ว",
        statusColor: isPending ? COLOR.title : COLOR.success,
        documentNumber: asText(data?.voNumber),
        detailRows: [
            infoRow("หัวข้อ", asText(data?.title)),
            infoRow(
                "ผลกระทบงบประมาณ",
                `${impactValue > 0 ? "+" : ""}${formatAmount(impactValue)}`,
                { valueColor: COLOR.title, valueWeight: "bold" }
            ),
        ],
        actionUrl: approveUrl,
        hasActionButton: hasApproveButton,
        actionLabel,
        actionColor: isPending ? COLOR.primary : COLOR.success,
    });
}

function buildWCFlex(params: {
    isPending: boolean;
    projectName?: string;
    data?: NotifyRecord;
    vendorData?: NotifyRecord;
    approveUrl: string;
    hasApproveButton: boolean;
    actionLabel: string;
}) {
    const { isPending, projectName, data, vendorData, approveUrl, hasApproveButton, actionLabel } = params;

    return buildDocumentFlexBubble({
        projectName,
        docTypeLabel: "ใบจ้างงาน (WC)",
        statusText: isPending ? "รออนุมัติ" : "อนุมัติแล้ว",
        statusColor: isPending ? COLOR.title : COLOR.success,
        documentNumber: asText(data?.wcNumber),
        detailRows: [
            infoRow("ผู้รับจ้าง", asText(vendorData?.name || data?.vendorName)),
            infoRow("เบอร์โทร", asText(vendorData?.phone)),
            ...(vendorData?.secondaryPhone ? [infoRow("เบอร์สำรอง", asText(vendorData.secondaryPhone))] : []),
            infoRow("ยอดรวมทั้งสิ้น", formatAmount(data?.totalAmount), { valueColor: COLOR.title, valueWeight: "bold" }),
        ],
        actionUrl: approveUrl,
        hasActionButton: hasApproveButton,
        actionLabel,
        actionColor: isPending ? COLOR.primary : COLOR.success,
        extraActions: buildVendorFooterActions(vendorData),
    });
}

function buildPRFlex(params: {
    isPending: boolean;
    projectName?: string;
    data?: NotifyRecord;
    approveUrl: string;
    hasApproveButton: boolean;
    actionLabel: string;
}) {
    const { isPending, projectName, data, approveUrl, hasApproveButton, actionLabel } = params;

    return buildDocumentFlexBubble({
        projectName,
        docTypeLabel: "ใบขอซื้อ/ขอจ้าง (PR)",
        statusText: isPending ? "รออนุมัติ" : "อนุมัติให้จัดหาแล้ว",
        statusColor: isPending ? COLOR.title : COLOR.success,
        documentNumber: asText(data?.prNumber),
        detailRows: [
            infoRow("หัวข้อ", asText(data?.title)),
            infoRow("ผู้ขอ", asText(data?.requestedByName)),
            infoRow("รูปแบบปลายทาง", asText(data?.fulfillmentType === "wc" ? "ออก WC" : "ออก PO")),
            infoRow("มูลค่ารวมโดยประมาณ", formatAmount(data?.totalAmount), { valueColor: COLOR.title, valueWeight: "bold" }),
        ],
        actionUrl: approveUrl,
        hasActionButton: hasApproveButton,
        actionLabel,
        actionColor: isPending ? COLOR.primary : COLOR.success,
    });
}

function buildPCFlex(params: {
    isPending: boolean;
    projectName?: string;
    data?: NotifyRecord;
    approveUrl: string;
    hasApproveButton: boolean;
    actionLabel: string;
}) {
    const { isPending, projectName, data, approveUrl, hasApproveButton, actionLabel } = params;

    return buildDocumentFlexBubble({
        projectName,
        docTypeLabel: "เอกสารเทียบราคา (PC)",
        statusText: isPending ? "รออนุมัติผลเทียบราคา" : "อนุมัติผลเทียบราคาแล้ว",
        statusColor: isPending ? COLOR.title : COLOR.success,
        documentNumber: asText(data?.comparisonNumber),
        detailRows: [
            infoRow("PR ต้นทาง", asText(data?.prNumber)),
            infoRow("หัวข้อ", asText(data?.title)),
            infoRow("ผู้ที่เสนอเลือก", asText(data?.recommendedSupplierName)),
            infoRow("ยอดที่เสนอเลือก", formatAmount(data?.recommendedTotalAmount), { valueColor: COLOR.title, valueWeight: "bold" }),
        ],
        actionUrl: approveUrl,
        hasActionButton: hasApproveButton,
        actionLabel,
        actionColor: isPending ? COLOR.primary : COLOR.success,
    });
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as NotifyBody;
        const { type, data, vendorData, projectName } = body;

        const settingsDoc = await adminDb.collection("system_settings").doc("global_config").get();
        if (!settingsDoc.exists) {
            return NextResponse.json({ success: false, message: "LINE settings not found" }, { status: 500 });
        }

        const settings = (settingsDoc.data()?.lineIntegration || {}) as LineSettings;
        const lineToken = asText(settings.lineToken, "");
        if (!settings.isEnabled || !lineToken) {
            return NextResponse.json(
                { success: false, message: "LINE integration is disabled or token missing" },
                { status: 400 }
            );
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

        if (
            configuredTargetIds.size === 0 &&
            candidateAdminUids.size === 0 &&
            !asText(settings.groupId, "") &&
            !asText(settings.userId, "")
        ) {
            const adminSnapshot = await adminDb
                .collection("users")
                .where("role", "==", "admin")
                .get();

            for (const adminDoc of adminSnapshot.docs) {
                const adminData = adminDoc.data() as { isActive?: boolean; lineUserId?: unknown };
                if (adminData.isActive === false) continue;

                const lineUserId = asText(adminData.lineUserId, "");
                if (lineUserId) {
                    pushTarget(lineUserId, `auto-admin:${adminDoc.id}`);
                }
            }
        }

        if (configuredTargetIds.size === 0) {
            pushTarget(settings.userId, "legacyUserId");
        }

        let resolvedProjectName = asText(projectName, "");
        const sourceProjectId = asText(data?.projectId, "");
        if (!resolvedProjectName && sourceProjectId) {
            const projectSnapshot = await adminDb.collection("projects").doc(sourceProjectId).get();
            if (projectSnapshot.exists) {
                resolvedProjectName = asText(projectSnapshot.data()?.name, "");
            }
        }

        let resolvedVendorData = vendorData;
        const sourceVendorId = asText(data?.vendorId, "");
        if ((type === "PO" || type === "WC") && sourceVendorId) {
            const hasPhone = Boolean(asText(resolvedVendorData?.phone, ""));
            const hasMap = Boolean(asText(resolvedVendorData?.googleMapUrl, ""));
            const sourceCollection = type === "PO" ? "vendors" : "contractors";
            const shouldHydrateVendor = !hasPhone || (type === "PO" && !hasMap);

            if (shouldHydrateVendor) {
                const sourceDoc = await adminDb.collection(sourceCollection).doc(sourceVendorId).get();
                if (sourceDoc.exists) {
                    resolvedVendorData = {
                        id: sourceDoc.id,
                        ...sourceDoc.data(),
                        ...(resolvedVendorData || {}),
                    };
                }
            }
        }

        const normalizedKind = type ? resolveDocumentKind(type) : null;
        const documentStatus = asText(data?.status, "") || undefined;
        const isPending = normalizedKind ? isPendingDocumentStatus(normalizedKind, documentStatus) : documentStatus === "pending";
        const isApproved = normalizedKind ? isApprovedDocumentStatus(normalizedKind, documentStatus) : documentStatus === "approved";
        let requesterLineId: string | null = null;
        const requesterUid = asText(data?.requestedByUid || data?.createdBy, "");
        if (requesterUid) {
            const userDoc = await adminDb.collection("users").doc(requesterUid).get();
            if (userDoc.exists) {
                requesterLineId = asText(userDoc.data()?.lineUserId, "") || null;
            }
        }

        let targetIds = Array.from(configuredTargetIds);
        if (isApproved && requesterLineId) {
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
                        message: `Invalid LINE recipient ID format: ${invalidConfiguredTargets.join(", ")}`,
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
                        message: "Selected admin users do not have valid LINE recipient IDs configured",
                    },
                    { status: 400 }
                );
            }

            return NextResponse.json({ success: false, message: "No target LINE ID configured" }, { status: 400 });
        }

        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || "";
        const approveUrl = `https://liff.line.me/${liffId}/approve?type=${type}&id=${data?.id || ""}`;
        const viewUrl = `https://liff.line.me/${liffId}/view?type=${type}&id=${data?.id || ""}`;
        const actionUrl = isPending ? approveUrl : viewUrl;
        const hasActionButton = (isPending || isApproved) && !!liffId;
        const actionLabel = isPending ? "ตรวจสอบและอนุมัติ" : "ดูข้อมูลเอกสาร";

        let altText = "แจ้งเตือนเอกสาร";
        let flexContents: unknown = {};
        if (type === "PO") {
            const poNo = asText(data?.poNumber, "-");
            altText = isPending ? `PO รออนุมัติ - ${poNo}` : `PO อนุมัติแล้ว - ${poNo}`;
            flexContents = buildPOFlex({
                isPending,
                projectName: resolvedProjectName,
                data,
                vendorData: resolvedVendorData,
                approveUrl: actionUrl,
                hasApproveButton: hasActionButton,
                actionLabel,
            });
        } else if (type === "VO") {
            const voNo = asText(data?.voNumber, "-");
            altText = isPending ? `VO รออนุมัติ - ${voNo}` : `VO อนุมัติแล้ว - ${voNo}`;
            flexContents = buildVOFlex({
                isPending,
                projectName: resolvedProjectName,
                data,
                approveUrl: actionUrl,
                hasApproveButton: hasActionButton,
                actionLabel,
            });
        } else if (type === "WC") {
            const wcNo = asText(data?.wcNumber, "-");
            altText = isPending ? `WC รออนุมัติ - ${wcNo}` : `WC อนุมัติแล้ว - ${wcNo}`;
            flexContents = buildWCFlex({
                isPending,
                projectName: resolvedProjectName,
                data,
                vendorData: resolvedVendorData,
                approveUrl: actionUrl,
                hasApproveButton: hasActionButton,
                actionLabel,
            });
        } else if (type === "PR") {
            const prNo = asText(data?.prNumber, "-");
            altText = isPending ? `PR รออนุมัติ - ${prNo}` : `PR อนุมัติให้จัดหา - ${prNo}`;
            flexContents = buildPRFlex({
                isPending,
                projectName: resolvedProjectName,
                data,
                approveUrl: actionUrl,
                hasApproveButton: hasActionButton,
                actionLabel,
            });
        } else if (type === "PC") {
            const comparisonNo = asText(data?.comparisonNumber, "-");
            altText = isPending ? `PC รออนุมัติ - ${comparisonNo}` : `PC อนุมัติแล้ว - ${comparisonNo}`;
            flexContents = buildPCFlex({
                isPending,
                projectName: resolvedProjectName,
                data,
                approveUrl: actionUrl,
                hasApproveButton: hasActionButton,
                actionLabel,
            });
        } else {
            altText = `แจ้งเตือนเอกสาร - ${asText(type, "N/A")}`;
            flexContents = {
                type: "bubble",
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: asText(resolvedProjectName, "ไม่ระบุโครงการ"), size: "sm", color: COLOR.title, weight: "bold", wrap: true },
                        { type: "separator", color: COLOR.border, margin: "md" },
                        infoRow("ประเภทเอกสาร", normalizedKind ? getNotifyDocumentLabel(normalizedKind) : asText(type, "ไม่ระบุ")),
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
        const sendPushMessage = async (targetId: string, messages: unknown[]) => {
            return fetch("https://api.line.me/v2/bot/message/push", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${lineToken}`,
                },
                body: JSON.stringify({
                    to: targetId,
                    messages,
                }),
            });
        };

        for (const targetId of targetIds) {
            if (!isValidLineRecipientId(targetId)) {
                failedTargets.push({
                    targetId,
                    status: 400,
                    reason: "Invalid LINE recipient ID format",
                    error: { message: "Skipped before LINE API call because recipient ID format is invalid" },
                });
                continue;
            }

            const lineRes = await sendPushMessage(targetId, [
                {
                    type: "flex",
                    altText,
                    contents: flexContents,
                },
            ]);

            if (!lineRes.ok) {
                let errorData: unknown = null;
                try {
                    errorData = await lineRes.json();
                } catch {
                    errorData = { status: lineRes.status, statusText: lineRes.statusText };
                }
                const reason = extractLineErrorReason(errorData);
                const canRetryAsText = lineRes.status === 400 && shouldRetryAsPlainText(errorData);

                if (canRetryAsText) {
                    const fallbackRes = await sendPushMessage(targetId, [
                        {
                            type: "text",
                            text: buildPlainTextMessage({ type, projectName: resolvedProjectName, data, vendorData: resolvedVendorData }),
                        },
                    ]);

                    if (fallbackRes.ok) {
                        successTargets.push(targetId);
                        continue;
                    }

                    let fallbackErrorData: unknown = null;
                    try {
                        fallbackErrorData = await fallbackRes.json();
                    } catch {
                        fallbackErrorData = { status: fallbackRes.status, statusText: fallbackRes.statusText };
                    }

                    failedTargets.push({
                        targetId,
                        status: fallbackRes.status,
                        reason: extractLineErrorReason(fallbackErrorData),
                        error: {
                            flexError: errorData,
                            fallbackError: fallbackErrorData,
                        },
                    });
                    continue;
                }

                failedTargets.push({
                    targetId,
                    status: lineRes.status,
                    reason,
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
                    message: `LINE notification failed for ${failedTargets.length} recipient(s): ${firstFailedReason}`,
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
                message: `LINE notification sent to ${successTargets.length} recipient(s) and failed for ${failedTargets.length}: ${firstFailedReason}`,
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
    } catch (error: unknown) {
        console.error("Error sending LINE notification:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

