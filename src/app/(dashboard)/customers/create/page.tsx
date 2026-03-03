"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ContactRound, Save, Loader2 } from "lucide-react";
import { addDoc, collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Customer } from "@/types/customer";

function nextCustomerIdFromList(items: string[]) {
    let maxNumber = 0;
    for (const value of items) {
        const match = /^ON(\d+)$/i.exec((value || "").trim());
        if (match) {
            maxNumber = Math.max(maxNumber, Number(match[1]));
        }
    }
    return `ON${String(maxNumber + 1).padStart(3, "0")}`;
}

export default function CreateCustomerPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [autoIdLoading, setAutoIdLoading] = useState(true);

    const [formData, setFormData] = useState<Partial<Customer>>({
        idCus: "",
        customerName: "",
        contactPhone: "",
        officeAddress: "",
        taxId: "",
        address: "",
        isActive: true,
    });

    useEffect(() => {
        const q = query(collection(db, "customers"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const ids = snapshot.docs.map((docSnap) => (docSnap.data() as Partial<Customer>).idCus || "");
            const suggestedId = nextCustomerIdFromList(ids);

            setFormData((prev) => {
                if ((prev.idCus || "").trim()) return prev;
                return { ...prev, idCus: suggestedId };
            });

            setAutoIdLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === "isActive" ? value === "true" : value,
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.idCus || !formData.customerName) {
            alert("กรุณากรอกข้อมูลที่มีดอกจัน (*) ให้ครบถ้วน");
            return;
        }

        setSaving(true);

        try {
            const newCustomer = {
                idCus: formData.idCus.trim(),
                customerName: formData.customerName.trim(),
                contactPhone: (formData.contactPhone || "").trim() || "-",
                officeAddress: (formData.officeAddress || "").trim() || "-",
                taxId: (formData.taxId || "").trim() || "-",
                address: (formData.officeAddress || formData.address || "").trim() || "-",
                isActive: formData.isActive ?? true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await addDoc(collection(db, "customers"), newCustomer);
            router.push("/customers");
        } catch (error) {
            console.error("Error adding customer:", error);
            alert("ไม่สามารถบันทึกข้อมูลลูกค้าได้ โปรดลองอีกครั้ง");
            setSaving(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center space-x-4">
                <Link href="/customers" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">เพิ่มข้อมูลลูกค้าใหม่</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        กรอกรายละเอียดลูกค้าใหม่เข้าสู่ระบบ
                    </p>
                </div>
            </div>

            <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 md:p-8 space-y-6">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                            <ContactRound size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800">ข้อมูลลูกค้า</h3>
                            <p className="text-sm text-slate-500">รายละเอียดพื้นฐานของลูกค้า</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">รหัสลูกค้า <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="idCus"
                                required
                                value={formData.idCus}
                                onChange={handleChange}
                                placeholder="เช่น ON101"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                {autoIdLoading ? "กำลังสร้างรหัสอัตโนมัติ..." : "ระบบสร้างรหัสให้อัตโนมัติ และสามารถแก้ไขได้"}
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">เลขที่ผู้เสียภาษี</label>
                            <input
                                type="text"
                                name="taxId"
                                value={formData.taxId}
                                onChange={handleChange}
                                placeholder="เลขประจำตัวผู้เสียภาษี"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white font-mono"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อลูกค้า <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="customerName"
                                required
                                value={formData.customerName}
                                onChange={handleChange}
                                placeholder="เช่น บริษัท ตัวอย่าง จำกัด"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">เบอร์ติดต่อ</label>
                            <input
                                type="text"
                                name="contactPhone"
                                value={formData.contactPhone || ""}
                                onChange={handleChange}
                                placeholder="เช่น 081-234-5678"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">ที่อยู่สำนักงาน</label>
                            <textarea
                                name="officeAddress"
                                value={formData.officeAddress || ""}
                                onChange={handleChange}
                                rows={3}
                                placeholder="ที่อยู่สำนักงานสำหรับติดต่อ"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">สถานะใช้งาน</label>
                            <select
                                name="isActive"
                                value={formData.isActive ? "true" : "false"}
                                onChange={handleChange}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            >
                                <option value="true">เปิดใช้งาน</option>
                                <option value="false">ปิดใช้งาน</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end space-x-3">
                    <Link
                        href="/customers"
                        className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                    >
                        ยกเลิก
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition-colors"
                    >
                        {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                        บันทึกข้อมูลลูกค้า
                    </button>
                </div>
            </form>
        </div>
    );
}
