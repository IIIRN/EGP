"use client";

import { useProject } from "@/context/ProjectContext";
import { Plus, Search, FileText, ArrowRight, Eye, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PurchaseOrder } from "@/types/po";

export default function POListingPage() {
    const { currentProject } = useProject();
    const [pos, setPos] = useState<PurchaseOrder[]>([]);
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"project" | "extra">("project");

    // Compute filtered POS
    const renderedPos = pos.filter(po => (po.poType || 'project') === activeTab);

    useEffect(() => {
        if (!currentProject) {
            setPos([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        // Fetch user mapping
        const usersUnsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
            const uMap: Record<string, string> = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                uMap[doc.id] = data.displayName || data.email || doc.id;
            });
            setUsersMap(uMap);
        });

        const q = query(
            collection(db, "purchase_orders"),
            where("projectId", "==", currentProject.id),
            // Need an index in Firebase for where + orderBy. For now, removing orderBy to avoid missing index error initially.
            // When putting to production, create index on projectId and createdAt.
            // orderBy("createdAt", "desc") 
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const poData: PurchaseOrder[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                poData.push({ id: doc.id, ...data } as PurchaseOrder);
            });

            // Sort client-side temporarily to avoid index issues
            poData.sort((a, b) => {
                const dateA = a.createdAt ? new Date((a.createdAt as any).toDate()).getTime() : 0;
                const dateB = b.createdAt ? new Date((b.createdAt as any).toDate()).getTime() : 0;
                return dateB - dateA;
            });

            setPos(poData);
            setLoading(false);
        });

        return () => {
            usersUnsubscribe();
            unsubscribe();
        };
    }, [currentProject]);

    const translatedStatus = (status: string) => {
        switch (status) {
            case "draft": return { label: "ฉบับร่าง", color: "bg-slate-100 text-slate-800" };
            case "pending": return { label: "รออนุมัติ", color: "bg-yellow-100 text-yellow-800" };
            case "approved": return { label: "อนุมัติแล้ว", color: "bg-green-100 text-green-800" };
            case "rejected": return { label: "ไม่อนุมัติ", color: "bg-red-100 text-red-800" };
            default: return { label: status, color: "bg-slate-100 text-slate-800" };
        }
    };

    const handleDelete = async (poId: string, poNumber: string) => {
        if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบใบสั่งซื้อ ${poNumber}? ข้อมูลจะไม่สามารถกู้คืนได้`)) {
            return;
        }
        try {
            await deleteDoc(doc(db, "purchase_orders", poId));
        } catch (error) {
            console.error("Error deleting PO:", error);
            alert("เกิดข้อผิดพลาดในการลบใบสั่งซื้อ");
        }
    };

    if (!currentProject) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
                <FileText className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">กรุณาเลือกโครงการก่อสร้าง</h3>
                <p>เลือกโครงการจากเมนูด้านบน เพื่อดูรายการใบสั่งซื้อทั้งหมด</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ใบสั่งซื้อ (Purchase Orders)</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        โครงการ: <span className="font-semibold text-blue-600">{currentProject.name}</span>
                    </p>
                </div>
                <Link
                    href="/po/create"
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
                >
                    <Plus size={18} className="mr-2" />
                    สร้างใบสั่งซื้อใหม่
                </Link>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50/50">
                    <div className="flex border-b border-slate-200">
                        <button
                            onClick={() => setActiveTab("project")}
                            className={`flex flex-1 items-center justify-center py-4 text-sm font-medium text-center border-b-2 transition-colors ${activeTab === 'project' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'}`}
                        >
                            PO ในโครงการ
                            <span className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold ${activeTab === 'project' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                                {pos.filter(po => (po.poType || 'project') === 'project').length}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab("extra")}
                            className={`flex flex-1 items-center justify-center py-4 text-sm font-medium text-center border-b-2 transition-colors ${activeTab === 'extra' ? 'border-amber-500 text-amber-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'}`}
                        >
                            PO เพิ่มเติม (นอกงบ)
                            <span className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold ${activeTab === 'extra' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                                {pos.filter(po => po.poType === 'extra').length}
                            </span>
                        </button>
                    </div>
                </div>

                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
                    <div className="relative max-w-sm w-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="ค้นหาเลขที่ใบสั่งซื้อ หรือชื่อผู้ขาย..."
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    เลขที่ PO
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    วันที่สร้าง
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    ผู้ขาย / คู่ค้า
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    ผู้ทำเอกสาร
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    ยอดสุทธิ (Total)
                                </th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    สถานะ
                                </th>
                                <th scope="col" className="relative px-6 py-3">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                        กำลังโหลดข้อมูล...
                                    </td>
                                </tr>
                            ) : renderedPos.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center flex-col items-center">
                                        <FileText className="mx-auto h-12 w-12 text-slate-300" />
                                        <h3 className="mt-2 text-sm font-semibold text-slate-900">ไม่มีรายการใบสั่งซื้อ</h3>
                                        <p className="mt-1 text-sm text-slate-500">ไม่พบเอกสารประเภทที่เลือก</p>
                                    </td>
                                </tr>
                            ) : (
                                renderedPos.map((po) => {
                                    const statusInfo = translatedStatus(po.status);
                                    let dateStr = "ไม่ระบุ";
                                    if (po.createdAt && (po.createdAt as any).toDate) {
                                        dateStr = (po.createdAt as any).toDate().toLocaleDateString('th-TH');
                                    }

                                    return (
                                        <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                                                {po.poNumber}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                {dateStr}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                                                {po.vendorName}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                {usersMap[po.createdBy] || po.createdBy || "ไม่ระบุ"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 text-right font-medium">
                                                {po.totalAmount ? `฿${po.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "฿0.00"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusInfo.color}`}>
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end space-x-1">
                                                    <Link href={`/po/${po.id}`} className="inline-flex text-slate-400 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded-lg transition-colors border border-transparent" title="ดูรายละเอียด">
                                                        <Eye size={18} />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(po.id, po.poNumber)}
                                                        className="inline-flex text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors border border-transparent"
                                                        title="ลบเอกสาร"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
