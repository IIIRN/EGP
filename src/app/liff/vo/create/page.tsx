"use client";

import { useProject } from "@/context/ProjectContext";
import { ArrowLeft, Save, Send, Plus, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { VOItem } from "@/types/vo";
import { useAuth } from "@/context/AuthContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function LiffCreateVOPage() {
    const { currentProject } = useProject();
    const { user, userProfile } = useAuth();
    const router = useRouter();

    const [title, setTitle] = useState("");
    const [reason, setReason] = useState("");
    const [items, setItems] = useState<Partial<VOItem>[]>([
        { id: "1", description: "", quantity: 1, unit: "งาน", unitPrice: 0, amount: 0, type: "add" }
    ]);

    const [vatRate, setVatRate] = useState(7);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleAddItem = () => {
        setItems([
            ...items,
            { id: Date.now().toString(), description: "", quantity: 1, unit: "งาน", unitPrice: 0, amount: 0, type: "add" }
        ]);
    };

    const handleItemChange = (id: string, field: keyof VOItem, value: any) => {
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

    const subTotal = items.reduce((sum, item) => {
        const amt = item.amount || 0;
        return sum + (item.type === 'add' ? amt : -amt);
    }, 0);

    const vatAmount = (subTotal * vatRate) / 100;
    const totalAmount = subTotal + vatAmount;

    const handleSaveVO = async (status: "draft" | "pending") => {
        if (!currentProject || (!user && !userProfile)) return;

        const creatorId = userProfile?.uid || user?.uid || "unknown";

        if (!title.trim()) {
            alert("กรุณาระบุหัวข้องานเพิ่ม-ลด");
            return;
        }

        setSaving(true);

        try {
            const generateVoNumber = `VO-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;

            const newVO = {
                voNumber: generateVoNumber,
                projectId: currentProject.id,
                title,
                reason,
                items: items as VOItem[],
                subTotal,
                vatRate,
                vatAmount,
                totalAmount,
                status: status,
                createdBy: creatorId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            const docRef = await addDoc(collection(db, "variation_orders"), newVO);

            if (status === "pending") {
                try {
                    await fetch("/api/line/notify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "VO",
                            data: { ...newVO, id: docRef.id },
                            projectName: currentProject.name
                        })
                    });
                } catch (e) {
                    console.error("Line notification failed:", e);
                }
            }

            setSuccess(true);
            setTimeout(() => {
                router.push("/liff");
            }, 2000);

        } catch (error) {
            console.error("Error saving VO:", error);
            alert("บันทึกข้อมูลไม่สำเร็จ");
            setSaving(false);
        }
    };

    if (!currentProject) {
        return (
            <div className="flex flex-col items-center justify-center p-8 h-screen bg-slate-50 text-center">
                <p className="text-slate-500 mb-6 text-sm">กรุณารอสักครู่ กำลังโหลดโครงการ...</p>
                <Loader2 className="animate-spin text-orange-500" size={32} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-orange-600 text-white p-4 pt-6 shadow-md sticky top-0 z-40 flex items-center">
                <Link href="/liff" className="mr-3 p-1 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-lg font-bold leading-tight">สร้างงานเพิ่ม-ลด (VO)</h1>
                    <p className="text-xs text-orange-100">{currentProject.name}</p>
                </div>
            </div>

            <main className="p-4 space-y-6">

                {/* General Info */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-800 mb-2">หัวข้องาน <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="เช่น ขอเพิ่มไฟ LED บริเวณโถงนิทรรศการ"
                            className="w-full border border-slate-300 rounded-lg py-3 px-3 text-sm focus:ring-orange-500 focus:border-orange-500 bg-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-800 mb-2">สาเหตุความจำเป็น</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            placeholder="อธิบายสรุปสั้นๆ..."
                            className="w-full border border-slate-300 rounded-lg py-3 px-3 text-sm focus:ring-orange-500 focus:border-orange-500 bg-white"
                        />
                    </div>
                </div>

                {/* Items List */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-800 text-sm">รายการงาน/วัสดุที่แก้ไข</h3>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {items.map((item, index) => (
                            <div key={item.id} className="p-4 space-y-4 relative">
                                <div className="absolute top-4 right-4 text-xs font-bold text-slate-300">
                                    #{index + 1}
                                </div>

                                <div className="flex gap-2 w-3/4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">ประเภท</label>
                                        <select
                                            value={item.type}
                                            onChange={(e) => handleItemChange(item.id!, 'type', e.target.value)}
                                            className={`w-full text-xs border rounded-lg py-2.5 px-2 font-bold focus:ring-0 ${item.type === 'add' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}
                                        >
                                            <option value="add">เพิ่มค่าใช้จ่าย</option>
                                            <option value="omit">ลดค่าใช้จ่าย</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">รายละเอียดงาน</label>
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => handleItemChange(item.id!, 'description', e.target.value)}
                                        placeholder="เช่น โคมไฟดาวน์ไลท์พร้อมติดตั้ง"
                                        className="w-full text-sm border border-slate-200 rounded-lg py-2.5 px-3 focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">จำนวน</label>
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(item.id!, 'quantity', Number(e.target.value))}
                                            className="w-full text-sm border border-slate-200 rounded-lg py-2.5 px-3 focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">หน่วย</label>
                                        <input
                                            type="text"
                                            value={item.unit}
                                            onChange={(e) => handleItemChange(item.id!, 'unit', e.target.value)}
                                            className="w-full text-sm border border-slate-200 rounded-lg py-2.5 px-3 focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
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
                                            className="w-full text-sm border border-slate-200 rounded-lg py-2.5 px-3 focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                                        />
                                    </div>
                                    <div className="flex-[2]">
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">รวมผลกระทบ</label>
                                        <div className={`w-full text-sm border border-slate-100 rounded-lg py-2 px-3 font-semibold text-right ${item.type === 'add' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                            {item.type === 'add' ? '+' : '-'}{(item.amount || 0).toLocaleString()}
                                        </div>
                                    </div>
                                    {items.length > 1 && (
                                        <div className="flex-none">
                                            <button
                                                onClick={() => removeItem(item.id!)}
                                                className="h-[42px] w-[42px] flex items-center justify-center bg-slate-50 text-slate-400 rounded-lg border border-slate-200 hover:text-red-500"
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
                            className="w-full py-2.5 flex items-center justify-center text-sm font-semibold text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                        >
                            <Plus size={16} className="mr-1" /> เพิ่มรายการใหม่
                        </button>
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-800">สรุปการเปลี่ยนแปลงงบประมาณ</span>
                        <span className={`text-lg font-bold ${totalAmount > 0 ? 'text-red-500' : totalAmount < 0 ? 'text-green-500' : 'text-slate-900'}`}>
                            {totalAmount > 0 ? '+' : ''}฿ {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                        <span>ผลกระทบ (ยังไม่รวม VAT): ฿ {subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>

                {/* Action Buttons Spacer */}
                <div className="h-4"></div>
            </main>

            {/* Fixed Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 bg-white p-4 border-t border-slate-200 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-50 flex gap-3 pb-8">
                <button
                    onClick={() => handleSaveVO("draft")}
                    disabled={saving || success}
                    className="flex-1 flex justify-center items-center py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                >
                    <Save size={18} className="mr-2 text-slate-500" />
                    บันทึกฉบับร่าง
                </button>
                <button
                    onClick={() => handleSaveVO("pending")}
                    disabled={saving || success}
                    className="flex-[1.5] flex justify-center items-center py-3 bg-orange-600 text-white rounded-xl font-bold text-sm shadow-md shadow-orange-200 hover:bg-orange-500 transition-colors"
                >
                    {saving ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Send size={18} className="mr-2" />}
                    {success ? "สำเร็จ!" : "ส่งขออนุมัติ"}
                </button>
            </div>
        </div>
    );
}
