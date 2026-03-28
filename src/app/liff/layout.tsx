import "@/app/globals.css";
import type { Metadata, Viewport } from "next";
import { Sarabun } from "next/font/google";
import { ProjectProvider } from "@/context/ProjectContext";

const font = Sarabun({
    subsets: ["latin", "thai"],
    weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
   title: "PUR-Powertec",
  description: "สร้างเอกสารจ้างงาน",
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
};

export default function LiffLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className={`${font.className} text-slate-900 pb-4`}>
            <ProjectProvider>{children}</ProjectProvider>
        </div>
    );
}
