import "@/app/globals.css";
import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { ProjectProvider } from "@/context/ProjectContext";

const font = Noto_Sans_Thai({ subsets: ["latin", "thai"] });

export const metadata: Metadata = {
    title: "EGP - โหมดมือถือ / LINE LIFF",
    description: "แอปพลิเคชันสำหรับใช้งานผ่านมือถือและ LINE LIFF",
};

export default function LiffLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className={`${font.className} text-slate-900 pb-20`}>
            <ProjectProvider>
                {children}
            </ProjectProvider>
        </div>
    );
}
