"use client";

import ProjectSelector from "./ProjectSelector";
import { Menu } from "lucide-react";

interface HeaderProps {
    toggleSidebar?: () => void;
}

export default function Header({ toggleSidebar }: HeaderProps) {
    return (
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shadow-sm z-10 print:hidden relative">

            {/* Left section: Hamburger & Project Selection */}
            <div className="flex items-center space-x-3">
                <button
                    onClick={toggleSidebar}
                    className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg lg:hidden"
                    title="เปิด/ปิด เมนู"
                >
                    <Menu size={24} />
                </button>
                <ProjectSelector />
            </div>

            {/* Right section: Removed Profile & Actions to Sidebar */}
            <div></div>

        </header>
    );
}
