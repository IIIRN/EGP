"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Save, Loader2, Tag } from "lucide-react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Vendor } from "@/types/vendor";

export default function CreateVendorPage() {
    const router = useRouter();
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
        isActive: true
    });

    const [availableTypes, setAvailableTypes] = useState<string[]>([]);

    useState(() => {
        async function fetchVendorTypes() {
            try {
                const docRef = doc(db, "system_settings", "global_config");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.vendorTypes) {
                        setAvailableTypes(data.vendorTypes);
                    }
                }
            } catch (error) {
                console.error("Error fetching vendor types:", error);
            }
        }
        fetchVendorTypes();
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleTypeChange = (type: string) => {
        setFormData(prev => {
            const currentTypes = prev.vendorTypes || [];
            if (currentTypes.includes(type)) {
                return { ...prev, vendorTypes: currentTypes.filter(t => t !== type) };
            } else {
                return { ...prev, vendorTypes: [...currentTypes, type] };
            }
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
            const newVendor = {
                ...formData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await addDoc(collection(db, "vendors"), newVendor);

            router.push("/vendors");
        } catch (error) {
            console.error("Error adding vendor:", error);
            alert("ไม่สามารถบันทึกข้อมูลคู่ค้าได้ โปรดลองอีกครั้ง");
            setSaving(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">

            <div className="flex items-center space-x-4">
                <Link href="/vendors" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">เพิ่มรายชื่อคู่ค้าใหม่</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        กรอกรายละเอียดบริษัทผู้ขายใหม่เข้าสู่ระบบ
                    </p>
                </div>
            </div>

            <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 md:p-8 space-y-6">

                    <div className="flex items-center space-x-3 mb-6">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800">ข้อมูลบริษัท</h3>
                            <p className="text-sm text-slate-500">รายละเอียดพื้นฐานของนิติบุคคล</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อบริษัท / ร้านค้า <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="name"
                                required
                                value={formData.name}
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
                                value={formData.taxId}
                                onChange={handleChange}
                                placeholder="เลขประจำตัวผู้เสียภาษี 13 หลัก (ถ้าระบุ)"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white font-mono"
                            />
                        </div>
                    </div>

                    {availableTypes.length > 0 && (
                        <>
                            <hr className="border-slate-100 my-6" />

                            <div className="flex items-center space-x-3 mb-4">
                                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
                                    <Tag size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-slate-800">ประเภทคูค้า / สินค้า</h3>
                                    <p className="text-sm text-slate-500">เลือกประเภทเพื่อให้ง่ายต่อการค้นหา</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {availableTypes.map(type => {
                                    const isSelected = formData.vendorTypes?.includes(type);
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => handleTypeChange(type)}
                                            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${isSelected ? 'bg-purple-100 border-purple-300 text-purple-700 shadow-sm' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            {type}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    <hr className="border-slate-100 my-6" />

                    <h3 className="text-base font-semibold text-slate-800 mb-4">ข้อมูลการติดต่อ</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อผู้ติดต่อ (เซลส์) <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="contactName"
                                required
                                value={formData.contactName}
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
                                value={formData.phone}
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
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="email@vendor.com"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">ที่อยู่ธุรกิจ</label>
                            <textarea
                                name="address"
                                value={formData.address}
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
                        บันทึกข้อมูลคู่ค้า
                    </button>
                </div>
            </form>

        </div>
    );
}
