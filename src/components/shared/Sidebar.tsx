"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { clsx } from "clsx";
import {
    LayoutDashboard,
    Building2,
    Users,
    FileText,
    FileEdit,
    Settings,
    UserCog,
    X,
    User,
    LogOut,
    LineChart,
    Briefcase
} from "lucide-react";

const navigation = [
    { name: "หน้าหลัก", href: "/dashboard", icon: LayoutDashboard },
    { name: "รายงาน (Reports)", href: "/reports", icon: LineChart },
    { name: "โครงการ (Projects)", href: "/projects", icon: Building2 },
    { name: "ใบสั่งซื้อ (PO)", href: "/po", icon: FileText },
    { name: "ใบจ้างงาน (WC)", href: "/wc", icon: Briefcase },
    { name: "งานเพิ่ม-ลด (VO)", href: "/vo", icon: FileEdit },
    { name: "คู่ค้า (Vendors)", href: "/vendors", icon: Users },
    { name: "พนักงาน (Users)", href: "/users", icon: UserCog },
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

    const closeSidebar = () => {
        if (setIsOpen) setIsOpen(false);
    };

    const handleSignOut = async () => {
        await signOut();
        router.push("/login");
    };

    const translatedRole = () => {
        switch (userProfile?.role) {
            case "admin": return "ผู้ดูแลระบบ";
            case "procurement": return "ฝ่ายจัดซื้อ";
            case "pm": return "ผู้จัดการโครงการ";
            case "engineer": return "วิศวกร";
            default: return "พนักงาน";
        }
    }

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar Content */}
            <div className={clsx(
                "fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-slate-900 border-r border-slate-800 text-white shadow-xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 print:hidden",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Logo Area */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
                    <div className="flex items-center">
                        <span className="ml-3 text-lg font-bold tracking-wider text-slate-100">EGP<span className="text-blue-500">Powertec</span></span>
                    </div>
                    {/* Close button for mobile */}
                    <button
                        className="lg:hidden text-slate-400 hover:text-white p-1"
                        onClick={closeSidebar}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto py-6">
                    <nav className="px-3 space-y-1">
                        {navigation.map((item) => {
                            const isActive = pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={clsx(
                                        "group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors",
                                        isActive
                                            ? "bg-blue-600 text-white shadow-sm"
                                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                    )}
                                    onClick={() => {
                                        // Auto close sidebar on mobile when navigating
                                        if (window.innerWidth < 1024) {
                                            closeSidebar();
                                        }
                                    }}
                                >
                                    <item.icon
                                        className={clsx(
                                            "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                                            isActive ? "text-white" : "text-slate-400 group-hover:text-slate-300"
                                        )}
                                        aria-hidden="true"
                                    />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Footer Area inside sidebar */}
                <div className="p-4 border-t border-slate-800 mt-auto space-y-3">
                    <div className="flex items-center space-x-3 px-2">
                        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-300 shrink-0">
                            <User size={20} />
                        </div>
                        <div className="flex flex-col flex-1 overflow-hidden">
                            <span className="text-sm font-semibold text-slate-200 truncate">
                                {userProfile?.displayName || userProfile?.email || "พนักงาน"}
                            </span>
                            <span className="text-xs text-slate-500 capitalize truncate">
                                สิทธิ์: {translatedRole()}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="flex w-full items-center px-3 py-2.5 text-slate-400 hover:text-red-400 hover:bg-slate-800/50 rounded-lg transition-colors text-sm font-medium"
                    >
                        <LogOut size={18} className="mr-3" />
                        ออกจากระบบ
                    </button>
                </div>
            </div>
        </>
    );
}
