import type {
    PurchaseRequisitionFulfillmentType,
    PurchaseRequisitionRequestType,
    PurchaseRequisitionStatus,
    PurchaseRequisitionUrgency,
} from "@/types/pr";

type RequesterStatusMeta = {
    label: string;
    color: string;
    description: string;
    stage: 1 | 2 | 3 | 4;
    isCompleted?: boolean;
};

type RequesterProgressState = "done" | "current" | "todo";

export type RequesterProgressStep = {
    key: "request" | "approval" | "procurement" | "ordered";
    label: string;
    state: RequesterProgressState;
};

export function getRequesterStatusMeta(status?: PurchaseRequisitionStatus): RequesterStatusMeta {
    switch (status) {
        case "draft":
            return {
                label: "ฉบับร่าง",
                color: "bg-slate-100 text-slate-700",
                description: "คำขอนี้ยังเป็นฉบับร่างและยังไม่ได้ส่งขออนุมัติ",
                stage: 1,
            };
        case "pending_need_approval":
            return {
                label: "รออนุมัติ",
                color: "bg-amber-100 text-amber-800",
                description: "ส่งคำขอเรียบร้อยแล้ว และกำลังรอผู้อนุมัติพิจารณา",
                stage: 2,
            };
        case "approved_for_sourcing":
        case "sourcing":
        case "comparing":
        case "selection_pending":
            return {
                label: "อยู่ระหว่างจัดซื้อ",
                color: "bg-sky-100 text-sky-800",
                description: "ฝ่ายจัดซื้อกำลังหา supplier และเปรียบเทียบราคาให้คำขอนี้",
                stage: 3,
            };
        case "selected":
            return {
                label: "คัดเลือกผู้ขายแล้ว",
                color: "bg-indigo-100 text-indigo-800",
                description: "เลือกผู้ขายเรียบร้อยแล้ว และกำลังเตรียมเอกสารสั่งซื้อหรือสั่งจ้าง",
                stage: 3,
            };
        case "converted_partial":
            return {
                label: "ออกเอกสารบางส่วนแล้ว",
                color: "bg-violet-100 text-violet-800",
                description: "คำขอนี้ถูกนำไปออกเอกสารสั่งซื้อหรือสั่งจ้างแล้วบางส่วน",
                stage: 4,
            };
        case "converted_full":
            return {
                label: "ออกเอกสารแล้ว",
                color: "bg-emerald-100 text-emerald-800",
                description: "คำขอนี้ถูกนำไปออกเอกสารสั่งซื้อหรือสั่งจ้างเรียบร้อยแล้ว",
                stage: 4,
                isCompleted: true,
            };
        case "rejected":
            return {
                label: "ไม่อนุมัติ",
                color: "bg-rose-100 text-rose-800",
                description: "คำขอนี้ไม่ได้รับการอนุมัติ คุณสามารถแก้ไขและส่งใหม่ได้",
                stage: 2,
            };
        case "cancelled":
            return {
                label: "ยกเลิก",
                color: "bg-slate-200 text-slate-700",
                description: "คำขอนี้ถูกยกเลิกแล้ว",
                stage: 1,
            };
        default:
            return {
                label: status || "-",
                color: "bg-slate-100 text-slate-700",
                description: "ไม่สามารถระบุสถานะของคำขอนี้ได้",
                stage: 1,
            };
    }
}

export function getRequesterFilterGroups() {
    return [
        { value: "all", label: "ทั้งหมด" },
        { value: "draft", label: "ฉบับร่าง" },
        { value: "pending", label: "รออนุมัติ" },
        { value: "processing", label: "กำลังดำเนินการ" },
        { value: "ordered", label: "ออกเอกสารแล้ว" },
        { value: "rejected", label: "ไม่อนุมัติ/ยกเลิก" },
    ] as const;
}

export function matchesRequesterFilter(status: PurchaseRequisitionStatus, filter: string) {
    switch (filter) {
        case "all":
            return true;
        case "draft":
            return status === "draft";
        case "pending":
            return status === "pending_need_approval";
        case "processing":
            return (
                status === "approved_for_sourcing" ||
                status === "sourcing" ||
                status === "comparing" ||
                status === "selection_pending" ||
                status === "selected"
            );
        case "ordered":
            return status === "converted_partial" || status === "converted_full";
        case "rejected":
            return status === "rejected" || status === "cancelled";
        default:
            return status === filter;
    }
}

export function getRequesterProgressSteps(status?: PurchaseRequisitionStatus): RequesterProgressStep[] {
    const statusMeta = getRequesterStatusMeta(status);
    const currentStage = statusMeta.stage;
    const isCompleted = Boolean(statusMeta.isCompleted);

    return [
        { key: "request", label: "สร้างคำขอ", state: getStepState(1, currentStage, isCompleted) },
        { key: "approval", label: "อนุมัติ", state: getStepState(2, currentStage, isCompleted) },
        { key: "procurement", label: "จัดซื้อ", state: getStepState(3, currentStage, isCompleted) },
        { key: "ordered", label: "ออกเอกสาร", state: getStepState(4, currentStage, isCompleted) },
    ];
}

export function getRequesterRequestTypeLabel(requestType?: PurchaseRequisitionRequestType) {
    switch (requestType) {
        case "material":
            return "ขอซื้อวัสดุ";
        case "service":
            return "ขอจ้าง/บริการ";
        default:
            return "-";
    }
}

export function getRequesterFulfillmentTypeLabel(fulfillmentType?: PurchaseRequisitionFulfillmentType) {
    switch (fulfillmentType) {
        case "po":
            return "PO";
        case "wc":
            return "WC";
        default:
            return "-";
    }
}

export function getRequesterUrgencyLabel(urgency?: PurchaseRequisitionUrgency) {
    switch (urgency) {
        case "low":
            return "ต่ำ";
        case "normal":
            return "ปกติ";
        case "high":
            return "สูง";
        case "urgent":
            return "เร่งด่วน";
        default:
            return "-";
    }
}

function getStepState(
    stepStage: 1 | 2 | 3 | 4,
    currentStage: 1 | 2 | 3 | 4,
    isCompleted: boolean
): RequesterProgressState {
    if (isCompleted || stepStage < currentStage) {
        return "done";
    }

    if (stepStage === currentStage) {
        return "current";
    }

    return "todo";
}
