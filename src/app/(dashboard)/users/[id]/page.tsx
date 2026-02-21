"use client";

import { use, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Save, ShieldAlert, Loader2, UserCircle, Edit3, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserProfile, UserRole } from "@/types/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const { userProfile } = useAuth();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // Details to update
    const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);
    const [displayName, setDisplayName] = useState("");
    const [role, setRole] = useState<UserRole>("engineer");
    const [isActive, setIsActive] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState("");

    useEffect(() => {
        async function fetchUser() {
            if (!resolvedParams.id) return;
            try {
                const docRef = doc(db, "users", resolvedParams.id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = { uid: docSnap.id, ...docSnap.data() } as UserProfile;
                    setUserToEdit(data);
                    setDisplayName(data.displayName || "");
                    setRole(data.role || "engineer");
                    setIsActive(data.isActive ?? true);
                    setPhoneNumber(data.phoneNumber || "");
                } else {
                    setErrorMsg("ไม่พบข้อมูลพนักงานในระบบ");
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                setErrorMsg("โหลดข้อมูลล้มเหลว");
            } finally {
                setLoading(false);
            }
        }
        fetchUser();
    }, [resolvedParams.id]);

    // Only Admin can edit users (or if profile missing for system bootstrap)
    const isAdmin = userProfile?.role === "admin" || !userProfile;
    if (!isAdmin) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-lg text-center flex flex-col items-center">
                <ShieldAlert className="w-12 h-12 text-red-500 mb-3" />
                <h3 className="font-bold text-lg">ไม่มีสิทธิ์ใช้งาน</h3>
                <p className="mb-4">เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถแก้ไขข้อมูลและสิทธิ์พนักงานได้</p>
                <Link href="/users" className="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 transition">
                    กลับไปหน้ารายชื่อพนักงาน
                </Link>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="animate-spin w-8 h-8 text-blue-600 mb-4" />
                <p className="text-slate-500">กำลังโหลดข้อมูลบัญชีพนักงาน...</p>
            </div>
        );
    }

    if (!userToEdit) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-lg text-center">
                <h3 className="font-bold text-lg">⚠️ ไม่พบข้อมูลบัญชี</h3>
                <p className="mb-4">ผู้ใช้งานนี้อาจถูกลบไปแล้ว หรือไม่มีอยู่จริงในระบบ</p>
                <Link href="/users" className="text-blue-600 hover:underline">
                    กลับไปหน้าระบบรายชื่อ
                </Link>
            </div>
        );
    }

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");

        if (!displayName || !role) {
            setErrorMsg("กรุณากรอกข้อมูลให้ครบทุกช่อง");
            return;
        }

        // Prevent admin from deactivating themselves
        if (!isActive && userToEdit.uid === userProfile?.uid) {
            setErrorMsg("คุณไม่สามารถระงับบัญชีหรือปิดการใช้งานบัญชีของคุณเองได้");
            return;
        }

        setSaving(true);
        try {
            const userRef = doc(db, "users", resolvedParams.id);
            await updateDoc(userRef, {
                displayName,
                role,
                isActive,
                phoneNumber,
                updatedAt: serverTimestamp(),
            });

            // Success
            router.push("/users");
        } catch (error: any) {
            console.error("Error updating user:", error);
            setErrorMsg("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!userToEdit) return;

        if (userToEdit.uid === userProfile?.uid) {
            setErrorMsg("คุณไม่สามารถลบบัญชีของคุณเองได้");
            return;
        }

        if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบบัญชี "${userToEdit.displayName}" ออกจากระบบ?\n\nการกระทำนี้จะลบทั้งหน้าข้อมูลโปรไฟล์และการล็อกอินออกจากระบบอย่างถาวร!`)) {
            return;
        }

        setDeleting(true);
        setErrorMsg("");

        try {
            const res = await fetch(`/api/users/${resolvedParams.id}`, {
                method: "DELETE"
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "ลบล้มเหลว");
            }

            router.push("/users");
        } catch (error: any) {
            console.error("Error deleting user:", error);
            setErrorMsg(error.message || "ไม่สามารถลบบัญชีพนักงานได้ โปรดตรวจสอบหน้าต่าง Console");
            setDeleting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-4 md:space-y-6">
            <div className="flex items-center space-x-3 md:space-x-4">
                <Link href="/users" className="p-2 -ml-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors shrink-0">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">แก้ไขข้อมูลพนักงาน</h1>
                    <p className="text-xs md:text-sm text-slate-500 mt-1">
                        ปรับแก้สิทธิการเข้าถึงของบัญชีระบบ
                    </p>
                </div>
            </div>

            <form onSubmit={handleUpdate} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 md:p-8 space-y-5 md:space-y-6">

                    {errorMsg && (
                        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center text-sm border border-red-100">
                            <ShieldAlert className="w-5 h-5 mr-2 flex-shrink-0" />
                            {errorMsg}
                        </div>
                    )}

                    <div className="flex items-center mb-6">
                        <div className="w-16 h-16 shrink-0 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 ring-2 ring-slate-200 shadow-inner overflow-hidden">
                            {userToEdit.lineProfilePic ? (
                                <img src={userToEdit.lineProfilePic} alt="LINE Profile" className="w-full h-full object-cover" />
                            ) : (
                                <UserCircle className="w-10 h-10" />
                            )}
                        </div>
                        <div className="ml-4 flex flex-col">
                            <span className="text-xs text-slate-400 font-mono uppercase tracking-widest mb-1">
                                Firebase Auth Account
                            </span>
                            <span className="text-lg font-bold text-slate-800">
                                {userToEdit.email}
                            </span>
                            <div className="text-xs text-slate-500 mt-1 flex flex-col gap-1">
                                <span>UUID: <span className="text-slate-400 font-mono">{userToEdit.uid}</span></span>
                                {userToEdit.lineUserId ? (
                                    <span className="text-green-600 font-medium">✨ เชื่อมต่อ LINE สำเร็จแล้ว</span>
                                ) : (
                                    <span className="text-orange-500">รอการผูกบัญชี LINE</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
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
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                เบอร์โทรติดต่อ (ใช้ผูก LINE)
                            </label>
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                                placeholder="เช่น 0812345678"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                * ใช้เพื่อตรวจสอบยืนยันตัวตนตอนล็อกอินผ่าน LINE
                            </p>
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
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center">
                                <ShieldAlert className="w-4 h-4 text-orange-500 mr-2" />
                                ควบคุมสถานะบัญชีรายบุคคล
                            </h3>
                            <div className="flex items-center space-x-3 bg-slate-50 p-4 border border-slate-200 rounded-lg">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                                <span className="text-sm font-medium text-slate-800">
                                    {isActive ? "อนุญาตให้บัญชีนี้เข้าสู่ระบบ (Active)" : "สั่งระงับบัญชี ถอดสิทธิ์เข้าใช้งานชั่วคราว (Inactive)"}
                                </span>
                            </div>
                        </div>

                    </div>

                </div>

                <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="w-full sm:w-auto flex justify-center sm:justify-start order-2 sm:order-1">
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={deleting || saving || userToEdit?.uid === userProfile?.uid}
                            className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            ลบบัญชีพนักงานถาวร
                        </button>
                    </div>

                    <div className="flex space-x-3 w-full sm:w-auto justify-end order-1 sm:order-2">
                        <Link
                            href="/users"
                            className="flex-1 sm:flex-none text-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                        >
                            ยกเลิก
                        </Link>
                        <button
                            type="submit"
                            disabled={saving || deleting}
                            className="flex-1 sm:flex-none inline-flex justify-center items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            อัปเดตข้อมูลพนักงาน
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
