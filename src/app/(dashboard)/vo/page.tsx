"use client";

import { useProject } from "@/context/ProjectContext";
import { Plus, Search, FileEdit, Eye } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { VariationOrder } from "@/types/vo";

export default function VOListingPage() {
    const { currentProject } = useProject();
    const [vos, setVos] = useState<VariationOrder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentProject) {
            setVos([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const q = query(
            collection(db, "variation_orders"),
            where("projectId", "==", currentProject.id)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const voData: VariationOrder[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                voData.push({ id: doc.id, ...data } as VariationOrder);
            });

            // Sort client-side temporarily to avoid index issues initially
            voData.sort((a, b) => {
                const dateA = a.createdAt ? new Date((a.createdAt as any).toDate()).getTime() : 0;
                const dateB = b.createdAt ? new Date((b.createdAt as any).toDate()).getTime() : 0;
                return dateB - dateA;
            });

            setVos(voData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentProject]);

    const translatedStatus = (status: string) => {
        switch (status) {
            case "draft": return { label: "ฉบับร่าง", color: "bg-slate-100 text-slate-800" };
            case "pending": return { label: "รออนุมัติ", color: "bg-orange-100 text-orange-800" };
            case "approved": return { label: "อนุมัติแล้ว", color: "bg-green-100 text-green-800" };
            case "rejected": return { label: "ไม่อนุมัติ", color: "bg-red-100 text-red-800" };
            default: return { label: status, color: "bg-slate-100 text-slate-800" };
        }
    };

    if (!currentProject) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
                <FileEdit className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">กรุณาเลือกโครงการก่อสร้าง</h3>
                <p>เลือกโครงการจากเมนูด้านบน เพื่อดูรายการงานเพิ่ม-ลด ทั้งหมด</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">งานเพิ่ม-ลด (Variation Orders)</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        โครงการ: <span className="font-semibold text-blue-600">{currentProject.name}</span>
                    </p>
                </div>
                <Link
                    href="/vo/create"
                    className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 transition-colors"
                >
                    <Plus size={18} className="mr-2" />
                    สร้างรายการงานเพิ่ม-ลด
                </Link>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                    <div className="relative max-w-sm w-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="ค้นหาเลขที่ VO หรือชื่องาน..."
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    เลขที่ VO
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    วันที่สร้าง
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/3">
                                    หัวข้องานเพิ่ม-ลด
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    ผลกระทบงบประมาณ
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
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                        กำลังโหลดข้อมูล...
                                    </td>
                                </tr>
                            ) : vos.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center flex-col items-center">
                                        <FileEdit className="mx-auto h-12 w-12 text-slate-300" />
                                        <h3 className="mt-2 text-sm font-semibold text-slate-900">ไม่มีรายการงานเพิ่ม-ลด</h3>
                                        <p className="mt-1 text-sm text-slate-500">ยังไม่มีประวัติการส่งคำขอ Variation Order สำหรับโครงการนี้</p>
                                    </td>
                                </tr>
                            ) : (
                                vos.map((vo) => {
                                    const statusInfo = translatedStatus(vo.status);
                                    let dateStr = "ไม่ระบุ";
                                    if (vo.createdAt && (vo.createdAt as any).toDate) {
                                        dateStr = (vo.createdAt as any).toDate().toLocaleDateString('th-TH');
                                    }

                                    const isPositive = vo.totalAmount > 0;
                                    const isNegative = vo.totalAmount < 0;

                                    return (
                                        <tr key={vo.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-orange-600">
                                                {vo.voNumber}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                {dateStr}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium truncate max-w-xs">
                                                {vo.title}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                                                <span className={isPositive ? 'text-red-600' : isNegative ? 'text-green-600' : 'text-slate-500'}>
                                                    {isPositive ? '+' : ''}{vo.totalAmount ? `฿${vo.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "฿0.00"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusInfo.color}`}>
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <Link href={`/vo/${vo.id}`} className="inline-flex text-slate-400 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded-lg transition-colors border border-transparent" title="ดูรายละเอียด">
                                                    <Eye size={18} />
                                                </Link>
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
