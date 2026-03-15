"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import liff from "@line/liff";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ClipboardList, FileText, Info, Loader2, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { db } from "@/lib/firebase";
import type { PurchaseRequisition } from "@/types/pr";
import { formatDateThai, formatMoney, getTimestampMillis } from "@/app/liff/_lib/documentHelpers";
import { getRequesterStatusMeta } from "@/app/liff/_lib/requesterPortal";

export default function LiffDashboard() {
    const { user, userProfile } = useAuth();
    const { currentProject, projects, setCurrentProject } = useProject();

    const [liffInitialized, setLiffInitialized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([]);

    const isDevMode = process.env.NEXT_PUBLIC_SHOW_DEV_MODE !== "false";

    useEffect(() => {
        const initLiff = async () => {
            const isLiffBrowser = typeof window !== "undefined" && /Line/i.test(navigator.userAgent);

            if (isDevMode && !isLiffBrowser) {
                setLiffInitialized(true);
                return;
            }

            try {
                await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || "1234567890-AbcdEfgh" });
                if (!liff.isLoggedIn()) {
                    liff.login({ redirectUri: window.location.href });
                    return;
                }

                const profile = await liff.getProfile();
                const response = await fetch("/api/auth/line-login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ lineUserId: profile.userId }),
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.customToken && data.success) {
                        const { signInWithCustomToken } = await import("firebase/auth");
                        const { auth } = await import("@/lib/firebase");
                        await signInWithCustomToken(auth, data.customToken);
                    }
                }

                setLiffInitialized(true);
            } catch (error) {
                console.error("LIFF init error:", error);
                setLiffInitialized(true);
            }
        };

        if (typeof window !== "undefined") {
            void initLiff();
        }
    }, [isDevMode]);

    useEffect(() => {
        if (!user || !currentProject) {
            setLoading(false);
            setRequisitions([]);
            return;
        }

        setLoading(true);

        const unsubscribe = onSnapshot(
            query(
                collection(db, "purchase_requisitions"),
                where("projectId", "==", currentProject.id),
                where("createdBy", "==", user.uid)
            ),
            (snapshot) => {
                const nextRequisitions = snapshot.docs
                    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as PurchaseRequisition)
                    .sort((left, right) => getTimestampMillis(right.createdAt) - getTimestampMillis(left.createdAt));

                setRequisitions(nextRequisitions);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [currentProject, user]);

    const summary = useMemo(() => {
        return {
            total: requisitions.length,
            pending: requisitions.filter((item) => item.status === "pending_need_approval").length,
            processing: requisitions.filter((item) =>
                item.status === "approved_for_sourcing" ||
                item.status === "sourcing" ||
                item.status === "comparing" ||
                item.status === "selection_pending" ||
                item.status === "selected"
            ).length,
        };
    }, [requisitions]);

    if (!liffInitialized) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-slate-50 p-8 text-center">
                <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-600" />
                <p className="text-sm font-medium text-slate-500">กำลังเชื่อมต่อ LINE...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-slate-50 p-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                    <Info className="h-8 w-8 text-blue-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">กรุณาเข้าสู่ระบบ</h2>
                <p className="mt-2 max-w-sm text-sm text-slate-500">กรุณาเข้าสู่ระบบก่อนใช้งานระบบส่งคำขอ PR</p>
                <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
                    <Link href="/login" className="rounded-lg bg-blue-700 px-6 py-3 text-center text-sm font-semibold text-white">
                        ไปหน้าเข้าสู่ระบบ
                    </Link>
                    <Link href="/liff/binding" className="rounded-lg border border-blue-300 bg-white px-6 py-3 text-center text-sm font-semibold text-blue-700">
                        ผูกบัญชี LINE
                    </Link>
                </div>
            </div>
        );
    }

    if (!currentProject) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                    <FileText className="h-8 w-8 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">กรุณาเลือกโครงการก่อน</h2>
                <p className="mt-2 text-sm text-slate-500">เปิด LIFF อีกครั้งหลังจากโหลดรายการโครงการเรียบร้อยแล้ว</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 ">
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
                <div className="mx-auto w-full max-w-3xl px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold text-slate-900">ระบบส่งคำขอ PR</h1>
                                {isDevMode && (
                                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                        DEV
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 text-sm text-slate-500">สร้าง PR และติดตามเฉพาะคำขอของคุณ</p>
                        </div>
                        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-slate-100 font-bold text-slate-700">
                            {userProfile?.lineProfilePic ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={userProfile.lineProfilePic} alt="โปรไฟล์" className="h-full w-full object-cover" />
                            ) : (
                                user.email?.charAt(0).toUpperCase()
                            )}
                        </div>
                    </div>

                    <div className="relative mt-3">
                        <select
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                            value={currentProject.id}
                            onChange={(event) => {
                                const selected = projects.find((project) => project.id === event.target.value);
                                if (selected) {
                                    setCurrentProject(selected);
                                }
                            }}
                        >
                            {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </header>

            <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
                <section className="grid grid-cols-2 gap-3">
                    <Link
                        href="/liff/pr/create"
                        className="flex items-center justify-center rounded-2xl bg-blue-700 px-4 py-4 text-sm font-semibold text-white shadow-sm"
                    >
                        <Plus size={16} className="mr-2" />
                        สร้าง PR
                    </Link>
                    <Link
                        href="/liff/pr"
                        className="flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-4 text-sm font-semibold text-slate-800 shadow-sm"
                    >
                        <ClipboardList size={16} className="mr-2" />
                        PR ของฉัน
                    </Link>
                </section>

                <section className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                        <p className="text-[11px] font-semibold tracking-wide text-slate-400">ทั้งหมด</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{summary.total}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                        <p className="text-[11px] font-semibold tracking-wide text-slate-400">รออนุมัติ</p>
                        <p className="mt-2 text-2xl font-bold text-amber-700">{summary.pending}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                        <p className="text-[11px] font-semibold tracking-wide text-slate-400">กำลังดำเนินการ</p>
                        <p className="mt-2 text-2xl font-bold text-sky-700">{summary.processing}</p>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                        <div>
                            <h2 className="text-sm font-semibold text-slate-900">คำขอล่าสุด</h2>
                            <p className="text-xs text-slate-500">PR ล่าสุดที่คุณสร้างในโครงการนี้</p>
                        </div>
                        <Link href="/liff/pr" className="text-xs font-semibold text-blue-700">
                            ดูทั้งหมด
                        </Link>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center">
                            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
                            <p className="text-sm text-slate-500">กำลังโหลดรายการ PR ของคุณ...</p>
                        </div>
                    ) : requisitions.length === 0 ? (
                        <div className="p-8 text-center">
                            <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                            <h3 className="text-base font-semibold text-slate-900">ยังไม่มี PR</h3>
                            <p className="mt-2 text-sm text-slate-500">เริ่มต้นสร้างคำขอแรกของคุณได้เลย</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {requisitions.slice(0, 5).map((requisition) => {
                                const statusMeta = getRequesterStatusMeta(requisition.status);

                                return (
                                    <Link
                                        key={requisition.id}
                                        href={`/liff/pr/${requisition.id}`}
                                        className="block px-4 py-4 transition-colors hover:bg-slate-50"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-900">{requisition.prNumber}</p>
                                                <h3 className="mt-1 line-clamp-2 text-sm font-medium text-slate-800">{requisition.title}</h3>
                                                <p className="mt-2 text-xs text-slate-500">{statusMeta.description}</p>
                                            </div>
                                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.color}`}>
                                                {statusMeta.label}
                                            </span>
                                        </div>

                                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                                            <span>{formatDateThai(requisition.createdAt)}</span>
                                            <span className="font-medium text-slate-700">{formatMoney(requisition.totalAmount)}</span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
