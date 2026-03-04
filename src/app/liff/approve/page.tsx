"use client";

import { useAuth } from "@/context/AuthContext";
import { Suspense, useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Loader2, XCircle, FileText } from "lucide-react";

type PageState = "loading" | "review" | "success" | "error" | "unauthorized";
type DocKind = "PO" | "VO";
type Decision = "approved" | "rejected";

type FirestoreTimestampLike = {
    toDate?: () => Date;
    seconds?: number;
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
    `฿ ${Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

function ApproveAction() {
    const { userProfile, loading: authLoading } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [state, setState] = useState<PageState>("loading");
    const [message, setMessage] = useState("กำลังเชื่อมต่อระบบ...");
    const [actionLoading, setActionLoading] = useState(false);

    const [docKind, setDocKind] = useState<DocKind | null>(null);
    const [collectionName, setCollectionName] = useState<string>("");
    const [docId, setDocId] = useState<string>("");
    const [record, setRecord] = useState<any>(null);
    const [projectName, setProjectName] = useState<string>("-");
    const [vendorData, setVendorData] = useState<any>(null);

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
                        const data = await res.json();
                        if (data.customToken && data.success) {
                            const { signInWithCustomToken } = await import("firebase/auth");
                            const { auth } = await import("@/lib/firebase");
                            await signInWithCustomToken(auth, data.customToken);
                        }
                    }
                }
            } catch (err) {
                console.error("LIFF approval init err:", err);
            }
        };

        initLiffClient();
    }, []);

    useEffect(() => {
        if (authLoading) return;

        const loadApprovalDoc = async () => {
            if (!userProfile) {
                setState("unauthorized");
                setMessage("กรุณาผูกบัญชี LINE ก่อนทำรายการ");
                router.push("/liff/binding");
                return;
            }

            if (userProfile.role !== "admin" && userProfile.role !== "pm") {
                setState("unauthorized");
                setMessage("คุณไม่มีสิทธิ์อนุมัติเอกสารนี้");
                return;
            }

            const type = (searchParams.get("type") || "").toUpperCase();
            const id = searchParams.get("id") || "";

            if (!type || !id) {
                setState("error");
                setMessage("ข้อมูลไม่ครบถ้วน (ไม่พบ type หรือ id)");
                return;
            }

            const kind = type === "PO" ? "PO" : type === "VO" ? "VO" : null;
            if (!kind) {
                setState("error");
                setMessage("ประเภทเอกสารไม่ถูกต้อง");
                return;
            }

            const collection = kind === "PO" ? "purchase_orders" : "variation_orders";
            setDocKind(kind);
            setCollectionName(collection);
            setDocId(id);

            try {
                setState("loading");
                setMessage("กำลังโหลดรายละเอียดเอกสาร...");

                const docRef = doc(db, collection, id);
                const docSnap = await getDoc(docRef);
                if (!docSnap.exists()) {
                    setState("error");
                    setMessage("ไม่พบเอกสารนี้ในระบบ");
                    return;
                }

                const data = { id: docSnap.id, ...docSnap.data() } as any;
                setRecord(data);

                if (data.projectId) {
                    const pSnap = await getDoc(doc(db, "projects", data.projectId));
                    if (pSnap.exists()) {
                        setProjectName(pSnap.data().name || "-");
                    } else {
                        setProjectName("-");
                    }
                } else {
                    setProjectName("-");
                }

                if (kind === "PO" && data.vendorId) {
                    const vSnap = await getDoc(doc(db, "vendors", data.vendorId));
                    setVendorData(vSnap.exists() ? vSnap.data() : null);
                } else {
                    setVendorData(null);
                }

                setState("review");
                setMessage("กรุณาตรวจสอบรายการก่อนตัดสินใจ");
            } catch (error: any) {
                console.error("Load approval document error:", error);
                setState("error");
                setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
            }
        };

        loadApprovalDoc();
    }, [authLoading, userProfile, searchParams, router]);

    const statusBadge = useMemo(() => {
        const status = record?.status;
        if (status === "approved") return "อนุมัติแล้ว";
        if (status === "rejected") return "ไม่อนุมัติ";
        if (status === "pending") return "รออนุมัติ";
        return "ฉบับร่าง";
    }, [record?.status]);

    const isPending = record?.status === "pending";

    const handleDecision = async (decision: Decision) => {
        if (!record || !collectionName || !docId || !docKind) return;

        const confirmText = decision === "approved"
            ? "ยืนยันอนุมัติเอกสารนี้?"
            : "ยืนยันไม่อนุมัติเอกสารนี้?";
        if (!window.confirm(confirmText)) return;

        setActionLoading(true);
        try {
            const targetRef = doc(db, collectionName, docId);
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
                            vendorData: vendorData,
                            projectName,
                        }),
                    });
                } catch (e) {
                    console.error("Notify approval result failed:", e);
                }
            }

            setRecord((prev: any) => ({ ...prev, status: decision }));
            setState("success");
            setMessage(decision === "approved" ? "อนุมัติเอกสารเรียบร้อยแล้ว" : "บันทึกการไม่อนุมัติเรียบร้อยแล้ว");
        } catch (error: any) {
            console.error("Approval decision error:", error);
            setState("error");
            setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
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

                {state === "review" && (
                    <div className="space-y-4">
                        <div>
                            <h1 className="text-lg font-bold text-slate-900">ตรวจสอบเอกสารก่อนอนุมัติ</h1>
                            <p className="mt-1 text-sm text-slate-600">{message}</p>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                                <p className="text-slate-600">ประเภทเอกสาร: <span className="font-medium text-slate-900">{docKind === "PO" ? "ใบสั่งซื้อ (PO)" : "งานเพิ่ม-ลด (VO)"}</span></p>
                                <p className="text-slate-600">สถานะ: <span className="font-medium text-slate-900">{statusBadge}</span></p>
                                <p className="text-slate-600">เลขที่เอกสาร: <span className="font-medium text-slate-900">{record?.poNumber || record?.voNumber || "-"}</span></p>
                                <p className="text-slate-600">โครงการ: <span className="font-medium text-slate-900">{projectName}</span></p>
                                <p className="text-slate-600">วันที่สร้าง: <span className="font-medium text-slate-900">{formatDateThai(record?.createdAt)}</span></p>
                                <p className="text-slate-600">ยอดรวม: <span className="font-medium text-slate-900">{formatMoney(record?.totalAmount)}</span></p>
                                {docKind === "PO" && (
                                    <p className="text-slate-600 md:col-span-2">คู่ค้า: <span className="font-medium text-slate-900">{record?.vendorName || "-"}</span></p>
                                )}
                                {docKind === "VO" && (
                                    <p className="text-slate-600 md:col-span-2">หัวข้อ: <span className="font-medium text-slate-900">{record?.title || "-"}</span></p>
                                )}
                            </div>
                        </div>

                        {Array.isArray(record?.items) && record.items.length > 0 && (
                            <div className="rounded-lg border border-slate-200">
                                <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700">
                                    รายการ ({record.items.length})
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {record.items.map((item: any, index: number) => (
                                        <div key={item.id || `${index}`} className="flex items-start justify-between gap-3 px-4 py-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-slate-900">{item.description || "-"}</p>
                                                <p className="mt-0.5 text-xs text-slate-500">
                                                    {Number(item.quantity || 0)} {item.unit || "-"} @ {formatMoney(item.unitPrice)}
                                                </p>
                                            </div>
                                            <p className="shrink-0 text-sm font-semibold text-slate-900">{formatMoney(item.amount)}</p>
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
                                    onClick={() => handleDecision("rejected")}
                                    className="inline-flex items-center justify-center rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 disabled:opacity-50"
                                >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    ไม่อนุมัติ
                                </button>
                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => handleDecision("approved")}
                                    className="inline-flex items-center justify-center rounded-lg border border-blue-700 bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                                >
                                    {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                    อนุมัติ
                                </button>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                เอกสารนี้ถูกดำเนินการแล้ว (สถานะ: {statusBadge})
                            </div>
                        )}
                    </div>
                )}

                {state === "success" && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <CheckCircle className="mb-3 h-14 w-14 text-emerald-600" />
                        <h2 className="text-lg font-bold text-slate-900">สำเร็จ</h2>
                        <p className="mt-1 text-sm text-slate-600">{message}</p>
                        <button
                            type="button"
                            onClick={() => router.push("/liff")}
                            className="mt-5 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white"
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

export default function LiffApprovePage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                </div>
            }
        >
            <ApproveAction />
        </Suspense>
    );
}
