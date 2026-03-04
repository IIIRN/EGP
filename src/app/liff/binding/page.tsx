"use client";

import { useEffect, useState } from "react";
import liff from "@line/liff";
import { Loader2, Phone, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

export default function LiffBindingPage() {
    const [loading, setLoading] = useState(true);
    const [lineProfile, setLineProfile] = useState<any>(null);
    const [phoneNumber, setPhoneNumber] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [success, setSuccess] = useState(false);
    const [verifying, setVerifying] = useState(false);

    useEffect(() => {
        const initLiff = async () => {
            try {
                // TODO: Replace with actual LIFF ID
                await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || "1234567890-AbcdEfgh" });
                if (!liff.isLoggedIn()) {
                    liff.login();
                    return;
                }
                const profile = await liff.getProfile();
                setLineProfile(profile);
            } catch (err) {
                console.error("LIFF Init Error:", err);
                setErrorMsg("ไม่สามารถเชื่อมต่อระบบ LINE ได้ กรุณาลองใหม่");
            } finally {
                setLoading(false);
            }
        };

        // If not in a real browser env, don't crash
        if (typeof window !== "undefined") {
            initLiff();
        }
    }, []);

    const handleBind = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");

        if (!phoneNumber) {
            setErrorMsg("กรุณากรอกเบอร์โทรศัพท์");
            return;
        }

        if (!lineProfile) {
            setErrorMsg("ยังไม่ได้เข้าสู่ระบบ LINE แก่แอปพลิเคชัน");
            return;
        }

        setVerifying(true);
        try {
            const res = await fetch("/api/users/bind-line", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phoneNumber,
                    lineUserId: lineProfile.userId,
                    lineProfilePic: lineProfile.pictureUrl,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "ผูกบัญชีไม่สำเร็จ");
            }

            // Automatically sign in if token was provided
            if (data.customToken) {
                const { signInWithCustomToken } = await import("firebase/auth");
                const { auth } = await import("@/lib/firebase");
                await signInWithCustomToken(auth, data.customToken);
            }

            setSuccess(true);
        } catch (error: any) {
            setErrorMsg(error.message || "เกิดข้อผิดพลาดในการเชื่อมบัญชี");
        } finally {
            setVerifying(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                <p className="text-slate-500 font-medium tracking-wide">กำลังเชื่อมต่อ LINE...</p>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6 border border-blue-200">
                    <CheckCircle2 className="w-12 h-12 text-blue-700" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 mb-2">เชื่อมต่อ LINE สำเร็จ!</h1>
                <p className="text-slate-500 mb-8 max-w-sm">บัญชีผู้ใช้งานระบบ EGP ของคุณได้ถูกผูกกับ LINE เรียบร้อยแล้ว</p>
                <p className="text-sm font-medium text-slate-400">กรุณาปิดหน้าต่างนี้และใช้เมนู LINE อีกครั้ง</p>
                <div className="mt-8">
                    <button onClick={() => liff.closeWindow()} className="px-6 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-colors">
                        ปิดหน้าต่างนี้
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col p-6 items-center justify-center">
            <div className="w-full max-w-sm bg-white rounded-xl overflow-hidden border border-slate-200">

                <div className="bg-blue-700 p-8 text-center border-b border-blue-800">
                    <p className="text-blue-100 font-medium mb-4 text-sm tracking-wide">เชื่อมต่อระบบ EGP</p>
                    {lineProfile?.pictureUrl ? (
                        <div className="w-24 h-24 mx-auto rounded-full p-1 bg-white border border-blue-100">
                            <img src={lineProfile.pictureUrl} alt="Profile" className="w-full h-full rounded-full object-cover" />
                            <div className="absolute bottom-0 right-0 w-6 h-6 bg-blue-600 border-2 border-white rounded-full"></div>
                        </div>
                    ) : (
                        <div className="w-24 h-24 mx-auto rounded-full bg-blue-600/20 flex items-center justify-center border-2 border-white">
                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                        </div>
                    )}
                    <h2 className="text-white font-bold text-lg mt-5">{lineProfile?.displayName || "กำลังโหลด..."}</h2>
                </div>

                <div className="p-8 pb-10">
                    <div className="mb-6 text-center">
                        <h3 className="text-slate-800 font-bold text-xl mb-2">ยืนยันเบอร์โทรศัพท์</h3>
                        <p className="text-sm text-slate-500 max-w-[250px] mx-auto leading-relaxed">กรุณากรอกเบอร์โทรศัพท์ที่แจ้งไว้กับผู้ดูแลระบบ เพื่อเชื่อมต่อกับ LINE นี้</p>
                    </div>

                    {errorMsg && (
                        <div className="mb-6 bg-red-50 text-red-600 text-sm p-3 rounded-xl flex items-start border border-red-100">
                            <AlertCircle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    <form onSubmit={handleBind} className="space-y-6">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Phone className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                type="tel"
                                required
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 focus:bg-white transition-colors text-base font-medium font-sans"
                                placeholder="0812345678"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={verifying}
                            className="w-full flex items-center justify-center py-4 px-4 bg-blue-700 hover:bg-blue-600 text-white rounded-lg font-bold transition-colors font-sans disabled:opacity-70 disabled:cursor-not-allowed group"
                        >
                            {verifying ? (
                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            ) : (
                                <>
                                    ยืนยันการเชื่อมต่อ
                                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>

            <p className="mt-8 text-xs text-slate-400 text-center max-w-xs leading-relaxed">
                การคลิกยืนยันแสดงว่าคุณยอมรับเงื่อนไขการให้บริการและนโยบายความเป็นส่วนตัวของ EGP System
            </p>
        </div>
    );
}
