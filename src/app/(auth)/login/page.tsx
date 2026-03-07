"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Building2, KeyRound, Mail, AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.push("/dashboard");
        } catch (err) {
            console.error("Login Error:", err);
            setError("ข้อมูลเข้าสู่ระบบไม่ถูกต้อง โปรดตรวจสอบอีเมลและรหัสผ่าน");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100">
            <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-6">
                <div className="w-full max-w-md border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 bg-slate-50 px-6 py-6">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center border border-blue-700 bg-white text-blue-700">
                                <Building2 className="h-6 w-6" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-xl font-semibold text-slate-900">PUR-Powertec</h1>
                                <p className="mt-1 text-sm text-slate-600">ระบบจัดซื้อจัดจ้างอิเล็กทรอนิกส์</p>
                            </div>
                        </div>
                    </div>

                    <form className="space-y-5 px-6 py-6" onSubmit={handleLogin}>
                        <div>
                            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                                อีเมล
                            </label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <Mail className="h-4 w-4 text-slate-400" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
                                    placeholder="admin@egp.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                                รหัสผ่าน
                            </label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <KeyRound className="h-4 w-4 text-slate-400" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="border border-rose-200 bg-rose-50 px-4 py-3">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                                    <p className="text-sm text-rose-700">{error}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <label htmlFor="remember-me" className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                    id="remember-me"
                                    name="remember-me"
                                    type="checkbox"
                                    className="h-4 w-4 border-slate-300 text-blue-700 focus:ring-blue-700"
                                />
                                จดจำการเข้าสู่ระบบ
                            </label>
                            <a href="#" className="text-sm font-medium text-blue-700 hover:text-blue-800">
                                ลืมรหัสผ่าน?
                            </a>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="flex w-full items-center justify-center border border-blue-800 bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    กำลังเข้าสู่ระบบ...
                                </>
                            ) : (
                                "เข้าสู่ระบบ"
                            )}
                        </button>
                    </form>

                    <div className="border-t border-slate-200 bg-white px-6 py-4">
                        <p className="text-center text-xs text-slate-500">Electronic Government Procurement</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
