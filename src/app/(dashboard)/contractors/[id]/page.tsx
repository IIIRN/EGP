"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save, Trash2, User } from "lucide-react";
import { deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Contractor } from "@/types/contractor";

export default function EditContractorPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [formData, setFormData] = useState<Partial<Contractor>>({
        idContractor: "",
        nickname: "",
        fullName: "",
        bankAccount: "",
        bankCode: "",
        nationalId: "",
        phone: "",
        address: "",
        yearlyLimit: 1000000,
        isActive: true,
    });

    useEffect(() => {
        async function fetchContractor() {
            if (!resolvedParams.id) return;
            try {
                const docRef = doc(db, "contractors", resolvedParams.id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data() as Partial<Contractor>;
                    setFormData({
                        idContractor: data.idContractor || "",
                        nickname: data.nickname || "",
                        fullName: data.fullName || "",
                        bankAccount: data.bankAccount || "",
                        bankCode: data.bankCode || "",
                        nationalId: data.nationalId || "",
                        phone: data.phone || "",
                        address: data.address || "",
                        yearlyLimit: data.yearlyLimit || 1000000,
                        isActive: data.isActive ?? true,
                    });
                } else {
                    alert("ไม่พบข้อมูลลูกจ้างนี้");
                    router.push("/contractors");
                }
            } catch (error) {
                console.error("Error fetching contractor:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchContractor();
    }, [resolvedParams.id, router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]:
                name === "isActive" ? value === "true" :
                    name === "yearlyLimit" ? Number(value) : value,
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.idContractor || !formData.fullName || !formData.phone) {
            alert("กรุณากรอกข้อมูลที่มีดอกจัน (*) ให้ครบถ้วน");
            return;
        }

        setSaving(true);
        try {
            await updateDoc(doc(db, "contractors", resolvedParams.id), {
                idContractor: formData.idContractor.trim(),
                nickname: (formData.nickname || "").trim(),
                fullName: formData.fullName.trim(),
                bankAccount: (formData.bankAccount || "").trim(),
                bankCode: (formData.bankCode || "").trim(),
                nationalId: (formData.nationalId || "").trim(),
                phone: formData.phone.trim(),
                address: (formData.address || "").trim(),
                yearlyLimit: formData.yearlyLimit || 1000000,
                isActive: formData.isActive ?? true,
                updatedAt: new Date().toISOString(),
            });

            router.push("/contractors");
        } catch (error) {
            console.error("Error updating contractor:", error);
            alert("ไม่สามารถบันทึกข้อมูลลูกจ้างได้ โปรดลองอีกครั้ง");
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลลูกจ้างนี้?")) return;

        setDeleting(true);
        try {
            await deleteDoc(doc(db, "contractors", resolvedParams.id));
            router.push("/contractors");
        } catch (error) {
            console.error("Error deleting contractor:", error);
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
                    <Link href="/contractors" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">แก้ไขข้อมูลลูกจ้าง</h1>
                        <p className="text-sm text-slate-500 mt-1">แก้ไขรายละเอียดลูกจ้างและสถานะการใช้งาน</p>
                    </div>
                </div>

                <button onClick={handleDelete} disabled={deleting || saving} className="inline-flex items-center justify-center rounded-lg bg-white border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50 transition-colors">
                    {deleting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Trash2 size={16} className="mr-2" />}
                    ลบข้อมูลนี้
                </button>
            </div>

            <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 md:p-8 space-y-6">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                            <User size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800">ข้อมูลลูกจ้าง</h3>
                            <p className="text-sm text-slate-500">ข้อมูลพื้นฐานและข้อมูลการเงิน</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">รหัสลูกจ้าง<span className="text-red-500">*</span></label>
                            <input type="text" name="idContractor" required value={formData.idContractor || ""} onChange={handleChange} className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อเล่น</label>
                            <input type="text" name="nickname" value={formData.nickname || ""} onChange={handleChange} className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white" />
                        </div>
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
                            <input type="text" name="fullName" required value={formData.fullName || ""} onChange={handleChange} className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">เลขบัญชี</label>
                            <input type="text" name="bankAccount" value={formData.bankAccount || ""} onChange={handleChange} className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">ธนาคาร</label>
                            <input type="text" name="bankCode" value={formData.bankCode || ""} onChange={handleChange} className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">บัตรประชาชน</label>
                            <input type="text" name="nationalId" value={formData.nationalId || ""} onChange={handleChange} className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white font-mono" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                            <input type="text" name="phone" required value={formData.phone || ""} onChange={handleChange} className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white" />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">ที่อยู่</label>
                            <textarea name="address" value={formData.address || ""} onChange={handleChange} rows={3} className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">จำกัดยอด/ปี</label>
                            <input type="number" name="yearlyLimit" value={formData.yearlyLimit || 0} onChange={handleChange} className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">สถานะใช้งาน</label>
                            <select name="isActive" value={formData.isActive ? "true" : "false"} onChange={handleChange} className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white">
                                <option value="true">เปิดใช้งาน</option>
                                <option value="false">ปิดใช้งาน</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end space-x-3">
                    <Link href="/contractors" className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
                        ยกเลิก
                    </Link>
                    <button type="submit" disabled={saving} className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition-colors">
                        {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                        อัปเดตข้อมูลลูกจ้าง
                    </button>
                </div>
            </form>
        </div>
    );
}
