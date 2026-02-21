"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ProjectProvider } from "@/context/ProjectContext";
import Sidebar from "@/components/shared/Sidebar";
import Header from "@/components/shared/Header";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        // If auth state is loaded and no user, kick to login
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <Loader2 className="animate-spin w-10 h-10 text-blue-600 mb-4" />
                <p className="text-slate-500 font-medium">กำลังตรวจสอบสิทธิ์เข้าใช้งาน...</p>
            </div>
        );
    }

    if (!user) {
        // Return null while redirecting
        return null;
    }

    return (
        <ProjectProvider>
            <div className="flex h-screen overflow-hidden bg-slate-50 relative">

                {/* Left Sidebar Fixed */}
                <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

                {/* Main Content wrapper */}
                <div className="flex flex-col flex-1 overflow-hidden print:overflow-visible w-full">
                    {/* Top Header Fixed */}
                    <Header toggleSidebar={() => setIsSidebarOpen(true)} />

                    {/* Scrollable Main Area */}
                    <main className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 print:overflow-visible print:bg-white print:p-0 print:block">
                        <div className="max-w-7xl mx-auto w-full print:max-w-none print:w-full">
                            {children}
                        </div>
                    </main>
                </div>

            </div>
        </ProjectProvider>
    );
}
