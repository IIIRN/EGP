"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, Loader2, UserCircle, Edit, UserCheck, UserX } from "lucide-react";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserProfile } from "@/types/auth";
import { useAuth } from "@/context/AuthContext";

export default function UsersPage() {
    const { userProfile } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "users"), orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const userData: UserProfile[] = [];
            snapshot.forEach((doc) => {
                userData.push({ uid: doc.id, ...doc.data() } as UserProfile);
            });
            setUsers(userData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const filteredUsers = users.filter(user =>
        (user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || "") ||
        (user.email?.toLowerCase().includes(searchTerm.toLowerCase()) || "")
    );

    const translatedRole = (role: string) => {
        switch (role) {
            case "admin": return "ผู้ดูแลระบบ";
            case "procurement": return "ฝ่ายจัดซื้อ";
            case "pm": return "ผู้จัดการโครงการ";
            case "engineer": return "วิศวกร";
            default: return "พนักงาน";
        }
    };

    const roleColor = (role: string) => {
        switch (role) {
            case "admin": return "bg-purple-100 text-purple-800";
            case "pm": return "bg-blue-100 text-blue-800";
            case "procurement": return "bg-green-100 text-green-800";
            default: return "bg-slate-100 text-slate-800";
        }
    };

    // Only Admin can add users (or allow if profile is missing for first-time system setup)
    const isAdmin = userProfile?.role === "admin" || !userProfile;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">จัดการพนักงานและสิทธิ์</h1>
                    <p className="text-sm sm:text-base text-slate-500 mt-1">รายชื่อผู้ใช้งานระบบอีจีพีทั้งหมดและการกำหนดสิทธิ์</p>
                </div>
                {isAdmin && (
                    <Link
                        href="/users/create"
                        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors w-full sm:w-auto"
                    >
                        <Plus className="mr-2 h-5 w-5" />
                        เพิ่มพนักงานใหม่
                    </Link>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                    <div className="relative w-full sm:w-96">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อพนักงาน หรือ อีเมล..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    ชื่อ - นามสกุล / อีเมล
                                </th>
                                <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    สิทธิ์ในระบบ (Role)
                                </th>
                                <th scope="col" className="hidden sm:table-cell px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    สถานะการเข้าใช้งาน
                                </th>
                                <th scope="col" className="hidden sm:table-cell px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    จัดการ
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
                                        กำลังโหลดข้อมูล...
                                    </td>
                                </tr>
                            ) : filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => (
                                    <tr key={user.uid} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 md:px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                                                    <UserCircle className="h-6 w-6" />
                                                </div>
                                                <div className="ml-3">
                                                    <div className="text-sm font-medium text-slate-900">{user.displayName || "ยังไม่ระบุชื่อ"}</div>
                                                    <div className="text-xs sm:text-sm text-slate-500">{user.email}</div>
                                                    {/* Mobile Only: Show Actions here so they are accessible */}
                                                    <div className="mt-1 sm:hidden flex items-center gap-2">
                                                        {isAdmin ? (
                                                            <Link href={`/users/${user.uid}`} className="text-blue-600 hover:text-blue-900 inline-flex items-center text-xs font-medium bg-blue-50 px-2 py-0.5 rounded">
                                                                <Edit className="w-3 h-3 mr-1" />
                                                                แก้ไข
                                                            </Link>
                                                        ) : (
                                                            <span className="text-slate-400 text-[10px] bg-slate-50 px-2 py-0.5 rounded">เฉพาะแอดมิน</span>
                                                        )}
                                                        {user.isActive ? (
                                                            <span className="inline-flex items-center text-[10px] text-green-600 font-medium">
                                                                <UserCheck className="w-3 h-3 mr-0.5" />
                                                                ปกติ
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center text-[10px] text-red-600 font-medium">
                                                                <UserX className="w-3 h-3 mr-0.5" />
                                                                ระงับ
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-md ${roleColor(user.role)}`}>
                                                {translatedRole(user.role)}
                                            </span>
                                        </td>
                                        <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                                            {user.isActive ? (
                                                <span className="inline-flex items-center text-sm text-green-600 font-medium">
                                                    <UserCheck className="w-4 h-4 mr-1" />
                                                    ใช้งานปกติ
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center text-sm text-red-600 font-medium">
                                                    <UserX className="w-4 h-4 mr-1" />
                                                    ระงับการใช้งาน
                                                </span>
                                            )}
                                        </td>
                                        <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {isAdmin ? (
                                                <Link href={`/users/${user.uid}`} className="text-blue-600 hover:text-blue-900 inline-flex items-center bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                                                    <Edit className="w-4 h-4 mr-1.5" />
                                                    แก้ไข
                                                </Link>
                                            ) : (
                                                <span className="text-slate-400 text-xs">เฉพาะแอดมิน</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                        <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        ไม่พบรายชื่อพนักงานที่ค้นหา
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
