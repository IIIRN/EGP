"use client";

import { useProject } from "@/context/ProjectContext";
import { Plus, Search, FileText, Eye, Trash2, Briefcase } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { WorkContract } from "@/types/wc";

export default function WCListingPage() {
    const { currentProject } = useProject();
    const [wcs, setWcs] = useState<WorkContract[]>([]);
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"project" | "extra">("project");
    const [searchText, setSearchText] = useState("");

    const renderedWcs = wcs
        .filter(wc => (wc.wcType || "project") === activeTab)
        .filter(wc =>
            wc.wcNumber.toLowerCase().includes(searchText.toLowerCase()) ||
            (wc.vendorName || "").toLowerCase().includes(searchText.toLowerCase()) ||
            (wc.title || "").toLowerCase().includes(searchText.toLowerCase())
        );

    useEffect(() => {
        if (!currentProject) {
            setWcs([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const usersUnsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
            const uMap: Record<string, string> = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                uMap[doc.id] = data.displayName || data.email || doc.id;
            });
            setUsersMap(uMap);
        });

        const q = query(
            collection(db, "work_contracts"),
            where("projectId", "==", currentProject.id),
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const wcData: WorkContract[] = [];
            snapshot.forEach((doc) => {
                wcData.push({ id: doc.id, ...doc.data() } as WorkContract);
            });

            wcData.sort((a, b) => {
                const dateA = a.createdAt ? new Date((a.createdAt as any).toDate()).getTime() : 0;
                const dateB = b.createdAt ? new Date((b.createdAt as any).toDate()).getTime() : 0;
                return dateB - dateA;
            });

            setWcs(wcData);
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

    const handleDelete = async (wcId: string, wcNumber: string) => {
        if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบใบจ้างงาน ${wcNumber}? ข้อมูลจะไม่สามารถกู้คืนได้`)) {
            return;
        }
        try {
            await deleteDoc(doc(db, "work_contracts", wcId));
        } catch (error) {
            console.error("Error deleting WC:", error);
            alert("เกิดข้อผิดพลาดในการลบใบจ้างงาน");
        }
    };

    if (!currentProject) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
                <Briefcase className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">กรุณาเลือกโครงการก่อสร้าง</h3>
                <p>เลือกโครงการจากเมนูด้านบน เพื่อดูรายการใบจ้างงานทั้งหมด</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ใบจ้างงาน (Work Contracts)</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        โครงการ: <span className="font-semibold text-emerald-600">{currentProject.name}</span>
                    </p>
                </div>
                <Link
                    href="/wc/create"
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
                >
                    <Plus size={18} className="mr-2" />
                    สร้างใบจ้างงานใหม่
                </Link>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab("project")}
                        className={`flex flex-1 items-center justify-center py-4 text-sm font-medium text-center border-b-2 transition-colors ${activeTab === 'project' ? 'border-emerald-600 text-emerald-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'}`}
                    >
                        ใบจ้างงานในโครงการ (WC)
                        <span className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold ${activeTab === 'project' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                            {wcs.filter(w => (w.wcType || 'project') === 'project').length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab("extra")}
                        className={`flex flex-1 items-center justify-center py-4 text-sm font-medium text-center border-b-2 transition-colors ${activeTab === 'extra' ? 'border-amber-500 text-amber-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'}`}
                    >
                        ใบจ้างงานเพิ่มเติม (EWC)
                        <span className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold ${activeTab === 'extra' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                            {wcs.filter(w => w.wcType === 'extra').length}
                        </span>
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
                    <div className="relative max-w-sm w-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="ค้นหาเลขที่ , ชื่อผู้รับจ้าง หรือหัวข้องาน..."
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">เลขที่ WC</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">หัวข้องาน</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">วันที่สร้าง</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ผู้รับจ้าง</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ผู้ทำเอกสาร</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">ยอดสุทธิ</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">สถานะ</th>
                                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">กำลังโหลดข้อมูล...</td>
                                </tr>
                            ) : renderedWcs.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center">
                                        <Briefcase className="mx-auto h-12 w-12 text-slate-300" />
                                        <h3 className="mt-2 text-sm font-semibold text-slate-900">ไม่มีรายการใบจ้างงาน</h3>
                                        <p className="mt-1 text-sm text-slate-500">ยังไม่มีเอกสารประเภทที่เลือกในโครงการนี้</p>
                                    </td>
                                </tr>
                            ) : (
                                renderedWcs.map((wc) => {
                                    const statusInfo = translatedStatus(wc.status);
                                    let dateStr = "ไม่ระบุ";
                                    if (wc.createdAt && (wc.createdAt as any).toDate) {
                                        dateStr = (wc.createdAt as any).toDate().toLocaleDateString('th-TH');
                                    }

                                    return (
                                        <tr key={wc.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-emerald-600">{wc.wcNumber}</td>
                                            <td className="px-6 py-4 text-sm text-slate-700 max-w-[200px] truncate">{wc.title || "-"}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{dateStr}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{wc.vendorName || "-"}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                {usersMap[wc.createdBy] || wc.createdBy || "ไม่ระบุ"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 text-right font-medium">
                                                {wc.totalAmount ? `฿${wc.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "฿0.00"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusInfo.color}`}>
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end space-x-1">
                                                    <Link href={`/wc/${wc.id}`} className="inline-flex text-slate-400 hover:text-emerald-600 p-1.5 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent" title="ดูรายละเอียด">
                                                        <Eye size={18} />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(wc.id, wc.wcNumber)}
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
