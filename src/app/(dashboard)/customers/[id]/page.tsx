"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ContactRound, Save, Loader2, Trash2 } from "lucide-react";
import { deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Customer } from "@/types/customer";

export default function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

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
        async function fetchCustomer() {
            if (!resolvedParams.id) return;
            try {
                const docRef = doc(db, "customers", resolvedParams.id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data() as Partial<Customer>;
                    setFormData({
                        idCus: data.idCus || "",
                        customerName: data.customerName || "",
                        contactPhone: data.contactPhone || "",
                        officeAddress: data.officeAddress === "-" ? "" : data.officeAddress || data.address || "",
                        taxId: data.taxId === "-" ? "" : data.taxId || "",
                        address: data.address === "-" ? "" : data.address || "",
                        isActive: data.isActive ?? true,
                    });
                } else {
                    alert("ไม่พบข้อมูลลูกค้านี้");
                    router.push("/customers");
                }
            } catch (error) {
                console.error("Error fetching customer:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchCustomer();
    }, [resolvedParams.id, router]);

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
            const customerRef = doc(db, "customers", resolvedParams.id);
            await updateDoc(customerRef, {
                idCus: formData.idCus.trim(),
                customerName: formData.customerName.trim(),
                contactPhone: (formData.contactPhone || "").trim() || "-",
                officeAddress: (formData.officeAddress || "").trim() || "-",
                taxId: (formData.taxId || "").trim() || "-",
                address: (formData.officeAddress || formData.address || "").trim() || "-",
                isActive: formData.isActive ?? true,
                updatedAt: new Date().toISOString(),
            });

            router.push("/customers");
        } catch (error) {
            console.error("Error updating customer:", error);
            alert("ไม่สามารถบันทึกข้อมูลลูกค้าได้ โปรดลองอีกครั้ง");
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลลูกค้านี้?")) {
            return;
        }

        setDeleting(true);
        try {
            const customerRef = doc(db, "customers", resolvedParams.id);
            await deleteDoc(customerRef);
            router.push("/customers");
        } catch (error) {
            console.error("Error deleting customer:", error);
            alert("ลบข้อมูลไม่สำเร็จ");
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="animate-spin w-8 h-8 text-blue-600 mb-4" />
                <p className="text-slate-500">กำลังโหลดข้อมูล...</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link href="/customers" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">แก้ไขข้อมูลลูกค้า</h1>
                        <p className="text-sm text-slate-500 mt-1">แก้ไขรายละเอียดและสถานะของลูกค้า</p>
                    </div>
                </div>

                <button
                    onClick={handleDelete}
                    disabled={deleting || saving}
                    className="inline-flex items-center justify-center rounded-lg bg-white border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                    {deleting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Trash2 size={16} className="mr-2" />}
                    ลบข้อมูลนี้
                </button>
            </div>

            <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 md:p-8 space-y-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                                <ContactRound size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">ข้อมูลลูกค้า</h3>
                                <p className="text-sm text-slate-500">รายละเอียดพื้นฐานของลูกค้า</p>
                            </div>
                        </div>

                        <div className="w-48">
                            <label className="block text-sm font-medium text-slate-700 mb-1">สถานะใช้งาน</label>
                            <select
                                name="isActive"
                                value={formData.isActive ? "true" : "false"}
                                onChange={handleChange}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            >
                                <option value="true">✅ เปิดใช้งาน</option>
                                <option value="false">❌ ปิดใช้งานชั่วคราว</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">รหัสลูกค้า <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="idCus"
                                required
                                value={formData.idCus || ""}
                                onChange={handleChange}
                                placeholder="เช่น ON101"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">เลขที่ผู้เสียภาษี</label>
                            <input
                                type="text"
                                name="taxId"
                                value={formData.taxId || ""}
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
                                value={formData.customerName || ""}
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
                        อัปเดตข้อมูลลูกค้า
                    </button>
                </div>
            </form>
        </div>
    );
}
