"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, Printer, FileEdit, Loader2, Edit, Trash2 } from "lucide-react";
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { VariationOrder } from "@/types/vo";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";

export default function VODetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { userProfile } = useAuth();
    const { currentProject } = useProject();

    const [vo, setVo] = useState<VariationOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        async function fetchVO() {
            if (!resolvedParams.id) return;
            try {
                const docRef = doc(db, "variation_orders", resolvedParams.id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setVo({ id: docSnap.id, ...docSnap.data() } as VariationOrder);
                } else {
                    console.error("No such document!");
                }
            } catch (error) {
                console.error("Error fetching VO:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchVO();
    }, [resolvedParams.id]);

    const handleStatusUpdate = async (newStatus: "approved" | "rejected") => {
        if (!vo || !userProfile) return;
        setActionLoading(true);

        try {
            const voRef = doc(db, "variation_orders", vo.id);
            await updateDoc(voRef, {
                status: newStatus,
                updatedAt: serverTimestamp(),
            });

            // If approved, update Project Budget dynamically
            if (newStatus === "approved" && currentProject) {
                // Here you would theoretically update the project's total budget via cloud function or direct update
                // For now, we only update the document state

                // Trigger LINE Notification
                try {
                    await fetch("/api/line/notify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "VO",
                            data: { ...vo, status: newStatus },
                            projectName: currentProject.name
                        })
                    });
                } catch (e) {
                    console.error("Line notification failed:", e);
                }
            }

            setVo({ ...vo, status: newStatus });

        } catch (error) {
            console.error("Error updating VO status:", error);
            alert("ไม่สามารถอัปเดตสถานะได้");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!vo || !resolvedParams.id) return;
        if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบใบสั่งเปลี่ยนงาน "${vo.voNumber}"?\nการกระทำนี้ลบถาวรและไม่สามารถกู้คืนได้`)) return;

        setDeleting(true);
        try {
            await deleteDoc(doc(db, "variation_orders", resolvedParams.id));
            router.push("/vo");
        } catch (error) {
            console.error("Error deleting VO:", error);
            alert("ลบข้อมูลไม่สำเร็จ");
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="animate-spin w-8 h-8 text-orange-600 mb-4" />
                <p className="text-slate-500">กำลังโหลดข้อมูลงานเพิ่ม-ลด...</p>
            </div>
        );
    }

    if (!vo) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
                <FileEdit className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">ไม่พบข้อมูล</h3>
                <p>ไม่พบรายการงานเพิ่ม-ลดที่คุณกำลังค้นหา อาจถูกลบหรือไม่มีอยู่จริง</p>
                <Link href="/vo" className="mt-4 inline-block text-orange-600 hover:underline">กลับไปหน้ารายการ VO</Link>
            </div>
        );
    }

    const isPending = vo.status === "pending";
    // Usually only PM or Admin can approve variation orders
    const canApprove = userProfile?.role === "admin" || userProfile?.role === "pm";

    return (
        <div className="max-w-4xl mx-auto space-y-6 print:m-0 print:w-full print:max-w-none print:space-y-0">
            {/* Header Actions */}
            <div className="flex items-center justify-between print:hidden">
                <div className="flex items-center space-x-4">
                    <Link href="/vo" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">รายละเอียดงานเพิ่ม-ลด</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {vo.voNumber} • โครงการ: {currentProject?.name}
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

                    {(vo.status === "draft" || vo.status === "rejected") && (
                        <Link
                            href={`/vo/${vo.id}/edit`}
                            className="inline-flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-blue-100 transition-colors"
                        >
                            <Edit size={16} className="mr-2" />
                            แก้ไขใบสั่งเปลี่ยนงาน
                        </Link>
                    )}

                    {(vo.status === "draft" || vo.status === "rejected") && (
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="inline-flex items-center justify-center rounded-lg bg-white text-red-600 border border-red-200 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                            {deleting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Trash2 size={16} className="mr-2" />}
                            ลบ
                        </button>
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
                                อนุมัติ (ส่งผลต่องบระมาณ)
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
                            <h2 className="text-xl font-bold text-slate-800">VARIATION ORDER</h2>
                            <p className="text-slate-500 text-sm mt-1">ใบสั่งเปลี่ยนแปลงงาน (งานเพิ่ม-ลด)</p>
                        </div>
                        <div className="text-right">
                            <h3 className="text-lg font-semibold text-orange-600">{vo.voNumber}</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                วันที่สร้าง: {(vo.createdAt as any)?.toDate().toLocaleDateString('th-TH') || 'N/A'}
                            </p>
                            <div className="mt-2">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${vo.status === 'approved' ? 'bg-green-100 text-green-800' :
                                    vo.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                        vo.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                                            'bg-slate-100 text-slate-800'
                                    }`}>
                                    {vo.status === 'approved' ? 'อนุมัติแล้ว' :
                                        vo.status === 'rejected' ? 'ไม่อนุมัติ' :
                                            vo.status === 'pending' ? 'รออนุมัติ' : 'ฉบับร่าง'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* VO General Info */}
                    <div className="grid grid-cols-1 gap-6 text-sm">
                        <div>
                            <h4 className="font-semibold text-slate-500 mb-1">หัวข้องานเพิ่มเติม/แก้ไข:</h4>
                            <p className="font-medium text-slate-900 text-lg">{vo.title}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-500 mb-1">สาเหตุและความจำเป็น (Reason):</h4>
                            <p className="text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-100">
                                {vo.reason || "ไม่ได้ระบุเหตุผล"}
                            </p>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="mt-8 border border-slate-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">ลำดับ</th>
                                    <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">ประเภท</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">รายการงานวัสดุ</th>
                                    <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">จำนวน</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">หน่วย</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">ราคา/หน่วย</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">ผลกระทบ</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {vo.items.map((item, index) => (
                                    <tr key={index}>
                                        <td className="px-4 py-3 text-sm text-slate-500">{index + 1}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded ${item.type === 'add' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                                {item.type === 'add' ? 'งานเพิ่ม' : 'งานลด'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-900 font-medium">{item.description}</td>
                                        <td className="px-4 py-3 text-sm text-slate-900 text-center">{item.quantity}</td>
                                        <td className="px-4 py-3 text-sm text-slate-500">{item.unit}</td>
                                        <td className="px-4 py-3 text-sm text-slate-900 text-right">
                                            {item.unitPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className={`px-4 py-3 text-sm text-right font-bold ${item.type === 'add' ? 'text-red-600' : 'text-green-600'}`}>
                                            {item.type === 'add' ? '+' : '-'}{item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary Totals */}
                    <div className="flex justify-end pt-4">
                        <div className="w-80 space-y-4 bg-slate-50 p-6 rounded-xl border border-slate-100">
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>ยอดสุทธิก่อนภาษี (Subtotal)</span>
                                <span className={`font-medium ${vo.subTotal > 0 ? 'text-red-600' : vo.subTotal < 0 ? 'text-green-600' : 'text-slate-900'}`}>
                                    {vo.subTotal > 0 ? '+' : ''}฿ {vo.subTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600 items-center">
                                <span>ภาษีมูลค่าเพิ่ม (VAT {vo.vatRate}%)</span>
                                <span className={`font-medium ${vo.vatAmount > 0 ? 'text-red-500' : vo.vatAmount < 0 ? 'text-green-500' : 'text-slate-900'}`}>
                                    {vo.vatAmount > 0 ? '+' : ''}฿ {vo.vatAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="flex justify-between text-base pt-3 border-t border-slate-200">
                                <span className="font-bold text-slate-900 uppercase">รวมผลกระทบทั้งหมด</span>
                                <span className={`font-bold ${vo.totalAmount > 0 ? 'text-red-600' : vo.totalAmount < 0 ? 'text-green-600' : 'text-slate-900'}`}>
                                    {vo.totalAmount > 0 ? '+' : ''}฿ {vo.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

        </div>
    );
}
