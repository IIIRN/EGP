"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Save, Loader2 } from "lucide-react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function CreateProjectPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        projectNo: "",
        code: "",
        location: "",
        budget: "",
        status: "planning"
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.code) {
            alert("กรุณากรอกข้อมูลชื่อและรหัสโครงการให้ครบถ้วน");
            return;
        }

        setSaving(true);

        try {
            const newProject = {
                name: formData.name,
                projectNo: formData.projectNo || "",
                code: formData.code,
                location: formData.location || "",
                budget: formData.budget ? parseFloat(formData.budget) : 0,
                status: formData.status,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await addDoc(collection(db, "projects"), newProject);

            router.push("/projects");
        } catch (error) {
            console.error("Error adding project:", error);
            alert("ไม่สามารถสร้างโครงการได้ โปรดลองอีกครั้ง");
            setSaving(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">

            <div className="flex items-center space-x-4">
                <Link href="/projects" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">สร้างโครงการใหม่</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        เริ่มต้นติดตามงบประมาณและการจัดซื้อสำหรับโครงการก่อสร้างใหม่
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
                            <h3 className="text-lg font-semibold text-slate-800">ข้อมูลโครงการก่อสร้าง</h3>
                            <p className="text-sm text-slate-500">กำหนดรายละเอียดพื้นฐานของโครงการสำหรับการติดตาม</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อโครงการ <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="name"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="เช่น โครงการก่อสร้างอาคารชุดพักอาศัย A"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">เลขที่โครงการ (Project No.)</label>
                            <input
                                type="text"
                                name="projectNo"
                                value={formData.projectNo}
                                onChange={handleChange}
                                placeholder="เช่น P-001 (ถ้าระบุ)"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">รหัสโครงการ (Project Code) <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="code"
                                required
                                value={formData.code}
                                onChange={handleChange}
                                placeholder="เช่น PRJ-2026-X01"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">สถานะโครงการ</label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            >
                                <option value="planning">กำลังวางแผน (Planning)</option>
                                <option value="in_progress">กำลังดำเนินการ (In Progress)</option>
                                <option value="on_hold">ระงับชั่วคราว (On Hold)</option>
                                <option value="completed">เสร็จสิ้น (Completed)</option>
                            </select>
                        </div>

                    </div>

                    <hr className="border-slate-100 my-6" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">งบประมาณก่อสร้างรวม (Total Budget)</label>
                            <div className="relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-slate-500 sm:text-sm">฿</span>
                                </div>
                                <input
                                    type="number"
                                    name="budget"
                                    min="0"
                                    step="0.01"
                                    value={formData.budget}
                                    onChange={handleChange}
                                    className="block w-full pl-8 pr-12 border-slate-300 rounded-lg py-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm border"
                                    placeholder="0.00"
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <span className="text-slate-500 sm:text-sm">บาท</span>
                                </div>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">มูลค่ารวมของโครงการ (ไม่รวมงานเพิ่ม-ลดในอนาคต)</p>
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">สถานที่ตั้งโครงการ</label>
                            <textarea
                                name="location"
                                value={formData.location}
                                onChange={handleChange}
                                rows={2}
                                placeholder="ระบุเขต/แขวง หรือที่ตั้งไซต์งาน..."
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>
                    </div>

                </div>

                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end space-x-3">
                    <Link
                        href="/projects"
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
                        สร้างโครงการ
                    </button>
                </div>
            </form>

        </div>
    );
}
