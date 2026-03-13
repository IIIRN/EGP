"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    CheckCircle,
    XCircle,
    FileText,
    Loader2,
    Phone,
    MapPin,
    Calendar,
    CreditCard,
    User,
    Box,
    Edit,
    Send,
} from "lucide-react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PurchaseOrder } from "@/types/po";
import { Vendor } from "@/types/vendor";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { splitProcessingFeeItem } from "@/lib/documentItems";

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

const formatMoney = (value: number | undefined) =>
    `฿ ${Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

export default function LiffPODetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const { user, userProfile } = useAuth();
    const { currentProject } = useProject();

    const [po, setPo] = useState<PurchaseOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [vendorData, setVendorData] = useState<Vendor | null>(null);

    useEffect(() => {
        async function fetchPO() {
            if (!resolvedParams.id) return;
            try {
                const docRef = doc(db, "purchase_orders", resolvedParams.id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = { id: docSnap.id, ...docSnap.data() } as PurchaseOrder;
                    setPo(data);

                    if (data.vendorId) {
                        const vSnap = await getDoc(doc(db, "vendors", data.vendorId));
                        if (vSnap.exists()) setVendorData(vSnap.data() as Vendor);
                    }
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchPO();
    }, [resolvedParams.id]);

    const handleStatusUpdate = async (newStatus: "pending" | "approved" | "rejected") => {
        if (!po || !userProfile) return;
        setActionLoading(true);

        try {
            const poRef = doc(db, "purchase_orders", po.id);
            await updateDoc(poRef, {
                status: newStatus,
                updatedAt: serverTimestamp(),
            });

            if (newStatus === "approved" || newStatus === "pending") {
                try {
                    await fetch("/api/line/notify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "PO",
                            data: { ...po, status: newStatus },
                            vendorData: vendorData,
                            projectName: currentProject?.name,
                        }),
                    });
                } catch (e) {
                    console.error("Line notification failed:", e);
                }
            }

            setPo({ ...po, status: newStatus });
        } catch (error) {
            console.error("Error updating PO status:", error);
            alert("ไม่สามารถอัปเดตสถานะได้");
        } finally {
            setActionLoading(false);
        }
    };

    const handleMarkCompleted = async () => {
        if (!po || !userProfile) return;
        setActionLoading(true);
        try {
            const poRef = doc(db, "purchase_orders", po.id);
            await updateDoc(poRef, {
                isCompleted: true,
                updatedAt: serverTimestamp(),
            });
            setPo({ ...po, isCompleted: true });
        } catch (error) {
            console.error("Error marking PO completed:", error);
            alert("ไม่สามารถจัดเก็บเอกสารได้");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-slate-100 p-12">
                <Loader2 className="mb-4 h-10 w-10 animate-spin text-slate-700" />
                <p className="text-sm text-slate-600">กำลังโหลดข้อมูล...</p>
            </div>
        );
    }

    if (!po) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-slate-100 p-8 text-center">
                <FileText className="mb-4 h-16 w-16 text-slate-400" />
                <h3 className="mb-2 text-xl font-semibold text-slate-900">ไม่พบข้อมูล</h3>
                <p className="mb-6 text-slate-600">ไม่พบใบสั่งซื้อที่คุณกำลังค้นหา</p>
                <Link href="/liff" className="rounded-md border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-800">
                    กลับไปหน้าหลัก
                </Link>
            </div>
        );
    }

    const isPending = po.status === "pending";
    const canApprove = userProfile?.role === "admin" || userProfile?.role === "pm";
    const { items: displayItems, processingFee } = splitProcessingFeeItem(po.items || []);
    const itemsTotalBeforeFee = displayItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const POStatusBadge = ({ status, isCompleted }: { status: string, isCompleted?: boolean }) => {
        if (isCompleted) {
            return <span className="rounded-md border border-purple-300 bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">สำเร็จแล้ว (เก็บ)</span>;
        }
        switch (status) {
            case "approved":
                return <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">อนุมัติแล้ว</span>;
            case "rejected":
                return <span className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">ไม่อนุมัติ</span>;
            case "pending":
                return <span className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">รออนุมัติ</span>;
            default:
                return <span className="rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">ฉบับร่าง</span>;
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 pb-28">
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
                <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
                    <Link href="/liff" className="rounded-md border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50">
                        <ArrowLeft size={18} />
                    </Link>
                    <div className="min-w-0">
                        <h1 className="truncate text-base font-semibold text-slate-900">รายละเอียดใบสั่งซื้อ</h1>
                        <p className="truncate text-xs text-slate-600">{po.poNumber}</p>
                    </div>

                    {(po.status === "draft" || po.status === "rejected") && (
                        <Link
                            href={`/liff/po/${po.id}/edit`}
                            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
                        >
                            <Edit size={14} />
                            แก้ไข
                        </Link>
                    )}
                </div>
            </header>

            <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
                <section className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
                    <div>
                        <p className="text-xs text-slate-500">เลขที่เอกสาร</p>
                        <h2 className="text-lg font-semibold text-slate-900">{po.poNumber}</h2>
                    </div>
                    <POStatusBadge status={po.status} isCompleted={po.isCompleted} />
                </section>

                <section className="rounded-lg border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-4 py-2.5">
                        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">ข้อมูลเอกสาร</h3>
                    </div>
                    <div className="space-y-4 p-4">
                        <div className="flex items-start">
                            <Calendar size={16} className="mr-3 mt-0.5 shrink-0 text-slate-500" />
                            <div>
                                <p className="text-xs text-slate-500">วันที่ออกเอกสาร</p>
                                <p className="text-sm font-medium text-slate-800">{formatDateThai(po.createdAt)}</p>
                            </div>
                        </div>
                        <div className="flex items-start">
                            <User size={16} className="mr-3 mt-0.5 shrink-0 text-slate-500" />
                            <div>
                                <p className="text-xs text-slate-500">ร้านค้า / คู่ค้า</p>
                                <p className="text-sm font-medium text-slate-900">{po.vendorName || "-"}</p>
                            </div>
                        </div>
                        <div className="flex items-start">
                            <CreditCard size={16} className="mr-3 mt-0.5 shrink-0 text-slate-500" />
                            <div>
                                <p className="text-xs text-slate-500">เครดิตการชำระเงิน</p>
                                <p className="text-sm font-medium text-slate-800">{po.creditDays ?? 30} วัน</p>
                            </div>
                        </div>
                        {po.poType === "extra" && (
                            <div className="pt-1">
                                <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                                    ใบสั่งซื้อเพิ่มเติม (Extra PO)
                                </span>
                            </div>
                        )}
                    </div>
                </section>

                {vendorData && (
                    <section className="grid grid-cols-2 gap-2">
                        <a
                            href={vendorData.phone ? `tel:${vendorData.phone}` : "#"}
                            className={`inline-flex items-center justify-center rounded-md border px-3 py-2.5 text-sm font-medium ${vendorData.phone ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-400"}`}
                            onClick={(e) => !vendorData.phone && e.preventDefault()}
                        >
                            <Phone size={15} className="mr-2" /> โทรหลัก
                        </a>
                        {vendorData.secondaryPhone ? (
                            <a
                                href={`tel:${vendorData.secondaryPhone}`}
                                className="inline-flex items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700"
                            >
                                <Phone size={15} className="mr-2" /> โทรสำรอง
                            </a>
                        ) : null}
                        <a
                            href={vendorData.googleMapUrl || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center justify-center rounded-md border px-3 py-2.5 text-sm font-medium ${vendorData.googleMapUrl ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-100 text-slate-400"}`}
                            onClick={(e) => !vendorData.googleMapUrl && e.preventDefault()}
                        >
                            <MapPin size={15} className="mr-2" /> แผนที่ร้าน
                        </a>
                    </section>
                )}

                <section className="space-y-2">
                    <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">รายการสั่งของ ({displayItems.length})</h3>
                    {displayItems.map((item) => (
                        <div key={item.id} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600">
                                <Box size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="truncate text-sm font-medium text-slate-900">{item.description}</p>
                                    <p className="shrink-0 text-sm font-semibold text-slate-900">
                                        {item.isClosed ? "-" : formatMoney(item.amount)}
                                    </p>
                                </div>
                                <p className="mt-1 text-xs text-slate-600">
                                    {item.quantity} {item.unit} @ {item.isClosed ? "-" : formatMoney(item.unitPrice)}
                                </p>
                            </div>
                        </div>
                    ))}
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">สรุปยอดเงิน</p>
                        <p className="text-xs text-slate-500">THB</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">ราคารวม</span>
                            <span className="font-medium text-slate-900">{formatMoney(itemsTotalBeforeFee)}</span>
                        </div>
                        {po.poType !== 'extra' && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">ค่าดำเนินการ</span>
                                <span className="font-medium text-slate-900">{formatMoney(processingFee)}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">รวมเป็นเงิน</span>
                            <span className="font-medium text-slate-900">{formatMoney(po.subTotal)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">ภาษี {po.vatRate}%</span>
                            <span className="font-medium text-slate-900">{formatMoney(po.vatAmount)}</span>
                        </div>
                    </div>
                    <div className="mt-3 flex items-end justify-between border-t border-slate-200 pt-3">
                        <div>
                            <p className="text-xs text-slate-500">ยอดสุทธิรวมทั้งสิ้น</p>
                            <p className="text-xs text-slate-500">(รวมภาษีมูลค่าเพิ่มแล้ว)</p>
                        </div>
                        <p className="text-xl font-semibold text-slate-900">{formatMoney(po.totalAmount)}</p>
                    </div>
                </section>
            </main>

            {isPending && canApprove && (
                <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                    <div className="mx-auto flex w-full max-w-3xl gap-3">
                        <button
                            onClick={() => handleStatusUpdate("rejected")}
                            disabled={actionLoading}
                            className="flex-1 rounded-md border border-rose-300 bg-rose-50 px-3 py-3 text-sm font-medium text-rose-700 disabled:opacity-50"
                        >
                            <span className="inline-flex items-center justify-center">
                                <XCircle size={18} className="mr-2" /> ไม่อนุมัติ
                            </span>
                        </button>
                        <button
                            onClick={() => handleStatusUpdate("approved")}
                            disabled={actionLoading}
                            className="flex-[1.35] rounded-md border border-blue-700 bg-blue-700 px-3 py-3 text-sm font-medium text-white disabled:opacity-50"
                        >
                            <span className="inline-flex items-center justify-center">
                                {actionLoading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <CheckCircle size={18} className="mr-2" />}
                                อนุมัติสั่งซื้อ
                            </span>
                        </button>
                    </div>
                </div>
            )}

            {po.status === "approved" && !po.isCompleted && canApprove && (
                <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                    <div className="mx-auto flex w-full max-w-3xl gap-3">
                        <button
                            onClick={handleMarkCompleted}
                            disabled={actionLoading}
                            className="w-full rounded-md border border-purple-700 bg-purple-700 px-3 py-3 text-sm font-medium text-white disabled:opacity-50"
                        >
                            <span className="inline-flex items-center justify-center">
                                {actionLoading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <CheckCircle size={18} className="mr-2" />}
                                เสร็จสิ้น / จัดเก็บ
                            </span>
                        </button>
                    </div>
                </div>
            )}

            {(po.status === "draft" || po.status === "rejected") && user?.uid === po.createdBy && (
                <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                    <div className="mx-auto flex w-full max-w-3xl gap-3">
                        <button
                            onClick={() => handleStatusUpdate("pending")}
                            disabled={actionLoading}
                            className="w-full rounded-md border border-blue-600 bg-blue-600 px-3 py-3 text-sm font-medium text-white disabled:opacity-50"
                        >
                            <span className="inline-flex items-center justify-center">
                                {actionLoading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Send size={18} className="mr-2" />}
                                ส่งอนุมัติ
                            </span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
