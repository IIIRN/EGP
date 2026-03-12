"use client";

import { useAuth } from "@/context/AuthContext";
import { Suspense, useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";

type PageState = "loading" | "review" | "error" | "unauthorized";
type DocKind = "PO" | "VO" | "WC";

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

type DocRecord = {
    id: string;
    status?: string;
    projectId?: string;
    vendorId?: string;
    vendorName?: string;
    poNumber?: string;
    voNumber?: string;
    wcNumber?: string;
    title?: string;
    totalAmount?: number;
    createdAt?: unknown;
    items?: unknown;
};

type VendorRecord = {
    name?: string;
    phone?: string;
};

const DOC_KIND_COLLECTION: Record<DocKind, string> = {
    PO: "purchase_orders",
    VO: "variation_orders",
    WC: "work_contracts",
};

function resolveDocKind(rawType: string): DocKind | null {
    const normalized = rawType.trim().replace(/[\s-]+/g, "_").toUpperCase();
    if (normalized === "PO" || normalized === "PURCHASE_ORDER" || normalized === "PURCHASE_ORDERS") return "PO";
    if (normalized === "VO" || normalized === "VARIATION_ORDER" || normalized === "VARIATION_ORDERS") return "VO";
    if (normalized === "WC" || normalized === "WORK_CONTRACT" || normalized === "WORK_CONTRACTS") return "WC";
    return null;
}

function getDocKindLabel(docKind: DocKind | null): string {
    if (docKind === "PO") return "ใบสั่งซื้อ (PO)";
    if (docKind === "VO") return "งานเพิ่ม-ลด (VO)";
    if (docKind === "WC") return "ใบจ้างงาน (WC)";
    return "-";
}

const asText = (value: unknown, fallback = "-") => {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return fallback;
};

const asNumber = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const formatDateThai = (value: unknown) => {
    if (value && typeof value === "object") {
        const ts = value as FirestoreTimestampLike;
        if (typeof ts.toDate === "function") {
            return ts.toDate().toLocaleDateString("th-TH", {
                year: "numeric",
                month: "long",
                day: "numeric",
            });
        }
        if (typeof ts.seconds === "number") {
            return new Date(ts.seconds * 1000).toLocaleDateString("th-TH", {
                year: "numeric",
                month: "long",
                day: "numeric",
            });
        }
    }
    return "-";
};

const formatMoney = (value: unknown) =>
    `฿ ${asNumber(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

function ViewAction() {
    const { userProfile, loading: authLoading } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [state, setState] = useState<PageState>("loading");
    const [message, setMessage] = useState("กำลังเชื่อมต่อระบบ...");
    const [docKind, setDocKind] = useState<DocKind | null>(null);
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
                    const res = await fetch("/api/auth/line-login", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ lineUserId: profile.userId }),
                    });
                    if (res.ok) {
                        const data = (await res.json()) as { customToken?: string; success?: boolean };
                        if (data.customToken && data.success) {
                            const { signInWithCustomToken } = await import("firebase/auth");
                            const { auth } = await import("@/lib/firebase");
                            await signInWithCustomToken(auth, data.customToken);
                        }
                    }
                }
            } catch (error) {
                console.error("LIFF view init err:", error);
            }
        };

        initLiffClient();
    }, []);

    useEffect(() => {
        if (authLoading) return;

        const loadDocument = async () => {
            if (!userProfile) {
                setState("unauthorized");
                setMessage("กรุณาผูกบัญชี LINE ก่อนทำรายการ");
                router.push("/liff/binding");
                return;
            }

            const type = searchParams.get("type") || "";
            const id = searchParams.get("id") || "";
            if (!type || !id) {
                setState("error");
                setMessage("ข้อมูลไม่ครบถ้วน (ไม่พบ type หรือ id)");
                return;
            }

            const kind = resolveDocKind(type);
            if (!kind) {
                setState("error");
                setMessage("ประเภทเอกสารไม่ถูกต้อง");
                return;
            }

            try {
                setState("loading");
                setMessage("กำลังโหลดรายละเอียดเอกสาร...");
                setDocKind(kind);

                const collectionName = DOC_KIND_COLLECTION[kind];
                const docSnap = await getDoc(doc(db, collectionName, id));
                if (!docSnap.exists()) {
                    setState("error");
                    setMessage("ไม่พบเอกสารนี้ในระบบ");
                    return;
                }

                const data = { id: docSnap.id, ...docSnap.data() } as DocRecord;
                setRecord(data);

                if (typeof data.projectId === "string" && data.projectId) {
                    const pSnap = await getDoc(doc(db, "projects", data.projectId));
                    setProjectName(pSnap.exists() ? asText(pSnap.data().name, "-") : "-");
                } else {
                    setProjectName("-");
                }

                if ((kind === "PO" || kind === "WC") && typeof data.vendorId === "string" && data.vendorId) {
                    const vSnap = await getDoc(doc(db, "vendors", data.vendorId));
                    if (vSnap.exists()) {
                        setVendorData(vSnap.data() as VendorRecord);
                    } else {
                        setVendorData(null);
                    }
                } else {
                    setVendorData(null);
                }

                setState("review");
                setMessage("รายละเอียดเอกสาร");
            } catch (error) {
                console.error("Load view document error:", error);
                setState("error");
                setMessage("เกิดข้อผิดพลาดในการโหลดข้อมูล");
            }
        };

        loadDocument();
    }, [authLoading, userProfile, router, searchParams]);

    const statusBadge = useMemo(() => {
        const status = record?.status;
        if (status === "approved") return "อนุมัติแล้ว";
        if (status === "rejected") return "ไม่อนุมัติ";
        if (status === "pending") return "รออนุมัติ";
        return "ฉบับร่าง";
    }, [record?.status]);

    const items = useMemo(() => {
        if (!record || !Array.isArray(record.items)) return [] as DocItem[];
        return record.items.filter((item): item is DocItem => typeof item === "object" && item !== null);
    }, [record]);

    return (
        <div className="min-h-screen bg-slate-50 p-4">
            <div className="mx-auto w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 md:p-6">
                {state === "loading" && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Loader2 className="mb-3 h-10 w-10 animate-spin text-blue-600" />
                        <p className="text-sm text-slate-600">{message}</p>
                    </div>
                )}

                {state === "review" && (
                    <div className="space-y-4">
                        <div>
                            <h1 className="text-lg font-bold text-slate-900">ดูข้อมูลเอกสาร</h1>
                            <p className="mt-1 text-sm text-slate-600">{message}</p>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                                <p className="text-slate-600">ประเภทเอกสาร: <span className="font-medium text-slate-900">{getDocKindLabel(docKind)}</span></p>
                                <p className="text-slate-600">สถานะ: <span className="font-medium text-slate-900">{statusBadge}</span></p>
                                <p className="text-slate-600">เลขที่เอกสาร: <span className="font-medium text-slate-900">{asText(record?.poNumber) !== "-" ? asText(record?.poNumber) : asText(record?.voNumber) !== "-" ? asText(record?.voNumber) : asText(record?.wcNumber)}</span></p>
                                <p className="text-slate-600">โครงการ: <span className="font-medium text-slate-900">{projectName}</span></p>
                                <p className="text-slate-600">วันที่สร้าง: <span className="font-medium text-slate-900">{formatDateThai(record?.createdAt)}</span></p>
                                <p className="text-slate-600">ยอดรวม: <span className="font-medium text-slate-900">{formatMoney(record?.totalAmount)}</span></p>
                                {docKind === "PO" && <p className="text-slate-600 md:col-span-2">คู่ค้า: <span className="font-medium text-slate-900">{asText(record?.vendorName)}</span></p>}
                                {docKind === "VO" && <p className="text-slate-600 md:col-span-2">หัวข้อ: <span className="font-medium text-slate-900">{asText(record?.title)}</span></p>}
                                {docKind === "WC" && (
                                    <>
                                        <p className="text-slate-600 md:col-span-2">ผู้รับจ้าง: <span className="font-medium text-slate-900">{asText(record?.vendorName, asText(vendorData?.name))}</span></p>
                                        <p className="text-slate-600 md:col-span-2">หัวข้อ: <span className="font-medium text-slate-900">{asText(record?.title)}</span></p>
                                    </>
                                )}
                            </div>
                        </div>

                        {items.length > 0 && (
                            <div className="rounded-lg border border-slate-200">
                                <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700">รายการ ({items.length})</div>
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

                        <button
                            type="button"
                            onClick={() => router.push("/liff")}
                            className="w-full rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800"
                        >
                            กลับหน้าหลัก
                        </button>
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

export default function LiffViewPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                </div>
            }
        >
            <ViewAction />
        </Suspense>
    );
}
