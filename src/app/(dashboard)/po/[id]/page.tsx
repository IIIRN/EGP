"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, Printer, FileText, Loader2, Edit } from "lucide-react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PurchaseOrder } from "@/types/po";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";

export default function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { userProfile } = useAuth();
    const { currentProject } = useProject();

    const [po, setPo] = useState<PurchaseOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        async function fetchPO() {
            if (!resolvedParams.id) return;
            try {
                const docRef = doc(db, "purchase_orders", resolvedParams.id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setPo({ id: docSnap.id, ...docSnap.data() } as PurchaseOrder);
                } else {
                    console.error("No such document!");
                }
            } catch (error) {
                console.error("Error fetching PO:", error);
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
                // In a real app, you might save who approved it
                // approvedBy: userProfile.uid
            });

            // IF APPROVED, Trigger LINE Notification
            if (newStatus === "approved") {
                try {
                    // Fetch vendor info to embed in notification
                    let vendorData = null;
                    if (po.vendorId) {
                        const vendorSnap = await getDoc(doc(db, "vendors", po.vendorId));
                        if (vendorSnap.exists()) vendorData = vendorSnap.data();
                    }

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

            // Update local state
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
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="animate-spin w-8 h-8 text-blue-600 mb-4" />
                <p className="text-slate-500">กำลังโหลดข้อมูลใบสั่งซื้อ...</p>
            </div>
        );
    }

    if (!po) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
                <FileText className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">ไม่พบข้อมูล</h3>
                <p>ไม่พบใบสั่งซื้อที่คุณกำลังค้นหา อาจถูกลบหรือไม่มีอยู่จริง</p>
                <Link href="/po" className="mt-4 inline-block text-blue-600 hover:underline">กลับไปหน้ารายการใบสั่งซื้อ</Link>
            </div>
        );
    }

    const isPending = po.status === "pending";
    const canApprove = userProfile?.role === "admin" || userProfile?.role === "pm";

    return (
        <div className="max-w-4xl mx-auto space-y-6 print:space-y-0 print:m-0 print:w-full print:max-w-none">
            {/* Header Actions */}
            <div className="flex items-center justify-between print:hidden">
                <div className="flex items-center space-x-4">
                    <Link href="/po" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">รายละเอียดใบสั่งซื้อ</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {po.poNumber} • โครงการ: {currentProject?.name}
                        </p>
                    </div>
                </div>

                <div className="flex space-x-3">
                    <button
                        onClick={() => window.print()}
                        className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                    >
                        <Printer size={16} className="mr-2" />
                        พิมพ์ PDF
                    </button>

                    {(po.status === "draft" || po.status === "rejected") && (
                        <Link
                            href={`/po/${po.id}/edit`}
                            className="inline-flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-blue-100 transition-colors"
                        >
                            <Edit size={16} className="mr-2" />
                            แก้ไขใบสั่งซื้อ
                        </Link>
                    )}

                    {isPending && canApprove && (
                        <>
                            <button
                                onClick={() => handleStatusUpdate("rejected")}
                                disabled={actionLoading}
                                className="inline-flex items-center justify-center rounded-lg bg-white border border-red-200 text-red-600 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                                <XCircle size={16} className="mr-2" />
                                ไม่อนุมัติ
                            </button>
                            <button
                                onClick={() => handleStatusUpdate("approved")}
                                disabled={actionLoading}
                                className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 transition-colors disabled:opacity-50"
                            >
                                {actionLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CheckCircle size={16} className="mr-2" />}
                                อนุมัติสั่งซื้อ
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Document Content */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-0 print:rounded-none">
                <div className="p-8 space-y-8 print:p-0">

                    {/* Header Info */}
                    <div className="flex justify-between items-start border-b border-slate-200 pb-6 print:pb-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">PURCHASE ORDER</h2>
                            <p className="text-slate-500 text-sm mt-1">ใบสั่งซื้อสินค้า/บริการ</p>
                        </div>
                        <div className="text-right">
                            <h3 className="text-lg font-semibold text-blue-600">{po.poNumber}</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                วันที่: {(po.createdAt as any)?.toDate().toLocaleDateString('th-TH') || 'N/A'}
                            </p>
                            <div className="mt-2">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${po.status === 'approved' ? 'bg-green-100 text-green-800' :
                                    po.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                        po.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-slate-100 text-slate-800'
                                    }`}>
                                    {po.status === 'approved' ? 'อนุมัติแล้ว' :
                                        po.status === 'rejected' ? 'ไม่อนุมัติ' :
                                            po.status === 'pending' ? 'รออนุมัติ' : 'ฉบับร่าง'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Vendor & Project Info */}
                    <div className="grid grid-cols-2 gap-8 text-sm">
                        <div className="space-y-3">
                            <div>
                                <h4 className="font-semibold text-slate-400 uppercase text-xs tracking-wider">สั่งซื้อจาก (Vendor)</h4>
                                <p className="font-medium text-slate-900 mt-1">{po.vendorName}</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <h4 className="font-semibold text-slate-400 uppercase text-xs tracking-wider">จัดส่งที่ (Deliver To)</h4>
                                <p className="font-medium text-slate-900 mt-1">{currentProject?.name}</p>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="mt-8 border border-slate-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">ลำดับ</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">รายการวัสดุ</th>
                                    <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">จำนวน</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">หน่วย</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">ราคา/หน่วย</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">รวมเป็นเงิน</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {po.items.map((item, index) => (
                                    <tr key={item.id}>
                                        <td className="px-4 py-3 text-sm text-slate-500">{index + 1}</td>
                                        <td className="px-4 py-3 text-sm text-slate-900 font-medium">{item.description}</td>
                                        <td className="px-4 py-3 text-sm text-slate-900 text-center">{item.quantity}</td>
                                        <td className="px-4 py-3 text-sm text-slate-500">{item.unit}</td>
                                        <td className="px-4 py-3 text-sm text-slate-900 text-right">
                                            {item.unitPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-900 text-right font-medium">
                                            {item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary Totals */}
                    <div className="flex justify-end pt-4">
                        <div className="w-80 space-y-3">
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>ยอดรวมก่อนภาษี (Subtotal)</span>
                                <span className="font-medium text-slate-900">฿ {po.subTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600 items-center">
                                <span>ภาษีมูลค่าเพิ่ม (VAT {po.vatRate}%)</span>
                                <span className="font-medium text-slate-900">฿ {po.vatAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-base pt-3 border-t border-slate-200">
                                <span className="font-bold text-slate-900">ยอดเงินสุทธิ (Total)</span>
                                <span className="font-bold text-blue-700">฿ {po.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

        </div>
    );
}
