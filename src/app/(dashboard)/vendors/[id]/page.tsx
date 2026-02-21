"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Save, Loader2, Trash2 } from "lucide-react";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Vendor } from "@/types/vendor";

export default function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [formData, setFormData] = useState<Partial<Vendor>>({
        name: "",
        taxId: "",
        contactName: "",
        phone: "",
        email: "",
        address: "",
        googleMapUrl: "",
        isActive: true
    });

    useEffect(() => {
        async function fetchVendor() {
            if (!resolvedParams.id) return;
            try {
                const docRef = doc(db, "vendors", resolvedParams.id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setFormData({ id: docSnap.id, ...docSnap.data() } as Vendor);
                } else {
                    console.error("No such vendor document!");
                    alert("ไม่พบข้อมูลคู่ค้านี้");
                    router.push("/vendors");
                }
            } catch (error) {
                console.error("Error fetching vendor:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchVendor();
    }, [resolvedParams.id, router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === "isActive" ? value === "true" : value
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.contactName || !formData.phone) {
            alert("กรุณากรอกข้อมูลที่มีดอกจัน (*) ให้ครบถ้วน");
            return;
        }

        setSaving(true);

        try {
            const vendorRef = doc(db, "vendors", resolvedParams.id);
            await updateDoc(vendorRef, {
                ...formData,
                updatedAt: new Date().toISOString(),
            });

            router.push("/vendors");
        } catch (error) {
            console.error("Error updating vendor:", error);
            alert("ไม่สามารถบันทึกข้อมูลคู่ค้าได้ โปรดลองอีกครั้ง");
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลคู่ค้านี้? ข้อมูลใบสั่งซื้อที่มีอยู่แล้วอาจได้รับผลกระทบ")) {
            return;
        }

        setDeleting(true);
        try {
            const vendorRef = doc(db, "vendors", resolvedParams.id);
            await deleteDoc(vendorRef);
            router.push("/vendors");
        } catch (error) {
            console.error("Error deleting vendor:", error);
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
                    <Link href="/vendors" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">แก้ไขข้อมูลคู่ค้า</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            แก้ไขรายละเอียดและสถานะของคู่ค้า
                        </p>
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
                                <Building2 size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">ข้อมูลบริษัท</h3>
                                <p className="text-sm text-slate-500">รายละเอียดพื้นฐานของนิติบุคคล</p>
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
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อบริษัท / ร้านค้า <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="name"
                                required
                                value={formData.name || ""}
                                onChange={handleChange}
                                placeholder="เช่น บริษัท บุญถาวรเซรามิค จำกัด"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">เลขทะเบียนนิติบุคคล / ผู้เสียภาษี</label>
                            <input
                                type="text"
                                name="taxId"
                                value={formData.taxId || ""}
                                onChange={handleChange}
                                placeholder="เลขประจำตัวผู้เสียภาษี 13 หลัก (ถ้าระบุ)"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white font-mono"
                            />
                        </div>
                    </div>

                    <hr className="border-slate-100 my-6" />

                    <h3 className="text-base font-semibold text-slate-800 mb-4">ข้อมูลการติดต่อ</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อผู้ติดต่อ (เซลส์) <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="contactName"
                                required
                                value={formData.contactName || ""}
                                onChange={handleChange}
                                placeholder="ชื่อ-นามสกุล ของผู้แทนฝ่ายขาย"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="phone"
                                required
                                value={formData.phone || ""}
                                onChange={handleChange}
                                placeholder="เช่น 081-xxx-xxxx"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">อีเมล</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email || ""}
                                onChange={handleChange}
                                placeholder="email@vendor.com"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">ที่อยู่ธุรกิจ</label>
                            <textarea
                                name="address"
                                value={formData.address || ""}
                                onChange={handleChange}
                                rows={3}
                                placeholder="ที่อยู่สำหรับออกใบแจ้งหนี้ / ใบเสร็จรับเงิน..."
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">ลิงก์ตำแหน่งร้าน (Google Maps)</label>
                            <input
                                type="url"
                                name="googleMapUrl"
                                value={formData.googleMapUrl || ""}
                                onChange={handleChange}
                                placeholder="https://maps.app.goo.gl/..."
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-blue-600"
                            />
                        </div>
                    </div>

                </div>

                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end space-x-3">
                    <Link
                        href="/vendors"
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
                        อัปเดตข้อมูลคู่ค้า
                    </button>
                </div>
            </form>

        </div>
    );
}
