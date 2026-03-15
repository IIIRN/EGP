import type {
    PurchaseRequisition,
    PurchaseRequisitionApprovalAction,
    PurchaseRequisitionStatus,
} from "@/types/pr";

export const DEFAULT_PR_VAT_RATE = 7;

export function getPurchaseRequisitionStatusMeta(status?: string) {
    switch (status) {
        case "draft":
            return { label: "ฉบับร่าง", color: "bg-slate-100 text-slate-800" };
        case "pending_need_approval":
            return { label: "รออนุมัติคำขอ", color: "bg-amber-100 text-amber-800" };
        case "approved_for_sourcing":
            return { label: "อนุมัติให้จัดหา", color: "bg-emerald-100 text-emerald-800" };
        case "sourcing":
            return { label: "กำลังจัดหา", color: "bg-sky-100 text-sky-800" };
        case "comparing":
            return { label: "กำลังเทียบราคา", color: "bg-blue-100 text-blue-800" };
        case "selection_pending":
            return { label: "รออนุมัติผลเทียบราคา", color: "bg-amber-100 text-amber-800" };
        case "selected":
            return { label: "เลือกผู้ขาย/ผู้รับจ้างแล้ว", color: "bg-emerald-100 text-emerald-800" };
        case "converted_partial":
            return { label: "ออกเอกสารปลายทางบางส่วน", color: "bg-violet-100 text-violet-800" };
        case "converted_full":
            return { label: "ออกเอกสารปลายทางแล้ว", color: "bg-violet-100 text-violet-800" };
        case "rejected":
            return { label: "ไม่อนุมัติ", color: "bg-rose-100 text-rose-800" };
        case "cancelled":
            return { label: "ยกเลิก", color: "bg-slate-200 text-slate-700" };
        default:
            return { label: status || "-", color: "bg-slate-100 text-slate-800" };
    }
}

export function isPurchaseRequisitionPendingApproval(status?: string) {
    return status === "pending_need_approval";
}

export function isPurchaseRequisitionApproved(status?: string) {
    return status === "approved_for_sourcing";
}

export function canCreatePriceComparison(status?: string) {
    return (
        status === "approved_for_sourcing" ||
        status === "sourcing" ||
        status === "comparing" ||
        status === "selection_pending" ||
        status === "selected"
    );
}

export function canConvertPurchaseRequisition(status?: string) {
    return status === "selected" || status === "converted_partial";
}

export function getPurchaseRequisitionDeleteBlockReason(params: {
    comparisonCount?: number;
    linkedPoIds?: string[];
    linkedWcIds?: string[];
}) {
    const comparisonCount = Number(params.comparisonCount) || 0;
    const linkedPoCount = Array.isArray(params.linkedPoIds) ? params.linkedPoIds.filter(Boolean).length : 0;
    const linkedWcCount = Array.isArray(params.linkedWcIds) ? params.linkedWcIds.filter(Boolean).length : 0;

    if (linkedPoCount > 0 || linkedWcCount > 0) {
        return "ลบ PR ไม่ได้ เพราะมีเอกสาร PO/WC ที่อ้างอิงจาก PR นี้แล้ว";
    }

    if (comparisonCount > 0) {
        return "ลบ PR ไม่ได้ เพราะมีเอกสารเปรียบเทียบราคาที่อ้างอิง PR นี้แล้ว";
    }

    return "";
}

export function appendLinkedDocumentId(currentIds: string[] | undefined, nextId: string) {
    const baseIds = Array.isArray(currentIds) ? currentIds.filter(Boolean) : [];
    if (!nextId) return baseIds;
    return baseIds.includes(nextId) ? baseIds : [...baseIds, nextId];
}

export function getPurchaseRequisitionPrimaryLinkedTargetId(
    requisition: Pick<PurchaseRequisition, "fulfillmentType" | "linkedPoIds" | "linkedWcIds">
) {
    const targetIds = requisition.fulfillmentType === "po"
        ? requisition.linkedPoIds
        : requisition.linkedWcIds;

    return Array.isArray(targetIds) && targetIds.length > 0 ? targetIds[0] : "";
}

export function getPurchaseRequisitionConvertedStatus(params: {
    fulfillmentType: PurchaseRequisition["fulfillmentType"];
    linkedPoIds?: string[];
    linkedWcIds?: string[];
    fallbackStatus?: PurchaseRequisitionStatus;
}): PurchaseRequisitionStatus {
    const {
        fulfillmentType,
        linkedPoIds,
        linkedWcIds,
        fallbackStatus = "selected",
    } = params;

    const poIds = Array.isArray(linkedPoIds) ? linkedPoIds.filter(Boolean) : [];
    const wcIds = Array.isArray(linkedWcIds) ? linkedWcIds.filter(Boolean) : [];
    const hasTargetDocument = fulfillmentType === "po" ? poIds.length > 0 : wcIds.length > 0;

    if (hasTargetDocument) {
        return "converted_full";
    }

    if (poIds.length > 0 || wcIds.length > 0) {
        return "converted_partial";
    }

    return fallbackStatus;
}

export function buildPendingNeedApprovalTrail(): PurchaseRequisitionApprovalAction[] {
    return [
        {
            stepKey: "need_approval",
            stepLabel: "อนุมัติคำขอซื้อ/จ้าง",
            status: "pending",
        },
    ];
}

export function getPurchaseRequisitionDecisionStatus(
    decision: "approved" | "rejected"
): PurchaseRequisitionStatus {
    return decision === "approved" ? "approved_for_sourcing" : "rejected";
}

export function finalizePurchaseRequisitionApprovalTrail(params: {
    currentTrail?: PurchaseRequisitionApprovalAction[];
    decision: "approved" | "rejected";
    approverUid?: string;
    approverName?: string;
    role?: string;
    actionAt: unknown;
}) {
    const {
        currentTrail,
        decision,
        approverUid,
        approverName,
        role,
        actionAt,
    } = params;

    const nextStatus = decision === "approved" ? "approved" : "rejected";
    const trail = Array.isArray(currentTrail) && currentTrail.length > 0
        ? [...currentTrail]
        : buildPendingNeedApprovalTrail();

    const targetIndex = trail.findIndex((step) => step.stepKey === "need_approval");
    const nextAction: PurchaseRequisitionApprovalAction = {
        stepKey: "need_approval",
        stepLabel: "อนุมัติคำขอซื้อ/จ้าง",
        approverUid,
        approverName,
        role,
        status: nextStatus,
        actionAt,
    };

    if (targetIndex >= 0) {
        trail[targetIndex] = {
            ...trail[targetIndex],
            ...nextAction,
        };
        return trail;
    }

    trail.push(nextAction);
    return trail;
}
