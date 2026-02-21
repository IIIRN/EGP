"use client";

import { Users, Plus, Search, Building2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Vendor } from "@/types/vendor";

export default function VendorsPage() {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "vendors"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const vendorData: Vendor[] = [];
            snapshot.forEach((doc) => {
                vendorData.push({ id: doc.id, ...doc.data() } as Vendor);
            });

            // Sort client-side
            vendorData.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            });

            setVendors(vendorData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ระบบจัดการคู่ค้า (Vendors)</h1>
                    <p className="text-sm text-slate-500 mt-1">รายชื่อบริษัทผู้ขาย ผู้รับเหมา และร้านค้าวัสดุก่อสร้างทั้งหมด</p>
                </div>
                <Link
                    href="/vendors/create"
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
                >
                    <Plus size={18} className="mr-2" />
                    เพิ่มคู่ค้าใหม่
                </Link>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                    <div className="relative max-w-sm w-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อบริษัท หรือเลขผู้เสียภาษี..."
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    ชื่อบริษัท / คู่ค้า
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    ข้อมูลติดต่อ
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    เลขทะเบียนนิติบุคคล
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    สถานะ
                                </th>
                                <th scope="col" className="relative px-6 py-3">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                        กำลังโหลดข้อมูลคู่ค้า...
                                    </td>
                                </tr>
                            ) : vendors.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center flex-col items-center">
                                        <Users className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                                        <h3 className="text-sm font-semibold text-slate-900">ยังไม่มีรายชื่อคู่ค้า</h3>
                                        <p className="mt-1 text-sm text-slate-500">เริ่มต้นใช้งานโดยการเพิ่มรายชื่อผู้ขายหรือคู่ค้าใหม่</p>
                                    </td>
                                </tr>
                            ) : (
                                vendors.map((vendor) => (
                                    <tr key={vendor.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mr-3">
                                                    <Building2 size={20} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-slate-900">{vendor.name}</div>
                                                    {vendor.googleMapUrl && (
                                                        <a href={vendor.googleMapUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">
                                                            ดูแผนที่ร้าน
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-slate-900 mt-1">โทร: {vendor.phone}</div>
                                            <div className="text-sm text-slate-500">ผู้ติดต่อ: {vendor.contactName}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                                            {vendor.taxId}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {vendor.isActive ? (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                    เปิดใช้งาน
                                                </span>
                                            ) : (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-800">
                                                    ปิดใช้งาน
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <Link href={`/vendors/${vendor.id}`} className="inline-flex items-center text-blue-600 hover:text-blue-900 hover:underline">
                                                แก้ไข
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
