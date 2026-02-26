"use client";

import { useProject } from "@/context/ProjectContext";
import { Building2, TrendingUp, Users, FileText, Activity, Wallet, AlertCircle, Briefcase } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PurchaseOrder } from "@/types/po";
import { VariationOrder } from "@/types/vo";
import { WorkContract } from "@/types/wc";

export default function MainDashboard() {
    const { currentProject } = useProject();
    const { userProfile } = useAuth();

    const [stats, setStats] = useState({
        pendingPO: 0,
        approvedPOTotal: 0,
        pendingWC: 0,
        approvedWCTotal: 0,
        pendingVO: 0,
        approvedVOTotal: 0,
        totalVendors: 0
    });

    const [recentPOs, setRecentPOs] = useState<PurchaseOrder[]>([]);
    const [recentWCs, setRecentWCs] = useState<WorkContract[]>([]);

    useEffect(() => {
        if (!currentProject) return;

        // Fetch POs
        const poQuery = query(
            collection(db, "purchase_orders"),
            where("projectId", "==", currentProject.id)
        );
        const unSubPO = onSnapshot(poQuery, (snapshot) => {
            let pendingCount = 0;
            let approvedSum = 0;
            const poList: PurchaseOrder[] = [];

            snapshot.forEach((doc) => {
                const po = { id: doc.id, ...doc.data() } as PurchaseOrder;
                poList.push(po);
                if (po.status === "pending") pendingCount++;
                if (po.status === "approved") {
                    approvedSum += (po.totalAmount || 0);
                }
            });

            // Sort PO list client-side to show recent ones
            poList.sort((a, b) => {
                const dateA = a.createdAt ? new Date((a.createdAt as any).toDate()).getTime() : 0;
                const dateB = b.createdAt ? new Date((b.createdAt as any).toDate()).getTime() : 0;
                return dateB - dateA;
            });
            setRecentPOs(poList.slice(0, 5));

            setStats(prev => ({ ...prev, pendingPO: pendingCount, approvedPOTotal: approvedSum }));
        });

        // Fetch WCs
        const wcQuery = query(
            collection(db, "work_contracts"),
            where("projectId", "==", currentProject.id)
        );
        const unSubWC = onSnapshot(wcQuery, (snapshot) => {
            let pendingCount = 0;
            let approvedSum = 0;
            const wcList: WorkContract[] = [];

            snapshot.forEach((doc) => {
                const wc = { id: doc.id, ...doc.data() } as WorkContract;
                wcList.push(wc);
                if (wc.status === "pending") pendingCount++;
                if (wc.status === "approved") {
                    approvedSum += (wc.totalAmount || 0);
                }
            });

            wcList.sort((a, b) => {
                const dateA = a.createdAt ? new Date((a.createdAt as any).toDate()).getTime() : 0;
                const dateB = b.createdAt ? new Date((b.createdAt as any).toDate()).getTime() : 0;
                return dateB - dateA;
            });
            setRecentWCs(wcList.slice(0, 5));

            setStats(prev => ({ ...prev, pendingWC: pendingCount, approvedWCTotal: approvedSum }));
        });

        // Fetch VOs
        const voQuery = query(
            collection(db, "variation_orders"),
            where("projectId", "==", currentProject.id)
        );
        const unSubVO = onSnapshot(voQuery, (snapshot) => {
            let pendingCount = 0;
            let approvedSum = 0;

            snapshot.forEach((doc) => {
                const vo = doc.data();
                if (vo.status === "pending") pendingCount++;
                if (vo.status === "approved") {
                    approvedSum += (vo.totalAmount || 0);
                }
            });

            setStats(prev => ({ ...prev, pendingVO: pendingCount, approvedVOTotal: approvedSum }));
        });

        // Fetch Total Vendors (Not project specific, total in system so they can be available)
        const vendorQuery = query(collection(db, "vendors"), where("isActive", "==", true));
        const unSubVendors = onSnapshot(vendorQuery, (snapshot) => {
            setStats(prev => ({ ...prev, totalVendors: snapshot.size }));
        });

        return () => {
            unSubPO();
            unSubWC();
            unSubVO();
            unSubVendors();
        };
    }, [currentProject]);

    // Financial Calculations
    const initialBudget = currentProject?.budget || 0;
    const netBudget = initialBudget + stats.approvedVOTotal; // VO Impact adjusts the budget capacity
    const totalUsed = stats.approvedPOTotal + stats.approvedWCTotal; // PO + WC combined
    const availableBudget = netBudget - totalUsed;

    // Percentages
    const usedPercentage = netBudget > 0 ? (totalUsed / netBudget) * 100 : 0;
    const isOverBudget = usedPercentage > 100;

    return (
        <div className="space-y-6">

            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div className="mb-6 md:mb-0">
                        <h1 className="text-3xl font-bold mb-2">ยินดีต้อนรับกลับมา, {userProfile?.displayName || userProfile?.email || "ผู้ใช้งาน"}!</h1>
                        <p className="text-blue-100 max-w-xl">
                            โครงการ: {" "}
                            <span className="font-semibold text-white bg-blue-500/30 px-3 py-1 rounded-full ml-1">
                                {currentProject ? currentProject.name : "ยังไม่ได้เลือกโครงการ"}
                            </span>
                        </p>
                    </div>
                </div>
                <Building2 className="absolute -bottom-6 -right-6 w-48 h-48 text-white opacity-10" />
            </div>

            {/* Financial Overview Card */}
            {currentProject && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center">
                            <Wallet className="mr-2 text-blue-600" size={24} /> สรุปงบประมาณโครงการ (Budget Tracking)
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-1">
                            <p className="text-sm text-slate-500">งบประมาณตั้งต้น (Initial)</p>
                            <p className="text-xl font-semibold text-slate-800">฿ {initialBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="space-y-1 border-l border-slate-200 pl-6">
                            <p className="text-sm text-slate-500">งานเพิ่ม-ลด (VO Impact)</p>
                            <p className={`text-xl font-semibold ${stats.approvedVOTotal > 0 ? 'text-green-600' : stats.approvedVOTotal < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                                {stats.approvedVOTotal > 0 ? '+' : ''}฿ {stats.approvedVOTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="space-y-1 border-l border-slate-200 pl-6">
                            <p className="text-sm text-slate-500">สั่งซื้อ+จ้างงาน (PO+WC)</p>
                            <p className="text-xl font-semibold text-orange-600">฿ {totalUsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            <p className="text-xs text-slate-400 mt-0.5">PO ฿{stats.approvedPOTotal.toLocaleString()} | WC ฿{stats.approvedWCTotal.toLocaleString()}</p>
                        </div>
                        <div className="space-y-1 border-l border-slate-200 pl-6 bg-slate-50 p-3 rounded-lg -m-3">
                            <p className="text-sm font-medium text-slate-700">งบประมาณคงเหลือ (Available)</p>
                            <p className={`text-2xl font-bold ${isOverBudget ? 'text-red-600' : 'text-blue-600'}`}>
                                ฿ {availableBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-8">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="font-semibold text-slate-700">การใช้อยู่ที่ {usedPercentage.toFixed(1)}% ของงบรวม</span>
                            {isOverBudget && <span className="font-bold text-red-600 flex items-center"><AlertCircle size={16} className="mr-1" /> งบบานปลาย</span>}
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3">
                            <div
                                className={`bg-blue-600 h-3 rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-blue-500'} transition-all duration-500`}
                                style={{ width: `${Math.min(usedPercentage, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center space-x-4">
                    <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
                        <FileText size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">PO รออนุมัติ</p>
                        <h3 className="text-2xl font-bold text-slate-900">{stats.pendingPO} <span className="text-sm font-normal text-slate-500">รายการ</span></h3>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center space-x-4">
                    <div className="bg-emerald-100 p-3 rounded-lg text-emerald-600">
                        <Briefcase size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">WC รออนุมัติ</p>
                        <h3 className="text-2xl font-bold text-slate-900">{stats.pendingWC} <span className="text-sm font-normal text-slate-500">รายการ</span></h3>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center space-x-4">
                    <div className="bg-purple-100 p-3 rounded-lg text-purple-600">
                        <Activity size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">VO รออนุมัติ</p>
                        <h3 className="text-2xl font-bold text-slate-900">{stats.pendingVO} <span className="text-sm font-normal text-slate-500">รายการ</span></h3>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center space-x-4">
                    <div className="bg-green-100 p-3 rounded-lg text-green-600">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">คู่ค้าทั้งหมด</p>
                        <h3 className="text-2xl font-bold text-slate-900">{stats.totalVendors} <span className="text-sm font-normal text-slate-500">บริษัท</span></h3>
                    </div>
                </div>

            </div>

            {/* Main Grid area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Recent POs */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
                    <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-800">ใบสั่งซื้อ (PO) ล่าสุด</h3>
                        <Link href="/po" className="text-sm text-blue-600 font-medium hover:text-blue-800">ดูทั้งหมด</Link>
                    </div>
                    <div className="p-0">
                        {recentPOs.length === 0 ? (
                            <div className="w-full text-center py-12 text-slate-500">
                                <FileText className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                                <p>ไม่พบรายการใบสั่งซื้อล่าสุด</p>
                                <Link href="/po/create" className="text-sm text-blue-600 font-medium mt-2 block hover:underline">
                                    สร้างใบสั่งซื้อใหม่
                                </Link>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {recentPOs.map(po => (
                                    <div key={po.id} className="p-4 hover:bg-slate-50 flex items-center justify-between transition-colors">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                                <FileText size={20} />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900">{po.poNumber}</p>
                                                <p className="text-sm text-slate-500">{po.vendorName}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-slate-800">฿ {po.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${po.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                po.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                    po.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-slate-100 text-slate-700'
                                                }`}>
                                                {po.status === 'approved' ? 'อนุมัติแล้ว' :
                                                    po.status === 'rejected' ? 'ไม่อนุมัติ' :
                                                        po.status === 'pending' ? 'รออนุมัติ' : 'ฉบับร่าง'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Shortcuts */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div className="p-6 border-b border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800">เมนูด่วน</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <Link href="/po/create" className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-200 transition-colors group">
                            <div className="flex items-center space-x-3">
                                <div className="bg-white p-2 border border-slate-200 rounded text-blue-600 group-hover:text-blue-700">
                                    <FileText size={20} />
                                </div>
                                <span className="font-medium text-slate-700 group-hover:text-blue-800">สร้างใบสั่งซื้อ (PO)</span>
                            </div>
                        </Link>

                        <Link href="/wc/create" className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 transition-colors group">
                            <div className="flex items-center space-x-3">
                                <div className="bg-white p-2 border border-slate-200 rounded text-emerald-600 group-hover:text-emerald-700">
                                    <Briefcase size={20} />
                                </div>
                                <span className="font-medium text-slate-700 group-hover:text-emerald-800">สร้างใบจ้างงาน (WC)</span>
                            </div>
                        </Link>

                        <Link href="/vo/create" className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-orange-50 hover:border-orange-200 transition-colors group">
                            <div className="flex items-center space-x-3">
                                <div className="bg-white p-2 border border-slate-200 rounded text-orange-600">
                                    <Activity size={20} />
                                </div>
                                <span className="font-medium text-slate-700 group-hover:text-orange-800">สร้างงานเพิ่ม-ลด (VO)</span>
                            </div>
                        </Link>

                        <Link href="/vendors/create" className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-green-50 hover:border-green-200 transition-colors group">
                            <div className="flex items-center space-x-3">
                                <div className="bg-white p-2 border border-slate-200 rounded text-green-600">
                                    <Users size={20} />
                                </div>
                                <span className="font-medium text-slate-700 group-hover:text-green-800">เพิ่มรายชื่อคู่ค้าใหม่</span>
                            </div>
                        </Link>
                    </div>
                </div>

                {/* Recent WCs - Full width */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm lg:col-span-3">
                    <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-800">ใบจ้างงาน (WC) ล่าสุด</h3>
                        <Link href="/wc" className="text-sm text-emerald-600 font-medium hover:text-emerald-800">ดูทั้งหมด</Link>
                    </div>
                    <div className="p-0">
                        {recentWCs.length === 0 ? (
                            <div className="w-full text-center py-12 text-slate-500">
                                <Briefcase className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                                <p>ไม่พบรายการใบจ้างงานล่าสุด</p>
                                <Link href="/wc/create" className="text-sm text-emerald-600 font-medium mt-2 block hover:underline">
                                    สร้างใบจ้างงานใหม่
                                </Link>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {recentWCs.map(wc => (
                                    <div key={wc.id} className="p-4 hover:bg-slate-50 flex items-center justify-between transition-colors">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                                                <Briefcase size={20} />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900">{wc.wcNumber}</p>
                                                <p className="text-sm text-slate-500">{wc.vendorName}{wc.title ? ` • ${wc.title}` : ''}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-slate-800">฿ {wc.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${wc.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                wc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                    wc.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-slate-100 text-slate-700'
                                                }`}>
                                                {wc.status === 'approved' ? 'อนุมัติแล้ว' :
                                                    wc.status === 'rejected' ? 'ไม่อนุมัติ' :
                                                        wc.status === 'pending' ? 'รออนุมัติ' : 'ฉบับร่าง'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
}
