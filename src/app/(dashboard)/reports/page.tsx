"use client";

import { useProject } from "@/context/ProjectContext";
import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Building2, LineChart, Wallet, TrendingDown, ArrowUpRight, ArrowDownRight, Loader2, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { PurchaseOrder } from "@/types/po";
import { VariationOrder } from "@/types/vo";

interface ProjectStats {
    projectId: string;
    approvedPOTotal: number;
    approvedVOTotal: number;
}

export default function ReportsPage() {
    const { allProjects, loading: projectsLoading } = useProject();
    const [statsMap, setStatsMap] = useState<Record<string, ProjectStats>>({});
    const [posByProject, setPosByProject] = useState<Record<string, any[]>>({});
    const [loadingStats, setLoadingStats] = useState(true);
    const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

    useEffect(() => {
        // Fetch all approved POs
        const poQuery = query(collection(db, "purchase_orders"), where("status", "==", "approved"));
        const unSubPO = onSnapshot(poQuery, (snapshot) => {
            const pos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder));

            // grouping by project and storing po list
            const poAgg: Record<string, number> = {};
            const posMap: Record<string, any[]> = {};
            pos.forEach(po => {
                const pid = po.projectId as string;
                if (!poAgg[pid]) poAgg[pid] = 0;
                poAgg[pid] += (po.totalAmount || 0);

                if (!posMap[pid]) posMap[pid] = [];
                posMap[pid].push(po);
            });

            setPosByProject(posMap);

            setStatsMap(prev => {
                const newMap = { ...prev };
                Object.keys(poAgg).forEach(pid => {
                    if (!newMap[pid]) newMap[pid] = { projectId: pid, approvedPOTotal: 0, approvedVOTotal: 0 };
                    newMap[pid].approvedPOTotal = poAgg[pid];
                });
                return newMap;
            });
            setLoadingStats(false);
        });

        // Fetch all approved VOs
        const voQuery = query(collection(db, "variation_orders"), where("status", "==", "approved"));
        const unSubVO = onSnapshot(voQuery, (snapshot) => {
            const vos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VariationOrder));

            const voAgg = vos.reduce((acc, vo) => {
                const pid = vo.projectId as string;
                if (!acc[pid]) acc[pid] = 0;
                acc[pid] += (vo.totalAmount || 0);
                return acc;
            }, {} as Record<string, number>);

            setStatsMap(prev => {
                const newMap = { ...prev };
                Object.keys(voAgg).forEach(pid => {
                    if (!newMap[pid]) newMap[pid] = { projectId: pid, approvedPOTotal: 0, approvedVOTotal: 0 };
                    newMap[pid].approvedVOTotal = voAgg[pid];
                });
                return newMap;
            });
        });

        return () => {
            unSubPO();
            unSubVO();
        };
    }, []);

    // Summaries
    const totalProjects = allProjects.length;
    const totalBudget = allProjects.reduce((sum, p) => sum + (p.budget || 0), 0);
    const totalVO = Object.values(statsMap).reduce((sum, s) => sum + s.approvedVOTotal, 0);
    const totalNetBudget = totalBudget + totalVO;
    const totalPO = Object.values(statsMap).reduce((sum, s) => sum + s.approvedPOTotal, 0);
    const totalAvailable = totalNetBudget - totalPO;
    const overallUsedPercent = totalNetBudget > 0 ? (totalPO / totalNetBudget) * 100 : 0;

    if (projectsLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center">
                        <LineChart className="mr-3 text-blue-600" size={28} />
                        รายงานสรุปโครงการ
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">ภาพรวมและรายละเอียดค่าใช้จ่ายในแต่ละโครงการทั้งหมด</p>
                </div>
            </div>

            {/* Overall KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full opacity-50 pointer-events-none"></div>
                    <p className="text-sm font-semibold text-slate-500 mb-1">โครงการทั้งหมด</p>
                    <div className="flex items-end gap-2 text-blue-600">
                        <Building2 size={24} className="mb-1" />
                        <h2 className="text-3xl font-bold text-slate-900">{totalProjects}</h2>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full opacity-50 pointer-events-none"></div>
                    <p className="text-sm font-semibold text-slate-500 mb-1">งบประมาณสุทธิรวม (All Projects)</p>
                    <div className="flex items-end gap-2 text-indigo-600">
                        <Wallet size={24} className="mb-1" />
                        <h2 className="text-3xl font-bold text-slate-900">฿ {totalNetBudget.toLocaleString(undefined, { minimumFractionDigits: 0 })}</h2>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-50 rounded-full opacity-50 pointer-events-none"></div>
                    <p className="text-sm font-semibold text-slate-500 mb-1">เบิกจ่ายรวม (Approved POs)</p>
                    <div className="flex items-end gap-2 text-orange-500">
                        <TrendingDown size={24} className="mb-1" />
                        <h2 className="text-3xl font-bold text-slate-900">฿ {totalPO.toLocaleString(undefined, { minimumFractionDigits: 0 })}</h2>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full opacity-50 pointer-events-none"></div>
                    <p className="text-sm font-semibold text-slate-500 mb-1">งบประมาณคงเหลือภาพรวม</p>
                    <div className="flex items-end gap-2 text-emerald-600">
                        <ArrowUpRight size={24} className="mb-1" />
                        <h2 className="text-3xl font-bold text-slate-900">
                            ฿ {totalAvailable.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                        </h2>
                    </div>
                    <div className="mt-4 w-full bg-slate-100 rounded-full h-2">
                        <div
                            className={`h-2 rounded-full ${overallUsedPercent > 100 ? 'bg-red-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(overallUsedPercent, 100)}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 text-right">ใช้ไปแล้ว {overallUsedPercent.toFixed(1)}%</p>
                </div>
            </div>

            {/* Detailed Projects Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center">
                        <Building2 className="mr-2 text-slate-400" size={20} />
                        รายละเอียดแยกตามโครงการ
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-1/4">โครงการ</th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">งบตั้งต้น</th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">งานลด-เพิ่ม (VO)</th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-100/50">งบสุทธิ</th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">สั่งซื้อแล้ว (PO)</th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider bg-blue-50/30">คงเหลือ</th>
                                <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">% เบิกจ่าย</th>
                                <th scope="col" className="px-3 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {allProjects.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center text-slate-500">ไม่มีข้อมูลโครงการ</td>
                                </tr>
                            ) : (
                                allProjects.map(project => {
                                    const stats = statsMap[project.id] || { approvedPOTotal: 0, approvedVOTotal: 0 };
                                    const initial = project.budget || 0;
                                    const voTotal = stats.approvedVOTotal;
                                    const netBudget = initial + voTotal;
                                    const poTotal = stats.approvedPOTotal;
                                    const available = netBudget - poTotal;
                                    const usedPercent = netBudget > 0 ? (poTotal / netBudget) * 100 : 0;
                                    const isOver = usedPercent > 100;

                                    const isExpanded = expandedProjectId === project.id;
                                    const projectPOs = posByProject[project.id] || [];

                                    return (
                                        <React.Fragment key={project.id}>
                                            <tr
                                                className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                                onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-slate-800 flex items-center gap-2">
                                                        {project.name}
                                                    </div>
                                                    <div className="text-xs text-slate-500 font-mono mt-1">{project.code}</div>
                                                    <div className="mt-1">
                                                        <span className={`inline-flex px-2 py-0.5 text-[10px] rounded-full font-medium ${project.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                            project.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {project.status === 'completed' ? 'เสร็จสิ้น' :
                                                                project.status === 'in_progress' ? 'กำลังดำเนินการ' : 'สถานะอื่นๆ'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm text-slate-600 font-medium">
                                                    {initial.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm font-medium">
                                                    <span className={voTotal > 0 ? 'text-green-600' : voTotal < 0 ? 'text-red-500' : 'text-slate-400'}>
                                                        {voTotal > 0 ? '+' : ''}{voTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm font-bold text-slate-800 bg-slate-100/30">
                                                    {netBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm font-semibold text-orange-600">
                                                    {poTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    <div className="text-[10px] text-slate-400 mt-0.5">{projectPOs.length} ใบสั่งซื้อ</div>
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm font-bold bg-blue-50/20">
                                                    <span className={isOver ? 'text-red-600' : 'text-blue-600'}>
                                                        {available.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col items-center">
                                                        <span className={`text-xs font-bold mb-1 ${isOver ? 'text-red-600' : 'text-slate-600'}`}>
                                                            {usedPercent.toFixed(1)}%
                                                        </span>
                                                        <div className="w-20 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                                            <div
                                                                className={`h-1.5 rounded-full ${isOver ? 'bg-red-500' : 'bg-blue-500'}`}
                                                                style={{ width: `${Math.min(usedPercent, 100)}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 text-center">
                                                    <button className="text-slate-400 group-hover:text-blue-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors">
                                                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* Sub-table for PO details */}
                                            {isExpanded && (
                                                <tr className="bg-slate-50/50">
                                                    <td colSpan={8} className="p-0 border-b-2 border-slate-200">
                                                        <div className="px-10 py-6">
                                                            <div className="flex items-center gap-2 mb-4">
                                                                <FileText className="text-slate-500" size={18} />
                                                                <h4 className="font-bold text-slate-700">รายการใบสั่งซื้อ (PO) ที่อนุมัติแล้ว</h4>
                                                            </div>
                                                            {projectPOs.length > 0 ? (
                                                                <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden line-clamp-none">
                                                                    <table className="min-w-full divide-y divide-slate-200">
                                                                        <thead className="bg-slate-100/50">
                                                                            <tr>
                                                                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">เลขที่ PO</th>
                                                                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">คู่ค้า / ร้านค้า</th>
                                                                                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">จำนวนเงินเบิกจ่าย</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-100">
                                                                            {projectPOs.map(po => (
                                                                                <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                                                                                    <td className="px-4 py-3 text-sm font-medium text-blue-600">
                                                                                        <a href={`/po/${po.id}`} target="_blank" rel="noreferrer" className="hover:underline">
                                                                                            {po.poNumber}
                                                                                        </a>
                                                                                    </td>
                                                                                    <td className="px-4 py-3 text-sm text-slate-700">{po.vendorName || "ไม่ระบุ"}</td>
                                                                                    <td className="px-4 py-3 text-sm font-semibold text-slate-800 text-right">
                                                                                        ฿ {po.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            ) : (
                                                                <div className="text-center py-6 bg-white border border-slate-200 rounded-lg text-slate-500 text-sm">
                                                                    ไม่มีรายการสั่งซื้อที่อนุมัติแล้วในโครงการนี้
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                        {/* Table Footer / Summary Row */}
                        <tfoot className="bg-slate-800 text-white">
                            <tr>
                                <td className="px-6 py-4 text-left text-sm font-bold">รวมทั้งหมด</td>
                                <td className="px-6 py-4 text-right text-sm font-bold">{totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td className="px-6 py-4 text-right text-sm font-bold">
                                    <span className={totalVO > 0 ? 'text-green-400' : totalVO < 0 ? 'text-red-400' : 'text-slate-400'}>
                                        {totalVO > 0 ? '+' : ''}{totalVO.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right text-sm font-bold">{totalNetBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td className="px-6 py-4 text-right text-sm font-bold text-orange-300">{totalPO.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td className="px-6 py-4 text-right text-sm font-bold text-blue-300">{totalAvailable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td className="px-6 py-4 text-center text-sm font-bold">
                                    <span className={overallUsedPercent > 100 ? 'text-red-400' : 'text-white'}>
                                        {overallUsedPercent.toFixed(1)}%
                                    </span>
                                </td>
                                <td className="px-3 py-4"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
