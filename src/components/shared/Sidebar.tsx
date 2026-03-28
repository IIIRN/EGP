"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { clsx } from "clsx";
import {
    LayoutDashboard,
    Building2,
    ContactRound,
    Users,
    FileText,
    FileEdit,
    Settings,
    UserCog,
    ChevronDown,
    ChevronRight,
    X,
    User,
    LogOut,
    LineChart,
    Briefcase,
} from "lucide-react";

const mainNavigation = [
    { name: "หน้าหลัก", href: "/dashboard", icon: LayoutDashboard },
    { name: "รายงาน (Reports)", href: "/reports", icon: LineChart },
    { name: "โครงการ (Projects)", href: "/projects", icon: Building2 },
];

const documentNavigation = [
    { name: "ใบขอซื้อ/ขอจ้าง (PR)", href: "/pr", icon: FileText },
    { name: "ใบสั่งซื้อ (PO)", href: "/po", icon: FileText },
    { name: "ใบจ้างงาน (WC)", href: "/wc", icon: Briefcase },
    { name: "งานเพิ่ม-ลด (VO)", href: "/vo", icon: FileEdit },
];

const peopleAndPartnersNavigation = [
    { name: "ลูกค้า (Customers)", href: "/customers", icon: ContactRound },
    { name: "ลูกจ้าง (Contractors)", href: "/contractors", icon: User },
    { name: "คู่ค้า (Vendors)", href: "/vendors", icon: Users },
    { name: "พนักงาน (Users)", href: "/users", icon: UserCog },
];

const settingsNavigation = [
    { name: "ตั้งค่าระบบ", href: "/settings", icon: Settings },
];

interface SidebarProps {
    isOpen?: boolean;
    setIsOpen?: (isOpen: boolean) => void;
}

export default function Sidebar({ isOpen = false, setIsOpen }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { userProfile, signOut } = useAuth();
    const documentSubmenuActive = documentNavigation.some((item) => pathname.startsWith(item.href)) || pathname.startsWith("/price-comparisons");
    const [isDocumentSubmenuOpen, setIsDocumentSubmenuOpen] = useState<boolean>(false);
    const submenuActive = peopleAndPartnersNavigation.some((item) => pathname.startsWith(item.href));
    const [isSubmenuOpen, setIsSubmenuOpen] = useState<boolean>(false);

    const closeSidebar = () => {
        if (setIsOpen) setIsOpen(false);
    };

    const handleNavigate = () => {
        if (window.innerWidth < 1024) {
            closeSidebar();
        }
    };

    const handleSignOut = async () => {
        await signOut();
        router.push("/login");
    };

    const translatedRole = () => {
        switch (userProfile?.role) {
            case "admin":
                return "ผู้ดูแลระบบ";
            case "procurement":
                return "ฝ่ายจัดซื้อ";
            case "pm":
                return "ผู้จัดการโครงการ";
            case "engineer":
                return "วิศวกร";
            default:
                return "พนักงาน";
        }
    };

    const topLevelItemClass = (isActive: boolean) =>
        clsx(
            "group flex items-center px-3.5 py-3 text-sm font-medium rounded-2xl border transition-all duration-200",
            isActive
                ? "border-white/10 bg-gradient-to-r from-blue-500/24 via-blue-400/14 to-white/[0.03] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_30px_rgba(37,99,235,0.18)]"
                : "border-transparent text-slate-300/90 hover:border-white/6 hover:bg-white/[0.045] hover:text-white",
        );

    const topLevelIconClass = (isActive: boolean) =>
        clsx(
            "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
            isActive ? "text-blue-100" : "text-slate-400 group-hover:text-slate-200",
        );

    const submenuItemClass = (isActive: boolean) =>
        clsx(
            "group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl border transition-all duration-200",
            isActive
                ? "border-white/8 bg-white/[0.06] text-blue-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                : "border-transparent text-slate-300/85 hover:border-white/6 hover:bg-white/[0.04] hover:text-white",
        );

    const submenuIconClass = (isActive: boolean) =>
        clsx(
            "mr-3 h-4 w-4 flex-shrink-0 transition-colors",
            isActive ? "text-blue-200" : "text-slate-500 group-hover:text-slate-300",
        );

    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity lg:hidden"
                    onClick={closeSidebar}
                />
            )}

            <div
                className={clsx(
                    "fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden border-r border-white/8 bg-[linear-gradient(180deg,#0f172a_0%,#0b1328_38%,#0b1831_100%)] text-white shadow-[0_24px_80px_rgba(2,6,23,0.55)] transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 print:hidden",
                    isOpen ? "translate-x-0" : "-translate-x-full",
                )}
            >
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -left-16 top-0 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
                    <div className="absolute right-0 top-1/3 h-48 w-48 rounded-full bg-cyan-400/5 blur-3xl" />
                    <div className="absolute bottom-0 left-8 h-32 w-32 rounded-full bg-emerald-400/5 blur-3xl" />
                </div>

                <div className="relative flex h-16 items-center justify-between border-b border-white/8 bg-white/[0.025] px-6 backdrop-blur-sm">
                    <div className="flex items-center">
                        <span className="ml-3 text-lg font-bold tracking-[0.02em] text-white">
                            
                            <span className="text-emerald-400">PWT</span>{" "}<span className="text-slate-200">จัดซื้อ-จัดจ้าง</span>
                        </span>
                    </div>
                    <button
                        className="rounded-full p-1.5 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
                        onClick={closeSidebar}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="sidebar-scroll relative flex-1 overflow-y-auto py-6">
                    <nav className="space-y-1.5 px-3.5">
                        {mainNavigation.map((item) => {
                            const isActive = pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={topLevelItemClass(isActive)}
                                    onClick={handleNavigate}
                                >
                                    <item.icon className={topLevelIconClass(isActive)} aria-hidden="true" />
                                    {item.name}
                                </Link>
                            );
                        })}

                        <div className="pt-1">
                            <button
                                type="button"
                                onClick={() => setIsDocumentSubmenuOpen((prev) => !prev)}
                                className={clsx(topLevelItemClass(documentSubmenuActive), "w-full justify-between")}
                            >
                                <span className="flex items-center">
                                    <FileText className={topLevelIconClass(documentSubmenuActive)} />
                                    การสร้างเอกสาร
                                </span>
                                {isDocumentSubmenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>

                            {isDocumentSubmenuOpen && (
                                <div className="mt-2 ml-5 space-y-1.5 border-l border-white/8 pl-3">
                                    {documentNavigation.map((item) => {
                                        const isActive = pathname.startsWith(item.href);
                                        return (
                                            <Link
                                                key={item.name}
                                                href={item.href}
                                                className={submenuItemClass(isActive)}
                                                onClick={handleNavigate}
                                            >
                                                <item.icon className={submenuIconClass(isActive)} aria-hidden="true" />
                                                {item.name}
                                            </Link>
                                        );
                                    })}
                                    <Link
                                        href="/price-comparisons"
                                        className={submenuItemClass(pathname.startsWith("/price-comparisons"))}
                                        onClick={handleNavigate}
                                    >
                                        <FileEdit className={submenuIconClass(pathname.startsWith("/price-comparisons"))} aria-hidden="true" />
                                        เอกสารเทียบราคา (PC)
                                    </Link>
                                </div>
                            )}
                        </div>

                        <div className="pt-1">
                            <button
                                type="button"
                                onClick={() => setIsSubmenuOpen((prev) => !prev)}
                                className={clsx(topLevelItemClass(submenuActive), "w-full justify-between")}
                            >
                                <span className="flex items-center">
                                    <Users className={topLevelIconClass(submenuActive)} />
                                    บุคคลและคู่ค้า
                                </span>
                                {isSubmenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>

                            {isSubmenuOpen && (
                                <div className="mt-2 ml-5 space-y-1.5 border-l border-white/8 pl-3">
                                    {peopleAndPartnersNavigation.map((item) => {
                                        const isActive = pathname.startsWith(item.href);
                                        return (
                                            <Link
                                                key={item.name}
                                                href={item.href}
                                                className={submenuItemClass(isActive)}
                                                onClick={handleNavigate}
                                            >
                                                <item.icon className={submenuIconClass(isActive)} aria-hidden="true" />
                                                {item.name}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {settingsNavigation.map((item) => {
                            const isActive = pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={topLevelItemClass(isActive)}
                                    onClick={handleNavigate}
                                >
                                    <item.icon className={topLevelIconClass(isActive)} aria-hidden="true" />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="relative mt-auto border-t border-white/8 bg-white/[0.03] p-4 backdrop-blur-sm">
                    <div className="flex items-center space-x-3 rounded-2xl border border-white/6 bg-white/[0.035] px-3 py-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.05] text-slate-300">
                            <User size={20} />
                        </div>
                        <div className="flex flex-1 flex-col overflow-hidden">
                            <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold text-slate-100">
                                    {userProfile?.displayName || userProfile?.email || "พนักงาน"}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleSignOut}
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-all duration-200 hover:bg-rose-400/10 hover:text-rose-200"
                                    title="ออกจากระบบ"
                                    aria-label="ออกจากระบบ"
                                >
                                    <LogOut size={15} />
                                </button>
                            </div>
                            <span className="truncate text-xs capitalize text-slate-400">
                                สิทธิ์: {translatedRole()}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <style jsx global>{`
                .sidebar-scroll {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(148, 163, 184, 0.45) rgba(255, 255, 255, 0.04);
                    scrollbar-gutter: stable;
                }

                .sidebar-scroll::-webkit-scrollbar {
                    width: 12px;
                }

                .sidebar-scroll::-webkit-scrollbar-track {
                    background: rgba(15, 23, 42, 0.35);
                    border-radius: 999px;
                    margin: 10px 0;
                    border: 1px solid rgba(255, 255, 255, 0.04);
                }

                .sidebar-scroll::-webkit-scrollbar-thumb {
                    background: linear-gradient(180deg, rgba(148, 163, 184, 0.75), rgba(100, 116, 139, 0.88));
                    border-radius: 999px;
                    border: 2px solid rgba(15, 23, 42, 0.72);
                    min-height: 48px;
                }

                .sidebar-scroll::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(180deg, rgba(191, 219, 254, 0.9), rgba(96, 165, 250, 0.85));
                }

                .sidebar-scroll::-webkit-scrollbar-corner {
                    background: transparent;
                }
            `}</style>
        </>
    );
}
