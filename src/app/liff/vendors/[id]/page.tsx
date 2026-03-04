"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Save, Loader2, Tag } from "lucide-react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Vendor } from "@/types/vendor";

export default function EditLiffVendorPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState<Partial<Vendor>>({
        name: "",
        taxId: "",
        contactName: "",
        phone: "",
        email: "",
        address: "",
        googleMapUrl: "",
        vendorTypes: [],
        isActive: true,
    });
    const [availableTypes, setAvailableTypes] = useState<string[]>([]);

    useEffect(() => {
        async function fetchData() {
            if (!resolvedParams.id) return;
            try {
                const [vendorSnap, configSnap] = await Promise.all([
                    getDoc(doc(db, "vendors", resolvedParams.id)),
                    getDoc(doc(db, "system_settings", "global_config")),
                ]);

                if (!vendorSnap.exists()) {
                    alert("ไม่พบข้อมูลคู่ค้านี้");
                    router.push("/liff");
                    return;
                }

                const vendor = vendorSnap.data() as Vendor;
                setFormData({
                    name: vendor.name || "",
                    taxId: vendor.taxId || "",
                    contactName: vendor.contactName || "",
                    phone: vendor.phone || "",
                    email: vendor.email || "",
                    address: vendor.address || "",
                    googleMapUrl: vendor.googleMapUrl || "",
                    vendorTypes: vendor.vendorTypes || [],
                    isActive: typeof vendor.isActive === "boolean" ? vendor.isActive : true,
                });

                if (configSnap.exists()) {
                    const config = configSnap.data();
                    setAvailableTypes(Array.isArray(config.vendorTypes) ? config.vendorTypes : []);
                }
            } catch (error) {
                console.error("Error fetching vendor data:", error);
                alert("ไม่สามารถโหลดข้อมูลคู่ค้าได้");
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [resolvedParams.id, router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === "isActive" ? value === "true" : value,
        }));
    };

    const handleTypeChange = (type: string) => {
        setFormData((prev) => {
            const currentTypes = prev.vendorTypes || [];
            if (currentTypes.includes(type)) {
                return { ...prev, vendorTypes: currentTypes.filter((t) => t !== type) };
            }
            return { ...prev, vendorTypes: [...currentTypes, type] };
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.contactName || !formData.phone) {
            alert("กรุณากรอกข้อมูลที่มีดอกจัน (*) ให้ครบถ้วน");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: formData.name || "",
                taxId: formData.taxId || "",
                contactName: formData.contactName || "",
                phone: formData.phone || "",
                email: formData.email || "",
                address: formData.address || "",
                googleMapUrl: formData.googleMapUrl || "",
                vendorTypes: formData.vendorTypes || [],
                isActive: typeof formData.isActive === "boolean" ? formData.isActive : true,
                updatedAt: new Date().toISOString(),
            };

            await updateDoc(doc(db, "vendors", resolvedParams.id), payload);
            router.push("/liff");
        } catch (error) {
            console.error("Error updating vendor:", error);
            alert("ไม่สามารถบันทึกข้อมูลคู่ค้าได้ โปรดลองอีกครั้ง");
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-8">
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-blue-600" />
                <p className="text-sm text-slate-500">กำลังโหลดข้อมูลคู่ค้า...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100">
            <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5 md:py-6">
                <div className="rounded-lg border border-slate-200 bg-white p-4 md:p-5">
                    <div className="flex items-center space-x-3">
                        <Link href="/liff" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
                            <ArrowLeft size={18} />
                        </Link>
                        <div>
                            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">แก้ไขข้อมูลคู่ค้า</h1>
                            <p className="text-sm text-slate-500 mt-1">อัปเดตรายละเอียดและสถานะการใช้งานคู่ค้า</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSave} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="p-5 md:p-6 space-y-6">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center space-x-3">
                                <div className="h-10 w-10 bg-blue-50 text-blue-700 rounded-md border border-blue-200 flex items-center justify-center">
                                    <Building2 size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900">ข้อมูลบริษัท</h3>
                                    <p className="text-sm text-slate-500">รายละเอียดพื้นฐานของนิติบุคคล</p>
                                </div>
                            </div>

                            <div className="w-40">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">สถานะใช้งาน</label>
                                <select
                                    name="isActive"
                                    value={formData.isActive ? "true" : "false"}
                                    onChange={handleChange}
                                    className="w-full border border-slate-300 rounded-md py-2.5 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                                >
                                    <option value="true">เปิดใช้งาน</option>
                                    <option value="false">ปิดใช้งาน</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">ชื่อบริษัท / ร้านค้า <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name || ""}
                                    onChange={handleChange}
                                    placeholder="เช่น บริษัท บุญถาวรเซรามิค จำกัด"
                                    className="w-full border border-slate-300 rounded-md py-2.5 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">เลขทะเบียนนิติบุคคล / ผู้เสียภาษี</label>
                                <input
                                    type="text"
                                    name="taxId"
                                    value={formData.taxId || ""}
                                    onChange={handleChange}
                                    placeholder="เลขประจำตัวผู้เสียภาษี 13 หลัก (ถ้าระบุ)"
                                    className="w-full border border-slate-300 rounded-md py-2.5 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white font-mono"
                                />
                            </div>
                        </div>

                        {availableTypes.length > 0 && (
                            <>
                                <hr className="border-slate-200 my-6" />
                                <div className="flex items-center space-x-3 mb-3">
                                    <div className="h-10 w-10 bg-blue-50 text-blue-700 rounded-md border border-blue-200 flex items-center justify-center">
                                        <Tag size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-semibold text-slate-900">ประเภทคู่ค้า / สินค้า</h3>
                                        <p className="text-sm text-slate-500">เลือกประเภทเพื่อให้ง่ายต่อการค้นหา</p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {availableTypes.map((type) => {
                                        const isSelected = formData.vendorTypes?.includes(type);
                                        return (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => handleTypeChange(type)}
                                                className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${isSelected ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                                            >
                                                {type}
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        <hr className="border-slate-200 my-6" />
                        <h3 className="text-base font-semibold text-slate-900 mb-3">ข้อมูลการติดต่อ</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">ชื่อผู้ติดต่อ (เซลส์) <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="contactName"
                                    required
                                    value={formData.contactName || ""}
                                    onChange={handleChange}
                                    placeholder="ชื่อ-นามสกุล ของผู้แทนฝ่ายขาย"
                                    className="w-full border border-slate-300 rounded-md py-2.5 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="phone"
                                    required
                                    value={formData.phone || ""}
                                    onChange={handleChange}
                                    placeholder="เช่น 081-xxx-xxxx"
                                    className="w-full border border-slate-300 rounded-md py-2.5 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                                />
                            </div>

                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">อีเมล</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email || ""}
                                    onChange={handleChange}
                                    placeholder="email@vendor.com"
                                    className="w-full border border-slate-300 rounded-md py-2.5 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                                />
                            </div>

                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">ที่อยู่ธุรกิจ</label>
                                <textarea
                                    name="address"
                                    value={formData.address || ""}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="ที่อยู่สำหรับออกใบแจ้งหนี้ / ใบเสร็จรับเงิน..."
                                    className="w-full border border-slate-300 rounded-md py-2.5 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                                />
                            </div>

                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">ลิงก์ตำแหน่งร้าน (Google Maps)</label>
                                <input
                                    type="url"
                                    name="googleMapUrl"
                                    value={formData.googleMapUrl || ""}
                                    onChange={handleChange}
                                    placeholder="https://maps.app.goo.gl/..."
                                    className="w-full border border-slate-300 rounded-md py-2.5 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-blue-700"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex justify-end space-x-3">
                        <Link
                            href="/liff"
                            className="inline-flex items-center justify-center rounded-md bg-white border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            ยกเลิก
                        </Link>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center justify-center rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
                        >
                            {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                            อัปเดตข้อมูลคู่ค้า
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
