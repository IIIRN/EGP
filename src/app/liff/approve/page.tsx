"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Timestamp, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
    DOC_KIND_COLLECTION,
    getDocumentKindLabel,
    getDocumentNumber,
    isPendingDocumentStatus,
    resolveDocumentKind,
    type SupportedDocumentKind,
} from "@/lib/documentKinds";
import {
    finalizePurchaseRequisitionApprovalTrail,
    getPurchaseRequisitionDecisionStatus,
    getPurchaseRequisitionStatusMeta,
} from "@/lib/purchaseRequisition";
import {
    finalizePriceComparisonApprovalTrail,
    getPriceComparisonDecisionStatus,
    getPriceComparisonStatusMeta,
    getRecommendationTypeLabel,
} from "@/lib/priceComparison";
import type { PurchaseRequisitionApprovalAction } from "@/types/pr";
import type { PriceComparisonApprovalAction } from "@/types/priceComparison";

type PageState = "loading" | "review" | "success" | "error" | "unauthorized";
type Decision = "approved" | "rejected";

type FirestoreTimestampLike = {
    toDate?: () => Date;
    seconds?: number;
};

type DocItem = {
    id?: string;
    description?: string;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
    amount?: number;
};

type QuoteRecord = {
    id?: string;
    supplierName?: string;
    quoteRef?: string;
    totalAmount?: number;
    creditDays?: number;
    deliveryDays?: number;
    overallRank?: number;
};

type DocRecord = {
    id: string;
    status?: string;
    projectId?: string;
    vendorId?: string;
    vendorName?: string;
    poNumber?: string;
    voNumber?: string;
    wcNumber?: string;
    prNumber?: string;
    comparisonNumber?: string;
    title?: string;
    reason?: string;
    totalAmount?: number;
    recommendedTotalAmount?: number;
    createdAt?: unknown;
    items?: DocItem[];
    quotes?: QuoteRecord[];
    requestedByName?: string;
    requestedByUid?: string;
    prId?: string;
    fulfillmentType?: string;
    requestType?: string;
    recommendationType?: string;
    recommendationReason?: string;
    recommendedSupplierType?: string;
    recommendedSupplierId?: string;
    recommendedSupplierName?: string;
    approvalTrail?: unknown;
};

type VendorRecord = {
    name?: string;
    fullName?: string;
};

type InfoField = {
    label: string;
    value: string;
    fullWidth?: boolean;
};

function asText(value: unknown, fallback = "-") {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return fallback;
}

function asNumber(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function formatDateThai(value: unknown) {
    if (value && typeof value === "object") {
        const timestamp = value as FirestoreTimestampLike;
        if (typeof timestamp.toDate === "function") {
            return timestamp.toDate().toLocaleDateString("th-TH", {
                year: "numeric",
                month: "long",
                day: "numeric",
            });
        }
        if (typeof timestamp.seconds === "number") {
            return new Date(timestamp.seconds * 1000).toLocaleDateString("th-TH", {
                year: "numeric",
                month: "long",
                day: "numeric",
            });
        }
    }
    return "-";
}

function formatMoney(value: unknown) {
    return `฿ ${asNumber(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function getRequestTypeLabel(type?: string) {
    return type === "service" ? "ขอจ้าง / ขอรับบริการ" : "ขอซื้อวัสดุ";
}

function getFulfillmentTypeLabel(type?: string) {
    return type === "wc" ? "ออก Work Contract" : "ออก Purchase Order";
}

function getDocumentStatusLabel(docKind: SupportedDocumentKind | null, status?: string) {
    if (docKind === "PR") return getPurchaseRequisitionStatusMeta(status).label;
    if (docKind === "PC") return getPriceComparisonStatusMeta(status).label;
    if (status === "approved") return "อนุมัติแล้ว";
    if (status === "rejected") return "ไม่อนุมัติ";
    if (status === "pending") return "รออนุมัติ";
    return "ฉบับร่าง";
}

function getTotalValue(docKind: SupportedDocumentKind | null, record: DocRecord | null) {
    if (!record) return 0;
    return docKind === "PC" ? asNumber(record.recommendedTotalAmount) : asNumber(record.totalAmount);
}

function buildInfoFields(params: {
    docKind: SupportedDocumentKind | null;
    record: DocRecord | null;
    projectName: string;
    vendorData: VendorRecord | null;
}) {
    const { docKind, record, projectName, vendorData } = params;
    if (!record) return [] as InfoField[];

    const baseFields: InfoField[] = [
        { label: "ประเภทเอกสาร", value: getDocumentKindLabel(docKind) },
        { label: "สถานะ", value: getDocumentStatusLabel(docKind, record.status) },
        { label: "เลขที่เอกสาร", value: getDocumentNumber(record) },
        { label: "โครงการ", value: projectName || "-" },
        { label: "วันที่สร้าง", value: formatDateThai(record.createdAt) },
        { label: docKind === "PC" ? "ยอดที่เลือก" : "ยอดรวม", value: formatMoney(getTotalValue(docKind, record)) },
    ];

    if (docKind === "PR") {
        return [
            ...baseFields,
            { label: "หัวข้อ", value: asText(record.title), fullWidth: true },
            { label: "ผู้ขอ", value: asText(record.requestedByName) },
            { label: "ประเภทคำขอ", value: getRequestTypeLabel(record.requestType) },
            { label: "เอกสารปลายทาง", value: getFulfillmentTypeLabel(record.fulfillmentType) },
            { label: "เหตุผล", value: asText(record.reason), fullWidth: true },
        ];
    }

    if (docKind === "PC") {
        return [
            ...baseFields,
            { label: "PR ต้นทาง", value: asText(record.prNumber) },
            { label: "ผู้ขอ", value: asText(record.requestedByName) },
            { label: "หัวข้อ", value: asText(record.title), fullWidth: true },
            { label: "ผู้เสนอที่เลือก", value: asText(record.recommendedSupplierName), fullWidth: true },
            { label: "เกณฑ์คัดเลือก", value: getRecommendationTypeLabel(record.recommendationType as never) },
            { label: "รูปแบบปลายทาง", value: getFulfillmentTypeLabel(record.fulfillmentType) },
            { label: "เหตุผลประกอบการเลือก", value: asText(record.recommendationReason), fullWidth: true },
        ];
    }

    if (docKind === "PO") {
        return [
            ...baseFields,
            { label: "คู่ค้า", value: asText(record.vendorName || vendorData?.name), fullWidth: true },
        ];
    }

    if (docKind === "WC") {
        return [
            ...baseFields,
            { label: "ผู้รับจ้าง", value: asText(record.vendorName || vendorData?.fullName || vendorData?.name), fullWidth: true },
            { label: "หัวข้อ", value: asText(record.title), fullWidth: true },
        ];
    }

    if (docKind === "VO") {
        return [
            ...baseFields,
            { label: "หัวข้อ", value: asText(record.title), fullWidth: true },
            { label: "เหตุผล", value: asText(record.reason), fullWidth: true },
        ];
    }

    return baseFields;
}

function ApproveAction() {
    const { userProfile, loading: authLoading } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [state, setState] = useState<PageState>("loading");
    const [message, setMessage] = useState("กำลังเชื่อมต่อระบบ...");
    const [actionLoading, setActionLoading] = useState(false);
    const [docKind, setDocKind] = useState<SupportedDocumentKind | null>(null);
    const [collectionName, setCollectionName] = useState("");
    const [docId, setDocId] = useState("");
    const [record, setRecord] = useState<DocRecord | null>(null);
    const [projectName, setProjectName] = useState("-");
    const [vendorData, setVendorData] = useState<VendorRecord | null>(null);

    useEffect(() => {
        const initLiffClient = async () => {
            if (typeof window === "undefined") return;
            try {
                const liffId = process.env.NEXT_PUBLIC_LIFF_ID || "1234567890-AbcdEfgh";
                const liff = (await import("@line/liff")).default;
                await liff.init({ liffId });

                if (liff.isLoggedIn()) {
                    const profile = await liff.getProfile();
                    const response = await fetch("/api/auth/line-login", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ lineUserId: profile.userId }),
                    });

                    if (response.ok) {
                        const data = (await response.json()) as { customToken?: string; success?: boolean };
                        if (data.customToken && data.success) {
                            const { signInWithCustomToken } = await import("firebase/auth");
                            const { auth } = await import("@/lib/firebase");
                            await signInWithCustomToken(auth, data.customToken);
                        }
                    }
                }
            } catch (error) {
                console.error("LIFF approval init error:", error);
            }
        };

        void initLiffClient();
    }, []);

    useEffect(() => {
        if (authLoading) return;

        const loadApprovalDoc = async () => {
            if (!userProfile) {
                setState("unauthorized");
                setMessage("กรุณาผูกบัญชี LINE ก่อนใช้งาน");
                router.push("/liff/binding");
                return;
            }

            if (userProfile.role !== "admin" && userProfile.role !== "pm") {
                setState("unauthorized");
                setMessage("คุณไม่มีสิทธิ์อนุมัติเอกสารนี้");
                return;
            }

            const type = searchParams.get("type") || "";
            const id = searchParams.get("id") || "";
            if (!type || !id) {
                setState("error");
                setMessage("ข้อมูลไม่ครบถ้วน");
                return;
            }

            const kind = resolveDocumentKind(type);
            if (!kind) {
                setState("error");
                setMessage("ประเภทเอกสารไม่ถูกต้อง");
                return;
            }

            try {
                setState("loading");
                setMessage("กำลังโหลดรายละเอียดเอกสาร...");
                setDocKind(kind);
                setCollectionName(DOC_KIND_COLLECTION[kind]);
                setDocId(id);

                const docSnap = await getDoc(doc(db, DOC_KIND_COLLECTION[kind], id));
                if (!docSnap.exists()) {
                    setState("error");
                    setMessage("ไม่พบเอกสารนี้ในระบบ");
                    return;
                }

                const nextRecord = { id: docSnap.id, ...docSnap.data() } as DocRecord;
                setRecord(nextRecord);

                if (typeof nextRecord.projectId === "string" && nextRecord.projectId) {
                    const projectSnap = await getDoc(doc(db, "projects", nextRecord.projectId));
                    setProjectName(projectSnap.exists() ? asText(projectSnap.data().name) : "-");
                } else {
                    setProjectName("-");
                }

                if ((kind === "PO" || kind === "WC") && typeof nextRecord.vendorId === "string" && nextRecord.vendorId) {
                    const vendorCollection = kind === "WC" ? "contractors" : "vendors";
                    const vendorSnap = await getDoc(doc(db, vendorCollection, nextRecord.vendorId));
                    setVendorData(vendorSnap.exists() ? (vendorSnap.data() as VendorRecord) : null);
                } else {
                    setVendorData(null);
                }

                setState("review");
                setMessage("กรุณาตรวจสอบข้อมูลก่อนตัดสินใจ");
            } catch (error) {
                console.error("Load approval document error:", error);
                setState("error");
                setMessage("เกิดข้อผิดพลาดในการโหลดข้อมูล");
            }
        };

        void loadApprovalDoc();
    }, [authLoading, userProfile, searchParams, router]);

    const isPending = docKind ? isPendingDocumentStatus(docKind, record?.status) : false;
    const infoFields = useMemo(
        () => buildInfoFields({ docKind, record, projectName, vendorData }),
        [docKind, record, projectName, vendorData]
    );
    const items = useMemo(() => (Array.isArray(record?.items) ? record.items : []), [record?.items]);
    const quotes = useMemo(() => (Array.isArray(record?.quotes) ? record.quotes : []), [record?.quotes]);
    const viewHref = docKind && docId ? `/liff/view?type=${docKind}&id=${docId}` : "/liff";

    const handleDecision = async (decision: Decision) => {
        if (!record || !collectionName || !docId || !docKind || !userProfile) return;

        const confirmText = decision === "approved"
            ? "ยืนยันอนุมัติเอกสารนี้?"
            : "ยืนยันไม่อนุมัติเอกสารนี้?";
        if (!window.confirm(confirmText)) return;

        setActionLoading(true);
        try {
            const targetRef = doc(db, collectionName, docId);

            if (docKind === "PC") {
                const nextStatus = getPriceComparisonDecisionStatus(decision);
                const nextTrail = finalizePriceComparisonApprovalTrail({
                    currentTrail: Array.isArray(record.approvalTrail)
                        ? (record.approvalTrail as PriceComparisonApprovalAction[])
                        : undefined,
                    decision,
                    approverUid: userProfile.uid,
                    approverName: userProfile.displayName || userProfile.email || userProfile.uid,
                    role: userProfile.role,
                    actionAt: Timestamp.now(),
                });

                await updateDoc(targetRef, {
                    status: nextStatus,
                    approvalTrail: nextTrail,
                    updatedAt: serverTimestamp(),
                });

                if (record.prId) {
                    await updateDoc(doc(db, "purchase_requisitions", record.prId), {
                        currentComparisonId: record.id,
                        selectedComparisonId: decision === "approved" ? record.id : "",
                        selectedSupplierType: decision === "approved" ? (record.recommendedSupplierType || "") : "",
                        selectedSupplierId: decision === "approved" ? (record.recommendedSupplierId || "") : "",
                        status: decision === "approved" ? "selected" : "comparing",
                        updatedAt: serverTimestamp(),
                    });
                }

                const nextRecord = { ...record, status: nextStatus, approvalTrail: nextTrail };
                if (decision === "approved") {
                    try {
                        await fetch("/api/line/notify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                type: docKind,
                                data: nextRecord,
                                projectName,
                            }),
                        });
                    } catch (error) {
                        console.error("Notify approval result failed:", error);
                    }
                }
                setRecord(nextRecord);
            } else if (docKind === "PR") {
                const nextStatus = getPurchaseRequisitionDecisionStatus(decision);
                const nextTrail = finalizePurchaseRequisitionApprovalTrail({
                    currentTrail: Array.isArray(record.approvalTrail)
                        ? (record.approvalTrail as PurchaseRequisitionApprovalAction[])
                        : undefined,
                    decision,
                    approverUid: userProfile.uid,
                    approverName: userProfile.displayName || userProfile.email || userProfile.uid,
                    role: userProfile.role,
                    actionAt: Timestamp.now(),
                });

                await updateDoc(targetRef, {
                    status: nextStatus,
                    approvalTrail: nextTrail,
                    updatedAt: serverTimestamp(),
                });

                const nextRecord = { ...record, status: nextStatus, approvalTrail: nextTrail };
                if (decision === "approved") {
                    try {
                        await fetch("/api/line/notify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                type: docKind,
                                data: nextRecord,
                                projectName,
                            }),
                        });
                    } catch (error) {
                        console.error("Notify approval result failed:", error);
                    }
                }
                setRecord(nextRecord);
            } else {
                await updateDoc(targetRef, {
                    status: decision,
                    updatedAt: serverTimestamp(),
                });

                if (decision === "approved") {
                    try {
                        await fetch("/api/line/notify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                type: docKind,
                                data: { ...record, status: "approved" },
                                vendorData,
                                projectName,
                            }),
                        });
                    } catch (error) {
                        console.error("Notify approval result failed:", error);
                    }
                }

                setRecord((previous) => (previous ? { ...previous, status: decision } : previous));
            }

            setState("success");
            setMessage(decision === "approved" ? "อนุมัติเอกสารเรียบร้อยแล้ว" : "บันทึกการไม่อนุมัติเรียบร้อยแล้ว");
        } catch (error) {
            console.error("Approval decision error:", error);
            setState("error");
            setMessage("เกิดข้อผิดพลาดระหว่างบันทึกผลการอนุมัติ");
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4">
            <div className="mx-auto w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 md:p-6">
                {state === "loading" && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Loader2 className="mb-3 h-10 w-10 animate-spin text-blue-600" />
                        <p className="text-sm text-slate-600">{message}</p>
                    </div>
                )}

                {state === "review" && record && (
                    <div className="space-y-4">
                        <div>
                            <h1 className="text-lg font-bold text-slate-900">ตรวจสอบเอกสารก่อนอนุมัติ</h1>
                            <p className="mt-1 text-sm text-slate-600">{message}</p>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                                {infoFields.map((field) => (
                                    <p key={`${field.label}-${field.value}`} className={`text-slate-600 ${field.fullWidth ? "md:col-span-2" : ""}`}>
                                        {field.label}: <span className="font-medium text-slate-900">{field.value}</span>
                                    </p>
                                ))}
                            </div>
                        </div>

                        {items.length > 0 && (
                            <div className="rounded-lg border border-slate-200">
                                <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700">
                                    รายการ ({items.length})
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {items.map((item, index) => (
                                        <div key={item.id || `${index}`} className="flex items-start justify-between gap-3 px-4 py-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-slate-900">{asText(item.description)}</p>
                                                <p className="mt-0.5 text-xs text-slate-500">
                                                    {asNumber(item.quantity)} {asText(item.unit)} @ {formatMoney(item.unitPrice)}
                                                </p>
                                            </div>
                                            <p className="shrink-0 text-sm font-semibold text-slate-900">{formatMoney(item.amount)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {docKind === "PC" && quotes.length > 0 && (
                            <div className="rounded-lg border border-slate-200">
                                <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700">
                                    ผู้เสนอราคา ({quotes.length})
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {quotes.map((quote, index) => (
                                        <div key={quote.id || `${index}`} className="space-y-1 px-4 py-3 text-sm">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="font-medium text-slate-900">{asText(quote.supplierName)}</p>
                                                    <p className="text-xs text-slate-500">
                                                        ใบเสนอราคา {asText(quote.quoteRef)} • เครดิต {asNumber(quote.creditDays)} วัน • ส่งมอบ {asNumber(quote.deliveryDays)} วัน
                                                    </p>
                                                </div>
                                                <p className="shrink-0 font-semibold text-slate-900">{formatMoney(quote.totalAmount)}</p>
                                            </div>
                                            <p className="text-xs text-slate-500">อันดับ: {asText(quote.overallRank)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {isPending ? (
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => void handleDecision("rejected")}
                                    className="inline-flex items-center justify-center rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 disabled:opacity-50"
                                >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    ไม่อนุมัติ
                                </button>
                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => void handleDecision("approved")}
                                    className="inline-flex items-center justify-center rounded-lg border border-blue-700 bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                                >
                                    {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                    อนุมัติ
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                    เอกสารนี้ถูกดำเนินการแล้ว (สถานะ: {getDocumentStatusLabel(docKind, record.status)})
                                </div>
                                <button
                                    type="button"
                                    onClick={() => router.push(viewHref)}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800"
                                >
                                    ดูข้อมูลเอกสาร
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {state === "success" && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <CheckCircle className="mb-3 h-14 w-14 text-emerald-600" />
                        <h2 className="text-lg font-bold text-slate-900">สำเร็จ</h2>
                        <p className="mt-1 text-sm text-slate-600">{message}</p>
                        <div className="mt-5 grid w-full gap-3">
                            <button
                                type="button"
                                onClick={() => router.push(viewHref)}
                                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800"
                            >
                                ดูข้อมูลเอกสาร
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push("/liff")}
                                className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white"
                            >
                                กลับหน้าหลัก
                            </button>
                        </div>
                    </div>
                )}

                {(state === "error" || state === "unauthorized") && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <XCircle className="mb-3 h-14 w-14 text-rose-600" />
                        <h2 className="text-lg font-bold text-slate-900">ไม่สามารถดำเนินการได้</h2>
                        <p className="mt-1 text-sm text-slate-600">{message}</p>
                        <button
                            type="button"
                            onClick={() => router.push("/liff")}
                            className="mt-5 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800"
                        >
                            กลับหน้าหลัก
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function LiffApprovePage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                </div>
            }
        >
            <ApproveAction />
        </Suspense>
    );
}
