"use client";

import { useProject } from "@/context/ProjectContext";
import { ArrowLeft, Save, Send, Plus, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { POItem } from "@/types/po";
import { useAuth } from "@/context/AuthContext";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Vendor } from "@/types/vendor";

export default function LiffCreatePOPage() {
    const { currentProject } = useProject();
    const { user, userProfile } = useAuth();
    const router = useRouter();

    const [items, setItems] = useState<Partial<POItem>[]>([
        { id: "1", description: "", quantity: 1, unit: "ชิ้น", unitPrice: 0, amount: 0 }
    ]);

    const [vendorId, setVendorId] = useState("");
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [vatRate, setVatRate] = useState(7);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        async function fetchVendors() {
            try {
                const q = query(collection(db, "vendors"), where("isActive", "==", true));
                const snapshot = await getDocs(q);
                const vendorList: Vendor[] = [];
                snapshot.forEach(doc => {
                    vendorList.push({ id: doc.id, ...doc.data() } as Vendor);
                });
                setVendors(vendorList.sort((a, b) => a.name.localeCompare(b.name)));
            } catch (error) {
                console.error("Error fetching vendors:", error);
            }
        }
        fetchVendors();
    }, []);

    const handleAddItem = () => {
        setItems([
            ...items,
            { id: Date.now().toString(), description: "", quantity: 1, unit: "ชิ้น", unitPrice: 0, amount: 0 }
        ]);
    };

    const handleItemChange = (id: string, field: keyof POItem, value: any) => {
        const newItems = items.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                if (field === 'quantity' || field === 'unitPrice') {
                    updated.amount = (Number(updated.quantity) || 0) * (Number(updated.unitPrice) || 0);
                }
                return updated;
            }
            return item;
        });
        setItems(newItems);
    };

    const removeItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const subTotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const vatAmount = (subTotal * vatRate) / 100;
    const totalAmount = subTotal + vatAmount;

    const handleSavePO = async (status: "draft" | "pending") => {
        if (!currentProject) {
            alert("ไม่พบข้อมูลโครงการ");
            return;
        }

        if (!user) {
            alert("ไม่พบข้อมูลผู้ใช้งาน");
            return;
        }

        if (!vendorId) {
            alert("กรุณาเลือกผู้ขาย/คู่ค้า");
            return;
        }

        setSaving(true);

        try {
            const generatePoNumber = `PO-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

            const selectedVendor = vendors.find(v => v.id === vendorId);

            const sanitizedItems = items.map(item => ({
                id: item.id || Date.now().toString(),
                description: item.description || "",
                quantity: Number(item.quantity) || 0,
                unit: item.unit || "",
                unitPrice: Number(item.unitPrice) || 0,
                amount: Number(item.amount) || 0
            }));

            const createdByUid = userProfile?.uid || user.uid;

            const newPO = {
                poNumber: generatePoNumber,
                projectId: currentProject.id,
                vendorId: vendorId || "unknown",
                vendorName: selectedVendor ? selectedVendor.name : "ไม่ระบุผู้ขาย",
                items: sanitizedItems,
                subTotal,
                vatRate,
                vatAmount,
                totalAmount,
                status: status,
                createdBy: createdByUid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            await addDoc(collection(db, "purchase_orders"), newPO);

            setSuccess(true);
            setTimeout(() => {
                router.push("/liff");
            }, 2000);

        } catch (error) {
            console.error("Error saving PO:", error);
            alert("บันทึกข้อมูลไม่สำเร็จ");
            setSaving(false);
        }
    };

    if (!currentProject) {
        return (
            <div className="flex flex-col items-center justify-center p-8 h-screen bg-slate-50 text-center">
                <p className="text-slate-500 mb-6 text-sm">กรุณารอสักครู่ กำลังโหลดโครงการ...</p>
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-blue-600 text-white p-4 pt-6 shadow-md sticky top-0 z-40 flex items-center">
                <Link href="/liff" className="mr-3 p-1 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-lg font-bold leading-tight">สร้างใบสั่งซื้อ (PO)</h1>
                    <p className="text-xs text-blue-100">{currentProject.name}</p>
                </div>
            </div>

            <main className="p-4 space-y-6">

                {/* Vendor Select */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <label className="block text-sm font-bold text-slate-800 mb-2">เลือกร้านค้า / คู่ค้า <span className="text-red-500">*</span></label>
                    <select
                        value={vendorId}
                        onChange={(e) => setVendorId(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg py-3 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                        <option value="" disabled>-- กรุณาเลือกร้านค้า --</option>
                        {vendors.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                    </select>
                </div>

                {/* Items List */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-800 text-sm">รายการสิ่งของ</h3>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {items.map((item, index) => (
                            <div key={item.id} className="p-4 space-y-3 relative">
                                <div className="absolute top-4 right-4 text-xs font-bold text-slate-300">
                                    #{index + 1}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">ชื่อรายการ</label>
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => handleItemChange(item.id!, 'description', e.target.value)}
                                        placeholder="เช่น ปูนซีเมนต์ฉาบ"
                                        className="w-full text-sm border border-slate-200 rounded-lg py-2 px-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">จำนวน</label>
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(item.id!, 'quantity', Number(e.target.value))}
                                            className="w-full text-sm border border-slate-200 rounded-lg py-2 px-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">หน่วย</label>
                                        <input
                                            type="text"
                                            value={item.unit}
                                            onChange={(e) => handleItemChange(item.id!, 'unit', e.target.value)}
                                            className="w-full text-sm border border-slate-200 rounded-lg py-2 px-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2 items-end">
                                    <div className="flex-[2]">
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">ราคา/หน่วย</label>
                                        <input
                                            type="number"
                                            value={item.unitPrice}
                                            onChange={(e) => handleItemChange(item.id!, 'unitPrice', Number(e.target.value))}
                                            className="w-full text-sm border border-slate-200 rounded-lg py-2 px-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="flex-[2]">
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">รวม (บาท)</label>
                                        <div className="w-full text-sm border border-slate-100 bg-slate-50 rounded-lg py-2 px-3 font-semibold text-slate-700 text-right">
                                            {(item.amount || 0).toLocaleString()}
                                        </div>
                                    </div>
                                    {items.length > 1 && (
                                        <div className="flex-none">
                                            <button
                                                onClick={() => removeItem(item.id!)}
                                                className="h-[38px] w-[38px] flex items-center justify-center bg-red-50 text-red-500 rounded-lg border border-red-100"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-3 bg-slate-50 border-t border-slate-100">
                        <button
                            onClick={handleAddItem}
                            className="w-full py-2 flex items-center justify-center text-sm font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                            <Plus size={16} className="mr-1" /> เพิ่มรายการสิ่งของ
                        </button>
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-800">ราคาสุทธิ (รวม VAT แล้ว)</span>
                        <span className="text-lg font-bold text-blue-600">฿{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                        <span>ก่อน VAT: ฿{subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span>VAT ({vatRate}%): ฿{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>

                {/* Action Buttons Spacer */}
                <div className="h-4"></div>
            </main>

            {/* Fixed Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 bg-white p-4 border-t border-slate-200 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-50 flex gap-3 pb-8">
                <button
                    onClick={() => handleSavePO("draft")}
                    disabled={saving || success}
                    className="flex-1 flex justify-center items-center py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                >
                    <Save size={18} className="mr-2 text-slate-500" />
                    บันทึกฉบับร่าง
                </button>
                <button
                    onClick={() => handleSavePO("pending")}
                    disabled={saving || success}
                    className="flex-[1.5] flex justify-center items-center py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-200 hover:bg-blue-500 transition-colors"
                >
                    {saving ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Send size={18} className="mr-2" />}
                    {success ? "สำเร็จ!" : "ส่งขออนุมัติ"}
                </button>
            </div>
        </div>
    );
}
