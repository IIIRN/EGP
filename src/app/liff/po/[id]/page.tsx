"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, FileText, Loader2, Phone, MapPin, Calendar, CreditCard, User, Box, Edit } from "lucide-react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PurchaseOrder } from "@/types/po";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";

export default function LiffPODetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { userProfile } = useAuth();
    const { currentProject } = useProject();

    const [po, setPo] = useState<PurchaseOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [vendorData, setVendorData] = useState<any>(null);

    useEffect(() => {
        async function fetchPO() {
            if (!resolvedParams.id) return;
            try {
                const docRef = doc(db, "purchase_orders", resolvedParams.id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = { id: docSnap.id, ...docSnap.data() } as PurchaseOrder;
                    setPo(data);

                    // Fetch vendor info
                    if (data.vendorId) {
                        const vSnap = await getDoc(doc(db, "vendors", data.vendorId));
                        if (vSnap.exists()) setVendorData(vSnap.data());
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

    const handleStatusUpdate = async (newStatus: "approved" | "rejected") => {
        if (!po || !userProfile) return;
        setActionLoading(true);

        try {
            const poRef = doc(db, "purchase_orders", po.id);
            await updateDoc(poRef, {
                status: newStatus,
                updatedAt: serverTimestamp(),
            });

            if (newStatus === "approved") {
                try {
                    await fetch("/api/line/notify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "PO",
                            data: { ...po, status: newStatus },
                            vendorData: vendorData,
                            projectName: currentProject?.name
                        })
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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 h-screen bg-slate-50">
                <Loader2 className="animate-spin w-10 h-10 text-blue-600 mb-4" />
                <p className="text-slate-500 font-medium">กำลังโหลดข้อมูล...</p>
            </div>
        );
    }

    if (!po) {
        return (
            <div className="flex flex-col items-center justify-center p-8 h-screen bg-slate-50 text-center">
                <FileText className="w-16 h-16 text-slate-300 mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">ไม่พบข้อมูล</h3>
                <p className="text-slate-500 mb-6">ไม่พบใบสั่งซื้อที่คุณกำลังค้นหา</p>
                <Link href="/liff" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold">กลับไปหน้าหลัก</Link>
            </div>
        );
    }

    const isPending = po.status === "pending";
    const canApprove = userProfile?.role === "admin" || userProfile?.role === "pm";

    const POStatusBadge = ({ status }: { status: string }) => {
        switch (status) {
            case 'approved': return <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-100 text-green-700 border border-green-200 uppercase tracking-wider">อนุมัติแล้ว</span>;
            case 'rejected': return <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-700 border border-red-200 uppercase tracking-wider">ไม่อนุมัติ</span>;
            case 'pending': return <span className="px-3 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-700 border border-orange-200 uppercase tracking-wider text-center">รออนุมัติ</span>;
            default: return <span className="px-3 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">ฉบับร่าง</span>;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            {/* Header - Enhanced with Gradient */}
            <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white p-4 pt-6 shadow-lg sticky top-0 z-40 flex items-center overflow-hidden">
                <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <Link href="/liff" className="mr-3 p-1.5 bg-white/15 rounded-full hover:bg-white/25 transition-colors relative z-10 backdrop-blur-sm">
                    <ArrowLeft size={20} />
                </Link>
                <div className="relative z-10">
                    <h1 className="text-lg font-black leading-tight tracking-tight">รายละเอียดใบสั่งซื้อ</h1>
                    <p className="text-[10px] text-blue-100 font-bold uppercase tracking-widest">{po.poNumber}</p>
                </div>
                {(po.status === 'draft' || po.status === 'rejected') && (
                    <Link
                        href={`/liff/po/${po.id}/edit`}
                        className="ml-auto p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors flex items-center gap-1.5"
                    >
                        <Edit size={16} />
                        <span className="text-xs font-bold">แก้ไข</span>
                    </Link>
                )}
            </div>

            <main className="p-4 space-y-4">
                {/* Status Card */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">สถานะโครงการ</p>
                        <h2 className="text-lg font-black text-slate-800 tracking-tight">{po.poNumber}</h2>
                    </div>
                    <POStatusBadge status={po.status} />
                </div>

                {/* Summary Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-100">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">ข้อมูลเอกสาร</h3>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="flex items-start">
                            <Calendar size={16} className="text-slate-400 mr-3 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs text-slate-400 mb-0.5">วันที่ออกเอกสาร</p>
                                <p className="text-sm font-semibold text-slate-700">{(po.createdAt as any)?.toDate().toLocaleDateString('th-TH', {
                                    year: 'numeric', month: 'long', day: 'numeric'
                                }) || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-start">
                            <User size={16} className="text-slate-400 mr-3 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs text-slate-400 mb-0.5">ร้านค้า / คู่ค้า</p>
                                <p className="text-sm font-bold text-slate-800">{po.vendorName}</p>
                            </div>
                        </div>
                        <div className="flex items-start">
                            <CreditCard size={16} className="text-slate-400 mr-3 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs text-slate-400 mb-0.5">เครดิตการชำระเงิน</p>
                                <p className="text-sm font-semibold text-slate-700">{po.creditDays ?? 30} วัน</p>
                            </div>
                        </div>
                        {po.poType === 'extra' && (
                            <div className="pt-2">
                                <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider border border-amber-200">
                                    ใบสั่งซื้อเพิ่มเติม (Extra PO)
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Vendor Contact - Action Bar */}
                {vendorData && (
                    <div className="flex gap-2">
                        <a
                            href={vendorData.phone ? `tel:${vendorData.phone}` : '#'}
                            className={`flex-1 flex justify-center items-center py-3 px-4 rounded-xl text-sm font-bold border transition-all ${vendorData.phone ? 'bg-green-50 text-green-600 border-green-200 active:bg-green-100 shadow-sm shadow-green-100/50' : 'bg-slate-50 text-slate-400 border-slate-200 grayscale opacity-50'}`}
                        >
                            <Phone size={16} className="mr-2" /> โทรหาคู่ค้า
                        </a>
                        <a
                            href={vendorData.googleMapUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex-1 flex justify-center items-center py-3 px-4 rounded-xl text-sm font-bold border transition-all ${vendorData.googleMapUrl ? 'bg-orange-50 text-orange-600 border-orange-200 active:bg-orange-100 shadow-sm shadow-orange-100/50' : 'bg-slate-50 text-slate-400 border-slate-200 grayscale opacity-50'}`}
                        >
                            <MapPin size={16} className="mr-2" /> แผนที่ร้าน
                        </a>
                    </div>
                )}

                {/* Items Section */}
                <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">รายการสิ่งของ ({po.items.length})</h3>
                    {po.items.map((item, idx) => (
                        <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-3">
                            <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
                                <Box size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <p className="text-sm font-bold text-slate-800 truncate pr-2">{item.description}</p>
                                    <p className="text-sm font-black text-slate-900 shrink-0">฿{item.amount?.toLocaleString()}</p>
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium mt-1">
                                    {item.quantity} {item.unit} @ ฿{item.unitPrice?.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Financial Summary */}
                <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl shadow-slate-200 mt-6 space-y-4">
                    <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-widest pb-3 border-b border-white/10">
                        <span>สรุปยอดเงิน</span>
                        <span>สกุลเงิน THB</span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm py-1">
                            <span className="text-slate-400 font-medium">รวมเป็นเงิน</span>
                            <span className="font-bold">฿ {po.subTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-sm py-1">
                            <span className="text-slate-400 font-medium">ภาษี {po.vatRate}%</span>
                            <span className="font-bold">฿ {po.vatAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-white/20 flex justify-between items-end">
                        <div>
                            <p className="text-[10px] text-blue-400 font-black uppercase mb-1">ยอดสุทธิรวมทั้งสิ้น</p>
                            <p className="text-xs text-slate-400 font-medium">(รวมภาษีมูลค่าเพิ่มแล้ว)</p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-white">฿ {po.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                </div>

            </main>

            {/* Fixed Bottom Actions for Approval */}
            {isPending && canApprove && (
                <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md p-4 pt-4 border-t border-slate-200 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-50 flex gap-3 pb-8">
                    <button
                        onClick={() => handleStatusUpdate("rejected")}
                        disabled={actionLoading}
                        className="flex-1 flex justify-center items-center py-4 bg-white text-red-600 rounded-2xl font-black text-sm border border-red-100 active:bg-red-50 transition-colors disabled:opacity-50 shadow-sm shadow-red-50/50"
                    >
                        <XCircle size={18} className="mr-2" /> ไม่อนุมัติ
                    </button>
                    <button
                        onClick={() => handleStatusUpdate("approved")}
                        disabled={actionLoading}
                        className="flex-[1.5] flex justify-center items-center py-4 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-200 active:bg-blue-700 transition-all disabled:opacity-50"
                    >
                        {actionLoading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <CheckCircle size={18} className="mr-2" />}
                        อนุมัติสั่งซื้อ
                    </button>
                </div>
            )}
        </div>
    );
}
