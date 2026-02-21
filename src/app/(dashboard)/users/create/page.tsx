"use client";

import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Save, ShieldAlert, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserRole } from "@/types/auth";

export default function CreateUserPage() {
    const { userProfile } = useAuth();
    const router = useRouter();

    const [displayName, setDisplayName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [role, setRole] = useState<UserRole>("engineer");
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // Only Admin can add users (or if profile missing for system bootstrap)
    if (userProfile && userProfile.role !== "admin") {
        return (
            <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-lg text-center flex flex-col items-center">
                <ShieldAlert className="w-12 h-12 text-red-500 mb-3" />
                <h3 className="font-bold text-lg">ไม่มีสิทธิ์ใช้งาน</h3>
                <p className="mb-4">เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเพิ่มพนักงานใหม่ได้</p>
                <Link href="/users" className="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 transition">
                    กลับไปหน้ารายชื่อพนักงาน
                </Link>
            </div>
        );
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");

        if (!displayName || !email || !password || !role) {
            setErrorMsg("กรุณากรอกข้อมูลให้ครบทุกช่อง");
            return;
        }

        if (password.length < 6) {
            setErrorMsg("พาสเวิร์ดต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, displayName, role, phoneNumber })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to create user");
            }

            // Success
            router.push("/users");
        } catch (error: any) {
            console.error("Error creating user:", error);
            setErrorMsg(error.message || "เกิดข้อผิดพลาดในการสร้างพนักงาน");
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-4 md:space-y-6">
            <div className="flex items-center space-x-3 md:space-x-4">
                <Link href="/users" className="p-2 -ml-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors shrink-0">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">เพิ่มสิทธิ์พนักงานใหม่</h1>
                    <p className="text-xs md:text-sm text-slate-500 mt-1">
                        สร้างบัญชีผู้ใช้งานระบบและกำหนดสิทธิ์การเข้าถึง (Role)
                    </p>
                </div>
            </div>

            <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 md:p-8 space-y-5 md:space-y-6">

                    {errorMsg && (
                        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center text-sm border border-red-100">
                            <ShieldAlert className="w-5 h-5 mr-2 flex-shrink-0" />
                            {errorMsg}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                ชื่อ - นามสกุล <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                                placeholder="เช่น นายสมคิด ทดลองใช้"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                อีเมล (ใช้สำหรับเข้าสู่ระบบ) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                                placeholder="เช่น somkid@egp.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                รหัสผ่านเริ่มต้น <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                                placeholder="ต้องเกิน 6 ตัวอักษร เช่น 123456"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                เบอร์โทรติดต่อ (ใช้ผูก LINE) *
                            </label>
                            <input
                                type="tel"
                                required
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                                placeholder="เช่น 0812345678"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                สิทธิ์การเข้าใช้งาน <span className="text-red-500">*</span>
                            </label>
                            <select
                                required
                                value={role}
                                onChange={(e) => setRole(e.target.value as UserRole)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            >
                                <option value="admin">ผู้ดูแลระบบ (Admin) - อนุมัติเอกสาร จัดการพนักงานได้</option>
                                <option value="pm">Project Manager (PM) - อนุมัติเอกสารเฉพาะโครงการตนเอง</option>
                                <option value="procurement">ฝ่ายจัดซื้อ (Procurement) - จัดการคู่ค้า สร้าง PO/VO</option>
                                <option value="engineer">วิศวกร (Engineer) - เบิกของ ดูรายการวัสดุ</option>
                            </select>
                            <p className="text-xs text-slate-500 mt-2">
                                <strong>ผู้ดูแลระบบ (Admin)</strong>: สามารถจัดการโครงการ, ผู้ใช้, การตั้งค่าได้ทั้งหมด <br />
                                <strong>ผู้จัดการโครงการ (PM)</strong>: จัดการ PO/VO, อนุมัติเอกสาร <br />
                                <strong>วิศวกร (Engineer)</strong>: สร้างคำขอใบสั่งซื้อ PO/VO (สถานะ Draft/Request)
                            </p>
                        </div>

                    </div>
                </div>

                <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end space-x-3">
                    <Link
                        href="/users"
                        className="px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                    >
                        ยกเลิก
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        เพิ่มบัญชีพนักงาน
                    </button>
                </div>
            </form>
        </div>
    );
}
