"use client";

import { useProject } from "@/context/ProjectContext";
import { Building2, Users, FileText, Activity, Wallet, AlertCircle, Briefcase } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PurchaseOrder } from "@/types/po";
import { WorkContract } from "@/types/wc";

const formatCurrency = (amount: number) =>
    `฿ ${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const getCreatedAtMillis = (value: unknown) => {
    if (!value) return 0;

    try {
        if (typeof value === "object" && value) {
            const timestamp = value as {
                toDate?: () => Date;
                toMillis?: () => number;
                seconds?: number;
                nanoseconds?: number;
            };

            if (typeof timestamp.toMillis === "function") {
                const millis = timestamp.toMillis();
                return Number.isFinite(millis) ? millis : 0;
            }

            if (typeof timestamp.toDate === "function") {
                const date = timestamp.toDate();
                return Number.isNaN(date.getTime()) ? 0 : date.getTime();
            }

            if (typeof timestamp.seconds === "number") {
                return timestamp.seconds * 1000 + Math.floor((timestamp.nanoseconds ?? 0) / 1_000_000);
            }
        }

        if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? 0 : date.getTime();
        }
    } catch {
        return 0;
    }

    return 0;
};

const getStatusMeta = (status?: string) => {
    if (status === "approved") return { label: "อนุมัติแล้ว", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
    if (status === "rejected") return { label: "ไม่อนุมัติ", className: "bg-rose-50 text-rose-700 border border-rose-200" };
    if (status === "pending") return { label: "รออนุมัติ", className: "bg-amber-50 text-amber-700 border border-amber-200" };
    return { label: "ฉบับร่าง", className: "bg-slate-100 text-slate-700 border border-slate-200" };
};

const INITIAL_STATS = {
    pendingPR: 0,
    totalPR: 0,
    pendingPC: 0,
    totalPC: 0,
    pendingPO: 0,
    totalPO: 0,
    approvedPOTotal: 0,
    pendingWC: 0,
    totalWC: 0,
    approvedWCTotal: 0,
    pendingVO: 0,
    totalVO: 0,
    approvedVOTotal: 0,
    totalVendors: 0,
};

export default function MainDashboard() {
    const { currentProject } = useProject();
    const { userProfile } = useAuth();

    const [stats, setStats] = useState(INITIAL_STATS);

    const [recentPOs, setRecentPOs] = useState<PurchaseOrder[]>([]);
    const [recentWCs, setRecentWCs] = useState<WorkContract[]>([]);

    useEffect(() => {
        if (!currentProject) {
            setStats(INITIAL_STATS);
            setRecentPOs([]);
            setRecentWCs([]);
            return;
        }

        const prQuery = query(
            collection(db, "purchase_requisitions"),
            where("projectId", "==", currentProject.id)
        );
        const unSubPR = onSnapshot(prQuery, (snapshot) => {
            let pendingCount = 0;

            snapshot.forEach((doc) => {
                const pr = doc.data();
                if (pr.status === "pending_need_approval") pendingCount++;
            });

            setStats(prev => ({ ...prev, pendingPR: pendingCount, totalPR: snapshot.size }));
        });

        const pcQuery = query(
            collection(db, "pr_price_comparisons"),
            where("projectId", "==", currentProject.id)
        );
        const unSubPC = onSnapshot(pcQuery, (snapshot) => {
            let pendingCount = 0;

            snapshot.forEach((doc) => {
                const pc = doc.data();
                if (pc.status === "pending_approval") pendingCount++;
            });

            setStats(prev => ({ ...prev, pendingPC: pendingCount, totalPC: snapshot.size }));
        });

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
                const dateA = getCreatedAtMillis(a.createdAt);
                const dateB = getCreatedAtMillis(b.createdAt);
                return dateB - dateA;
            });
            setRecentPOs(poList.slice(0, 5));

            setStats(prev => ({ ...prev, pendingPO: pendingCount, totalPO: snapshot.size, approvedPOTotal: approvedSum }));
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
                const dateA = getCreatedAtMillis(a.createdAt);
                const dateB = getCreatedAtMillis(b.createdAt);
                return dateB - dateA;
            });
            setRecentWCs(wcList.slice(0, 5));

            setStats(prev => ({ ...prev, pendingWC: pendingCount, totalWC: snapshot.size, approvedWCTotal: approvedSum }));
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

            setStats(prev => ({ ...prev, pendingVO: pendingCount, totalVO: snapshot.size, approvedVOTotal: approvedSum }));
        });

        // Fetch Total Vendors (Not project specific, total in system so they can be available)
        const vendorQuery = query(collection(db, "vendors"), where("isActive", "==", true));
        const unSubVendors = onSnapshot(vendorQuery, (snapshot) => {
            setStats(prev => ({ ...prev, totalVendors: snapshot.size }));
        });

        return () => {
            unSubPR();
            unSubPC();
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
    const pendingApprovals = stats.pendingPR + stats.pendingPC + stats.pendingPO + stats.pendingWC + stats.pendingVO;

    return (
        <div className="space-y-6 rounded-3xl bg-gradient-to-br from-slate-50 via-white to-blue-50/40 p-1.5">

            <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-r from-white via-slate-50 to-blue-50/60 p-6 shadow-sm md:p-8">
                <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-100/60 blur-3xl" />
                <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Project Control Center</p>
                        <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">สรุปภาพรวมงานจัดซื้อและบริหารสัญญา</h1>
                        <p className="text-sm text-slate-600">
                            ยินดีต้อนรับ {userProfile?.displayName || userProfile?.email || "ผู้ใช้งาน"} ติดตามสถานะเอกสารและงบประมาณของโครงการในมุมมองเดียว
                        </p>
                        <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                            <Building2 size={16} className="text-blue-600" />
                            <span className="font-medium">{currentProject ? currentProject.name : "ยังไม่ได้เลือกโครงการ"}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Pending Approvals</p>
                            <p className="mt-2 text-2xl font-semibold text-slate-900">{pendingApprovals}</p>
                            <p className="mt-1 text-xs text-slate-500">PR, PC, PO, WC และ VO ที่รออนุมัติ</p>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Approved Commitments</p>
                            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totalUsed)}</p>
                            <p className="mt-1 text-xs text-slate-500">มูลค่าอนุมัติ PO + WC</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Financial Overview Card */}
            {currentProject && (
                <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/50 p-6 shadow-sm">
                    <div className="mb-6 flex items-center justify-between">
                        <h3 className="flex items-center text-lg font-semibold text-slate-900">
                            <Wallet className="mr-2 text-blue-600" size={20} />
                            Budget Overview
                        </h3>
                        {isOverBudget && (
                            <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                <AlertCircle size={14} className="mr-1" />
                                งบประมาณเกินแผน
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Initial Budget</p>
                            <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(initialBudget)}</p>
                        </div>
                        <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">VO Impact</p>
                            <p className={`mt-2 text-xl font-semibold ${stats.approvedVOTotal > 0 ? "text-emerald-700" : stats.approvedVOTotal < 0 ? "text-rose-700" : "text-slate-900"}`}>
                                {stats.approvedVOTotal > 0 ? "+" : ""}
                                {formatCurrency(stats.approvedVOTotal)}
                            </p>
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Committed</p>
                            <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(totalUsed)}</p>
                            <p className="mt-1 text-xs text-slate-500">PO {formatCurrency(stats.approvedPOTotal)} | WC {formatCurrency(stats.approvedWCTotal)}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-300">Available Budget</p>
                            <p className="mt-2 text-2xl font-semibold">{formatCurrency(availableBudget)}</p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                        <div className="mb-2 flex justify-between text-sm">
                            <span className="font-medium text-slate-700">ใช้งบประมาณแล้ว {usedPercentage.toFixed(1)}%</span>
                            <span className={`font-semibold ${isOverBudget ? "text-rose-700" : "text-slate-700"}`}>{formatCurrency(netBudget)} วงเงินรวม</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                                className={`h-2.5 rounded-full transition-all duration-500 ${isOverBudget ? "bg-rose-500" : "bg-blue-600"}`}
                                style={{ width: `${Math.min(usedPercentage, 100)}%` }}
                            />
                        </div>
                    </div>
                </section>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                <div className="rounded-xl border border-indigo-200 bg-gradient-to-b from-white to-indigo-50/40 p-5 shadow-sm">
                    <div className="mb-4 inline-flex rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-indigo-700">
                        <FileText size={18} />
                    </div>
                    <p className="text-sm text-slate-500">PR รออนุมัติ</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.pendingPR}</p>
                    <p className="mt-1 text-xs text-slate-500">ทั้งหมด {stats.totalPR} เอกสาร</p>
                </div>

                <div className="rounded-xl border border-sky-200 bg-gradient-to-b from-white to-sky-50/40 p-5 shadow-sm">
                    <div className="mb-4 inline-flex rounded-lg border border-sky-200 bg-sky-50 p-2 text-sky-700">
                        <FileText size={18} />
                    </div>
                    <p className="text-sm text-slate-500">PC รออนุมัติ</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.pendingPC}</p>
                    <p className="mt-1 text-xs text-slate-500">ทั้งหมด {stats.totalPC} เอกสาร</p>
                </div>

                <div className="rounded-xl border border-blue-200 bg-gradient-to-b from-white to-blue-50/40 p-5 shadow-sm">
                    <div className="mb-4 inline-flex rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-700">
                        <FileText size={18} />
                    </div>
                    <p className="text-sm text-slate-500">PO รออนุมัติ</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.pendingPO}</p>
                    <p className="mt-1 text-xs text-slate-500">ทั้งหมด {stats.totalPO} เอกสาร</p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-gradient-to-b from-white to-emerald-50/40 p-5 shadow-sm">
                    <div className="mb-4 inline-flex rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-700">
                        <Briefcase size={18} />
                    </div>
                    <p className="text-sm text-slate-500">WC รออนุมัติ</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.pendingWC}</p>
                    <p className="mt-1 text-xs text-slate-500">ทั้งหมด {stats.totalWC} เอกสาร</p>
                </div>

                <div className="rounded-xl border border-amber-200 bg-gradient-to-b from-white to-amber-50/40 p-5 shadow-sm">
                    <div className="mb-4 inline-flex rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-700">
                        <Activity size={18} />
                    </div>
                    <p className="text-sm text-slate-500">VO รออนุมัติ</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.pendingVO}</p>
                    <p className="mt-1 text-xs text-slate-500">ทั้งหมด {stats.totalVO} เอกสาร</p>
                </div>

                <div className="rounded-xl border border-violet-200 bg-gradient-to-b from-white to-violet-50/40 p-5 shadow-sm">
                    <div className="mb-4 inline-flex rounded-lg border border-violet-200 bg-violet-50 p-2 text-violet-700">
                        <Users size={18} />
                    </div>
                    <p className="text-sm text-slate-500">คู่ค้าใช้งานอยู่</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.totalVendors}</p>
                </div>
            </div>

            {/* Main Grid area */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                <div className="space-y-6 xl:col-span-8">
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-blue-100 bg-gradient-to-r from-blue-50/60 to-transparent px-6 py-4">
                            <h3 className="text-base font-semibold text-slate-900">Purchase Orders ล่าสุด</h3>
                            <Link href="/po" className="text-sm font-medium text-blue-700 hover:text-blue-900">ดูทั้งหมด</Link>
                        </div>
                        {recentPOs.length === 0 ? (
                            <div className="px-6 py-12 text-center text-slate-500">
                                <FileText className="mx-auto mb-3 h-9 w-9 text-slate-300" />
                                <p className="text-sm">ไม่พบรายการใบสั่งซื้อล่าสุด</p>
                                <Link href="/po/create" className="mt-2 inline-block text-sm font-medium text-slate-700 hover:underline">
                                    สร้างใบสั่งซื้อใหม่
                                </Link>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {recentPOs.map((po) => {
                                    const statusMeta = getStatusMeta(po.status);
                                    return (
                                        <div key={po.id} className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-blue-50/40">
                                            <div className="min-w-0">
                                                <p className="font-medium text-slate-900">{po.poNumber}</p>
                                                <p className="truncate text-sm text-slate-500">{po.vendorName || "-"}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-slate-900">{formatCurrency(po.totalAmount || 0)}</p>
                                                <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}>
                                                    {statusMeta.label}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-emerald-100 bg-gradient-to-r from-emerald-50/60 to-transparent px-6 py-4">
                            <h3 className="text-base font-semibold text-slate-900">Work Contracts ล่าสุด</h3>
                            <Link href="/wc" className="text-sm font-medium text-emerald-700 hover:text-emerald-900">ดูทั้งหมด</Link>
                        </div>
                        {recentWCs.length === 0 ? (
                            <div className="px-6 py-12 text-center text-slate-500">
                                <Briefcase className="mx-auto mb-3 h-9 w-9 text-slate-300" />
                                <p className="text-sm">ไม่พบรายการใบจ้างงานล่าสุด</p>
                                <Link href="/wc/create" className="mt-2 inline-block text-sm font-medium text-slate-700 hover:underline">
                                    สร้างใบจ้างงานใหม่
                                </Link>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {recentWCs.map((wc) => {
                                    const statusMeta = getStatusMeta(wc.status);
                                    return (
                                        <div key={wc.id} className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-emerald-50/40">
                                            <div className="min-w-0">
                                                <p className="font-medium text-slate-900">{wc.wcNumber}</p>
                                                <p className="truncate text-sm text-slate-500">{wc.vendorName || "-"}{wc.title ? ` • ${wc.title}` : ""}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-slate-900">{formatCurrency(wc.totalAmount || 0)}</p>
                                                <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}>
                                                    {statusMeta.label}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <aside className="xl:col-span-4">
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50/60 to-transparent px-6 py-4">
                            <h3 className="text-base font-semibold text-slate-900">เมนูด่วน</h3>
                        </div>
                        <div className="space-y-3 p-4">
                            <Link href="/pr/create" className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50/40 px-4 py-3 text-sm font-medium text-indigo-900 transition-colors hover:bg-indigo-50">
                                <FileText size={16} className="text-indigo-600" />
                                สร้างใบขอซื้อ/ขอจ้าง (PR)
                            </Link>
                            <Link href="/price-comparisons" className="flex items-center gap-3 rounded-lg border border-sky-200 bg-sky-50/40 px-4 py-3 text-sm font-medium text-sky-900 transition-colors hover:bg-sky-50">
                                <FileText size={16} className="text-sky-600" />
                                เอกสารเทียบราคา (PC)
                            </Link>
                            <Link href="/po/create" className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/40 px-4 py-3 text-sm font-medium text-blue-900 transition-colors hover:bg-blue-50">
                                <FileText size={16} className="text-blue-600" />
                                สร้างใบสั่งซื้อ (PO)
                            </Link>
                            <Link href="/wc/create" className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/40 px-4 py-3 text-sm font-medium text-emerald-900 transition-colors hover:bg-emerald-50">
                                <Briefcase size={16} className="text-emerald-600" />
                                สร้างใบจ้างงาน (WC)
                            </Link>
                            <Link href="/vo/create" className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/40 px-4 py-3 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-50">
                                <Activity size={16} className="text-amber-600" />
                                สร้างงานเพิ่ม-ลด (VO)
                            </Link>
                            <Link href="/vendors/create" className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50/40 px-4 py-3 text-sm font-medium text-violet-900 transition-colors hover:bg-violet-50">
                                <Users size={16} className="text-violet-600" />
                                เพิ่มรายชื่อคู่ค้า
                            </Link>
                        </div>
                    </div>
                </aside>
            </div>

        </div>
    );
}
