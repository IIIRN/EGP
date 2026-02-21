"use client";

import { useProject } from "@/context/ProjectContext";
import { ArrowLeft, Save, Building2, UserCircle, MapPin, Loader2, Tag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Vendor } from "@/types/vendor";

export default function LiffCreateVendorPage() {
    const { currentProject } = useProject();
    const router = useRouter();

    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

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

    const handleSaveVendor = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.contactName || !formData.phone) {
            alert("กรุณากรอกข้อมูลที่มีดอกจัน (*) ให้ครบถ้วน");
            return;
        }

        setSaving(true);

        try {
            const newVendor = {
                ...formData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            await addDoc(collection(db, "vendors"), newVendor);

            setSuccess(true);
            setTimeout(() => {
                router.push("/liff");
            }, 2000);

        } catch (error) {
            console.error("Error adding vendor:", error);
            alert("บันทึกข้อมูลไม่สำเร็จ");
            setSaving(false);
        }
    };

    if (!currentProject) {
        return (
            <div className="flex flex-col items-center justify-center p-8 h-screen bg-slate-50 text-center">
                <p className="text-slate-500 mb-6 text-sm">กรุณารอสักครู่ กำลังโหลดข้อมูลโครงการ...</p>
                <Loader2 className="animate-spin text-purple-500" size={32} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-slate-800 text-white p-4 pt-6 shadow-md sticky top-0 z-40 flex items-center">
                <Link href="/liff" className="mr-3 p-1 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-lg font-bold leading-tight">เพิ่มรายชื่อคู่ค้าใหม่</h1>
                    <p className="text-xs text-slate-300">ระบบจัดการผู้ขาย/ผู้รับเหมา</p>
                </div>
            </div>

            <form onSubmit={handleSaveVendor}>
                <main className="p-4 space-y-4">

                    {/* Company Info */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                        <div className="flex items-center space-x-2 pb-2 border-b border-slate-50">
                            <Building2 size={18} className="text-slate-400" />
                            <h2 className="font-bold text-slate-700 text-sm">ข้อมูลบริษัท / นิติบุคคล</h2>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">ชื่อบริษัท / ร้านค้า <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="name"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="เช่น บจก. วัสดุก่อสร้างไทย"
                                className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-slate-500 focus:border-slate-500 transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">เลขทะเบียนนิติบุคคล (ถ้ามี)</label>
                            <input
                                type="text"
                                name="taxId"
                                value={formData.taxId}
                                onChange={handleChange}
                                placeholder="13 หลัก"
                                className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm font-mono focus:ring-slate-500 focus:border-slate-500 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Vendor Types */}
                    {availableTypes.length > 0 && (
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                            <div className="flex items-center space-x-2 pb-2 border-b border-slate-50">
                                <Tag size={18} className="text-slate-400" />
                                <h2 className="font-bold text-slate-700 text-sm">ประเภทคู่ค้า / สินค้า</h2>
                            </div>

                            <p className="text-xs text-slate-500 mb-2">เลือกประเภทเพื่อให้ค้นหาและจัดกลุ่มได้ง่ายขึ้น</p>

                            <div className="flex flex-wrap gap-2">
                                {availableTypes.map(type => {
                                    const isSelected = formData.vendorTypes?.includes(type);
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => handleTypeChange(type)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${isSelected ? 'bg-slate-800 border-slate-800 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            {type}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Contact Info */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                        <div className="flex items-center space-x-2 pb-2 border-b border-slate-50">
                            <UserCircle size={18} className="text-slate-400" />
                            <h2 className="font-bold text-slate-700 text-sm">ข้อมูลติดต่อ</h2>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">ชื่อผู้ติดต่อ / เซลส์ <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="contactName"
                                required
                                value={formData.contactName}
                                onChange={handleChange}
                                placeholder="ชื่อ-นามสกุล ของฝ่ายขาย"
                                className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-slate-500 focus:border-slate-500 transition-colors"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                                <input
                                    type="tel"
                                    name="phone"
                                    required
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="08X-XXX-XXXX"
                                    className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-slate-500 focus:border-slate-500 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">อีเมล (ถ้ามี)</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="@..."
                                    className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-slate-500 focus:border-slate-500 transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Address Info */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                        <div className="flex items-center space-x-2 pb-2 border-b border-slate-50">
                            <MapPin size={18} className="text-slate-400" />
                            <h2 className="font-bold text-slate-700 text-sm">ที่อยู่ / พิกัดร้าน</h2>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">ที่อยู่ร้าน</label>
                            <textarea
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                rows={2}
                                placeholder="บ้านเลขที่, ถนน, ตำบล..."
                                className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-slate-500 focus:border-slate-500 transition-colors leading-relaxed"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">ลิงก์ Google Map (ถ้ามี)</label>
                            <input
                                type="url"
                                name="googleMapUrl"
                                value={formData.googleMapUrl}
                                onChange={handleChange}
                                placeholder="https://maps.google.com/..."
                                className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-slate-500 focus:border-slate-500 transition-colors bg-slate-50"
                            />
                        </div>
                    </div>

                    {/* Action Buttons Spacer */}
                    <div className="h-6"></div>
                </main>

                {/* Fixed Bottom Actions */}
                <div className="fixed bottom-0 left-0 right-0 bg-white p-4 border-t border-slate-200 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-50 flex gap-3 pb-8">
                    <button
                        type="submit"
                        disabled={saving || success}
                        className="w-full flex justify-center items-center py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-md hover:bg-slate-800 transition-colors"
                    >
                        {saving ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
                        {success ? "เพิ่มคู่ค้าสำเร็จ!" : "บันทึกข้อมูลคู่ค้าใหม่"}
                    </button>
                </div>
            </form>
        </div>
    );
}
