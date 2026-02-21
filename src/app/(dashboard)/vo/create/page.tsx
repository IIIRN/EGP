"use client";

import { useProject } from "@/context/ProjectContext";
import { ArrowLeft, Save, Send, Plus, Loader2, FileEdit } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { VOItem } from "@/types/vo";
import { useAuth } from "@/context/AuthContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function CreateVOPage() {
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

    // Calculate VO Totals
    // Adds increase cost, Omits reduce cost
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

            await addDoc(collection(db, "variation_orders"), newVO);

            setSuccess(true);
            setTimeout(() => {
                router.push("/vo");
            }, 2000);

        } catch (error) {
            console.error("Error saving VO:", error);
            alert("บันทึกข้อมูลไม่สำเร็จ โปรดตรวจสอบหน้าต่าง Console");
            setSaving(false);
        }
    };

    if (!currentProject) {
        return (
            <div className="bg-orange-50 border border-orange-200 text-orange-800 p-6 rounded-lg text-center flex flex-col items-center">
                <FileEdit className="w-12 h-12 text-orange-500 mb-3" />
                <h3 className="font-bold text-lg">ยังไม่ได้เลือกโครงการ</h3>
                <p className="mb-4">คุณต้องเลือกโครงการจากเมนูด้านบนก่อนสร้างรายการงานเพิ่ม-ลด (VO)</p>
                <Link href="/dashboard" className="bg-orange-500 text-white px-4 py-2 rounded shadow hover:bg-orange-600 transition">
                    กลับไปที่หน้าหลัก
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">

            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link href="/vo" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">สร้างงานเพิ่ม-ลด (Variation Order)</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            โครงการ: <span className="font-semibold text-blue-600">{currentProject.name}</span> ({currentProject.code})
                        </p>
                    </div>
                </div>

                <div className="flex space-x-3">
                    <button
                        onClick={() => handleSaveVO("draft")}
                        disabled={saving || success}
                        className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                        <Save size={16} className="mr-2" />
                        บันทึกฉบับร่าง
                    </button>
                    <button
                        onClick={() => handleSaveVO("pending")}
                        disabled={saving || success}
                        className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50 transition-colors"
                    >
                        {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}
                        {success ? "สำเร็จ!" : "ส่งขออนุมัติดำเนินการ"}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 space-y-8">

                    {/* Section 1: General Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">หัวข้องาน <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="เช่น ขอเพิ่มไฟ LED บริเวณโถงนิทรรศการ"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white placeholder-slate-400"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">สาเหตุความจำเป็นในการแก้ไขงาน</label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={3}
                                placeholder="อธิบายสาเหตุที่ต้องมีการเพิ่ม หรือลดเนื้องานจากสัญญาหลัก..."
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white placeholder-slate-400"
                            />
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Section 2: Items */}
                    <div>
                        <div className="flex justify-between items-end mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">รายการงานที่สั่งแก้ไข</h3>
                        </div>

                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">ลำดับ</th>
                                        <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">ประเภท</th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-2/5">รายการงาน / วัสดุ</th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">จำนวน</th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">หน่วย</th>
                                        <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">ราคา/หน่วย</th>
                                        <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">มูลค่าตามงบ</th>
                                        <th scope="col" className="px-4 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100">
                                    {items.map((item, index) => (
                                        <tr key={item.id} className="group">
                                            <td className="px-4 py-3 text-sm text-slate-400 font-medium">{index + 1}</td>

                                            <td className="px-4 py-3">
                                                <select
                                                    value={item.type}
                                                    onChange={(e) => handleItemChange(item.id!, 'type', e.target.value)}
                                                    className={`text-xs border rounded-md py-1 px-1 font-semibold ${item.type === 'add' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}
                                                >
                                                    <option value="add">เพิ่ม (Add)</option>
                                                    <option value="omit">ลด (Omit)</option>
                                                </select>
                                            </td>

                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={item.description}
                                                    onChange={(e) => handleItemChange(item.id!, 'description', e.target.value)}
                                                    placeholder="เช่น โคมไฟดาวน์ไลท์พร้อมติดตั้ง"
                                                    className="w-full text-sm border-0 bg-transparent focus:ring-0 p-0 text-slate-900 placeholder-slate-300"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(item.id!, 'quantity', Number(e.target.value))}
                                                    className="w-16 text-sm border border-slate-200 rounded py-1 px-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={item.unit}
                                                    onChange={(e) => handleItemChange(item.id!, 'unit', e.target.value)}
                                                    className="w-16 text-sm border border-slate-200 rounded py-1 px-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <input
                                                    type="number"
                                                    value={item.unitPrice}
                                                    onChange={(e) => handleItemChange(item.id!, 'unitPrice', Number(e.target.value))}
                                                    className="w-24 text-sm text-right border border-slate-200 rounded py-1 px-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-medium">
                                                <span className={item.type === 'add' ? 'text-red-600' : 'text-green-600'}>
                                                    {item.type === 'add' ? '+' : '-'}{(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => removeItem(item.id!)}
                                                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    ✕
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="bg-slate-50 p-3 border-t border-slate-200 flex space-x-4">
                                <button
                                    onClick={handleAddItem}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium px-2 py-1 flex items-center"
                                >
                                    <Plus size={16} className="mr-1" /> เพิ่มรายการใหม่
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Summary Totals */}
                    <div className="flex justify-end pt-6">
                        <div className="w-96 space-y-3 bg-slate-50 p-6 rounded-xl border border-slate-100">
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>ยอดรวมผลกระทบสุทธิ (Subtotal)</span>
                                <span className={`font-medium ${subTotal > 0 ? 'text-red-600' : subTotal < 0 ? 'text-green-600' : 'text-slate-900'}`}>
                                    {subTotal > 0 ? '+' : ''}฿ {subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600 items-center">
                                <span>ภาษีมูลค่าเพิ่ม (VAT {vatRate}%)</span>
                                <span className={`font-medium ${vatAmount > 0 ? 'text-red-500' : vatAmount < 0 ? 'text-green-500' : 'text-slate-900'}`}>
                                    {vatAmount > 0 ? '+' : ''}฿ {vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="flex justify-between text-base pt-3 border-t border-slate-200">
                                <span className="font-bold text-slate-900">สรุปการเปลี่ยนแปลงงบประมาณ</span>
                                <span className={`font-bold ${totalAmount > 0 ? 'text-red-600' : totalAmount < 0 ? 'text-green-600' : 'text-slate-900'}`}>
                                    {totalAmount > 0 ? '+' : ''}฿ {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 text-right mt-1">
                                (+ สีแดง: งานเพิ่มเสียเงินเพิ่ม, - สีเขียว: งานลดประหยัดงบ)
                            </p>
                        </div>
                    </div>

                </div>
            </div>

        </div>
    );
}
