"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState, Suspense } from "react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

function ApproveAction() {
    const { userProfile, loading: authLoading } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [status, setStatus] = useState<"loading" | "success" | "error" | "unauthorized">("loading");
    const [message, setMessage] = useState("กำลังเชื่อมต่อระบบ...");

    useEffect(() => {
        const initLiffClient = async () => {
            if (typeof window === "undefined") return;
            try {
                const liffId = process.env.NEXT_PUBLIC_LIFF_ID || "1234567890-AbcdEfgh";
                const liff = (await import("@line/liff")).default;
                await liff.init({ liffId });

                if (liff.isLoggedIn()) {
                    const profile = await liff.getProfile();

                    // Always try to refresh token/session based on LINE ID if opening from LINE
                    const res = await fetch("/api/auth/line-login", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ lineUserId: profile.userId })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        if (data.customToken && data.success) {
                            const { signInWithCustomToken } = await import("firebase/auth");
                            const { auth } = await import("@/lib/firebase");
                            await signInWithCustomToken(auth, data.customToken);
                        }
                    }
                }
            } catch (err) {
                console.error("LIFF approval init err:", err);
            }
        };

        initLiffClient();
    }, []);

    useEffect(() => {
        if (authLoading) return;

        if (!userProfile) {
            setStatus("unauthorized");
            setMessage("กรุณาการลงทะเบียนผูกบัญชี LINE ก่อนทำรายการ");
            router.push("/liff/binding");
            return;
        }

        // Must be admin or PM
        if (userProfile.role !== "admin" && userProfile.role !== "pm") {
            setStatus("unauthorized");
            setMessage("คุณไม่มีสิทธิ์ในการอนุมัติเอกสารนี้");
            return;
        }

        const type = searchParams.get("type");
        const id = searchParams.get("id");

        if (!type || !id) {
            setStatus("error");
            setMessage("ข้อมูลไม่ครบถ้วน (ไม่พบ type หรือ id)");
            return;
        }

        const collectionName = type.toLowerCase() === "po" ? "purchase_orders" :
            type.toLowerCase() === "vo" ? "variation_orders" : null;

        if (!collectionName) {
            setStatus("error");
            setMessage("ประเภทเอกสารไม่ถูกต้อง");
            return;
        }

        const processApproval = async () => {
            try {
                setMessage("กำลังดำเนินการอนุมัติ...");
                const docRef = doc(db, collectionName, id);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) {
                    setStatus("error");
                    setMessage("ไม่พบเอกสารนี้ในระบบ");
                    return;
                }

                const data = docSnap.data();

                if (data.status === "approved") {
                    setStatus("success");
                    setMessage("เอกสารนี้ได้รับการอนุมัติไปแล้ว");
                    return;
                }

                await updateDoc(docRef, {
                    status: "approved",
                    updatedAt: serverTimestamp()
                });

                // Try to send notification to update group if necessary, 
                // but since it's from LINE, they might already see it.
                // We will just do a silent notification trigger if needed, or skip it.
                if (type.toLowerCase() === "po") {
                    let vendorData = null;
                    if (data.vendorId) {
                        const vendorSnap = await getDoc(doc(db, "vendors", data.vendorId));
                        if (vendorSnap.exists()) vendorData = vendorSnap.data();
                    }

                    // fetch project name optionally if you want to notify again, 
                    // but usually approval from LINE doesn't need to re-notify unless needed.
                    try {
                        let projectName = "โครงการ";
                        if (data.projectId) {
                            const pSnap = await getDoc(doc(db, "projects", data.projectId));
                            if (pSnap.exists()) projectName = pSnap.data().name;
                        }

                        fetch("/api/line/notify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                type: "PO",
                                data: { ...data, status: "approved" },
                                vendorData: vendorData,
                                projectName: projectName
                            })
                        }).catch(e => console.error("Notify err:", e));
                    } catch (e) {
                        console.error("Notify block err:", e);
                    }
                }

                setStatus("success");
                setMessage("อนุมัติเอกสารเรียบร้อยแล้ว");

            } catch (error: any) {
                console.error("Approval error:", error);
                setStatus("error");
                setMessage("เกิดข้อผิดพลาด: " + error.message);
            }
        };

        processApproval();

    }, [authLoading, userProfile, searchParams, router]);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-sm w-full text-center space-y-4">
                {status === "loading" && (
                    <div className="flex flex-col items-center justify-center py-6">
                        <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
                        <h2 className="text-xl font-bold text-slate-800">{message}</h2>
                        <p className="text-slate-500 mt-2 text-sm">กรุณารอสักครู่...</p>
                    </div>
                )}

                {status === "success" && (
                    <div className="flex flex-col items-center justify-center py-6">
                        <CheckCircle className="w-20 h-20 text-green-500 mb-4" />
                        <h2 className="text-xl font-bold text-slate-800">สำเร็จ!</h2>
                        <p className="text-slate-600 mt-2">{message}</p>
                        <button
                            onClick={() => router.push('/liff')}
                            className="mt-6 w-full bg-slate-800 text-white font-semibold py-3 rounded-xl hover:bg-slate-700 transition"
                        >
                            กลับหน้าหลัก
                        </button>
                    </div>
                )}

                {(status === "error" || status === "unauthorized") && (
                    <div className="flex flex-col items-center justify-center py-6">
                        <XCircle className="w-20 h-20 text-red-500 mb-4" />
                        <h2 className="text-xl font-bold text-slate-800">ไม่สามารถดำเนินการได้</h2>
                        <p className="text-slate-600 mt-2">{message}</p>
                        <button
                            onClick={() => router.push('/liff')}
                            className="mt-6 w-full bg-slate-200 text-slate-800 font-semibold py-3 rounded-xl hover:bg-slate-300 transition"
                        >
                            กลับหน้าหลัก
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function LiffApprovePage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-500 w-10 h-10" /></div>}>
            <ApproveAction />
        </Suspense>
    );
}
