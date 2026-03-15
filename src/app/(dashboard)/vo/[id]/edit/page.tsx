"use client";

import { use, useEffect, useState, ChangeEvent } from "react";
import { useProject } from "@/context/ProjectContext";
import { ArrowLeft, Save, Send, Plus, Loader2, FileEdit, Upload, Download } from "lucide-react";
import Link from "next/link";
import { VOItem, VariationOrder } from "@/types/vo";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { parseDocumentItemsCsv, downloadDocumentItemsCsvTemplate } from "@/lib/documentItems";

export default function EditVOPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const { currentProject } = useProject();
    const { user } = useAuth();
    const router = useRouter();

    const [vo, setVo] = useState<VariationOrder | null>(null);
    const [loading, setLoading] = useState(true);

    const today = new Date().toISOString().slice(0, 10);
    const [voNumber, setVoNumber] = useState("");
    const [title, setTitle] = useState("");
    const [reason, setReason] = useState("");
    const [createdDate, setCreatedDate] = useState(today);
    const [issueDate, setIssueDate] = useState(today);
    const [items, setItems] = useState<Partial<VOItem>[]>([
        { id: "1", description: "", quantity: 1, unit: "งาน", unitPrice: 0, amount: 0, type: "add" }
    ]);

    const [vatRate, setVatRate] = useState(7);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        async function fetchVO() {
            if (!resolvedParams.id || !currentProject) return;
            try {
                const docRef = doc(db, "variation_orders", resolvedParams.id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = { id: docSnap.id, ...docSnap.data() } as VariationOrder;

                    // Only allow editing if draft or rejected
                    if (data.status !== 'draft' && data.status !== 'rejected') {
                        alert("ใบสั่งเปลี่ยนงานนี้อยู่ในสถานะที่ไม่สามารถแก้ไขได้");
                        router.push(`/vo/${data.id}`);
                        return;
                    }

                    setVo(data);
                    setVoNumber(data.voNumber || "");
                    setTitle(data.title || "");
                    setReason(data.reason || "");
                    setCreatedDate(formatDateForInput(data.createdAt) || today);
                    setIssueDate(data.issueDate || formatDateForInput(data.createdAt) || today);
                    setVatRate(data.vatRate || 7);

                    if (data.items && data.items.length > 0) {
                        setItems(data.items);
                    }
                } else {
                    console.error("No such document!");
                    alert("ไม่พบข้อมูลใบสั่งเปลี่ยนงาน");
                    router.push("/vo");
                }
            } catch (error) {
                console.error("Error fetching VO:", error);
            } finally {
                setLoading(false);
            }
        }

        if (currentProject) {
            fetchVO();
        } else {
            setLoading(false); // If no project, the project check condition will render the warning.
        }
    }, [resolvedParams.id, router, currentProject, today]);

    const handleAddItem = () => {
        setItems([
            ...items,
            { id: Date.now().toString(), description: "", quantity: 1, unit: "งาน", unitPrice: 0, amount: 0, type: "add" }
        ]);
    };

    const handleItemChange = (id: string, field: keyof VOItem, value: string | number) => {
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

    const handleImportCsv = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const inputRef = event.target;
        const reader = new FileReader();

        reader.onload = () => {
            try {
                const content = String(reader.result || "");
                const importedRows = parseDocumentItemsCsv(content);

                if (importedRows.length === 0) {
                    alert("ไม่พบข้อมูลรายการในไฟล์ CSV");
                    return;
                }

                const mappedItems = importedRows.map((row, index) => ({
                    id: `csv-${Date.now()}-${index}`,
                    description: row.description,
                    quantity: row.quantity || 1,
                    unit: row.unit,
                    unitPrice: row.unitPrice,
                    amount: row.amount || (row.quantity || 1) * row.unitPrice,
                    type: "add" as const,
                }));

                setItems(mappedItems);
                alert(`นำเข้า CSV สำเร็จ ${mappedItems.length} รายการ`);
            } catch (error) {
                console.error("CSV import error:", error);
                alert("ไม่สามารถอ่านไฟล์ CSV ได้ กรุณาตรวจสอบรูปแบบไฟล์");
            } finally {
                inputRef.value = "";
            }
        };

        reader.onerror = () => {
            alert("เกิดข้อผิดพลาดระหว่างอ่านไฟล์ CSV");
            inputRef.value = "";
        };

        reader.readAsText(file, "utf-8");
    };

    const handleDownloadCsvSample = () => {
        downloadDocumentItemsCsvTemplate("vo-items-sample.csv");
    };

    // Calculate VO Totals
    // Adds increase cost, Omits reduce cost
    const subTotal = items.reduce((sum, item) => {
        const amt = item.amount || 0;
        return sum + (item.type === 'add' ? amt : -amt);
    }, 0);

    const vatAmount = (subTotal * vatRate) / 100;
    const totalAmount = subTotal + vatAmount;

    const formatDateForInput = (value: unknown) => {
        try {
            if (value && typeof value === "object" && "toDate" in value) {
                const timestamp = value as { toDate?: () => Date };
                if (typeof timestamp.toDate === "function") {
                    return timestamp.toDate().toISOString().slice(0, 10);
                }
            }
            if (value && typeof value === "object" && "seconds" in value) {
                const unixTimestamp = value as { seconds?: number; nanoseconds?: number };
                if (typeof unixTimestamp.seconds === "number") {
                    const millis = (unixTimestamp.seconds * 1000) + Math.floor((unixTimestamp.nanoseconds ?? 0) / 1_000_000);
                    return new Date(millis).toISOString().slice(0, 10);
                }
            }
            if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
                const date = new Date(value);
                if (!Number.isNaN(date.getTime())) {
                    return date.toISOString().slice(0, 10);
                }
            }
        } catch {
            return "";
        }
        return "";
    };

    const formatCreatedAt = (value: unknown) => {
        try {
            if (value && typeof value === "object" && "toDate" in value) {
                const timestamp = value as { toDate?: () => Date };
                if (typeof timestamp.toDate === "function") {
                    return timestamp.toDate().toLocaleDateString("th-TH");
                }
            }
            if (value && typeof value === "object" && "seconds" in value) {
                const unixTimestamp = value as { seconds?: number; nanoseconds?: number };
                if (typeof unixTimestamp.seconds === "number") {
                    const millis = (unixTimestamp.seconds * 1000) + Math.floor((unixTimestamp.nanoseconds ?? 0) / 1_000_000);
                    return new Date(millis).toLocaleDateString("th-TH");
                }
            }
            if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
                const date = new Date(value);
                if (!Number.isNaN(date.getTime())) {
                    return date.toLocaleDateString("th-TH");
                }
            }
        } catch {
            // Ignore malformed date values and fallback.
        }
        return "ไม่ระบุ";
    };

    const handleUpdateVO = async (status: "draft" | "pending") => {
        if (!currentProject || !user) return;

        if (!title.trim()) {
            alert("กรุณาระบุหัวข้องานเพิ่ม-ลด");
            return;
        }

        if (!voNumber.trim()) {
            alert("กรุณาระบุเลขที่ VO");
            return;
        }

        setSaving(true);

        try {
            const sanitizedItems = items.map(item => ({
                id: item.id || Date.now().toString(),
                description: item.description || "",
                quantity: Number(item.quantity) || 0,
                unit: item.unit || "",
                unitPrice: Number(item.unitPrice) || 0,
                amount: Number(item.amount) || 0,
                type: item.type || "add"
            }));

            const updatedVO = {
                voNumber: voNumber.trim(),
                issueDate,
                title,
                reason,
                items: sanitizedItems as VOItem[],
                subTotal,
                vatRate,
                vatAmount,
                totalAmount,
                status: status,
                createdAt: Timestamp.fromDate(new Date(`${createdDate}T00:00:00`)),
                updatedAt: serverTimestamp(),
            };

            const voRef = doc(db, "variation_orders", resolvedParams.id);
            await updateDoc(voRef, updatedVO);
            if (status === "pending") {
                try {
                    await fetch("/api/line/notify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "VO",
                            data: { ...updatedVO, id: resolvedParams.id, voNumber: voNumber.trim() || vo?.voNumber || "N/A" },
                            projectName: currentProject.name,
                        }),
                    });
                } catch (e) {
                    console.error("Line notification failed:", e);
                }
            }

            setSuccess(true);
            setTimeout(() => {
                router.push(`/vo/${resolvedParams.id}`);
            }, 2000);

        } catch (error) {
            console.error("Error updating VO:", error);
            alert("อัปเดตข้อมูลไม่สำเร็จ โปรดตรวจสอบหน้าต่าง Console");
            setSaving(false);
        }
    };

    if (!currentProject) {
        return (
            <div className="bg-orange-50 border border-orange-200 text-orange-800 p-6 rounded-lg text-center flex flex-col items-center">
                <FileEdit className="w-12 h-12 text-orange-500 mb-3" />
                <h3 className="font-bold text-lg">ยังไม่ได้เลือกโครงการ</h3>
                <p className="mb-4">คุณต้องเลือกโครงการจากเมนูด้านบนก่อนแก้ไขรายการงานเพิ่ม-ลด (VO)</p>
                <Link href="/dashboard" className="bg-orange-500 text-white px-4 py-2 rounded shadow hover:bg-orange-600 transition">
                    กลับไปที่หน้าหลัก
                </Link>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="animate-spin w-8 h-8 text-orange-600 mb-4" />
                <p className="text-slate-500">กำลังโหลดข้อมูลงานเพิ่ม-ลดสำหรับการแก้ไข...</p>
            </div>
        );
    }

    if (!vo) return null; // handled in useEffect

    return (
        <div className="max-w-5xl mx-auto space-y-6">

            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link href={`/vo/${vo.id}`} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">แก้ไขงานเพิ่ม-ลด</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {vo.voNumber} • โครงการ: <span className="font-semibold text-blue-600">{currentProject.name}</span> ({currentProject.code})
                        </p>
                    </div>
                </div>

                <div className="flex space-x-3">
                    <button
                        onClick={() => handleUpdateVO("draft")}
                        disabled={saving || success}
                        className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                        <Save size={16} className="mr-2" />
                        บันทึกฉบับร่าง
                    </button>
                    <button
                        onClick={() => handleUpdateVO("pending")}
                        disabled={saving || success}
                        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition-colors"
                    >
                        {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}
                        {success ? "สำเร็จ!" : "ส่งขออนุมัติใหม่อีกครั้ง"}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 space-y-8">

                    {/* Section 1: General Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">เลขที่ VO <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={voNumber}
                                onChange={(e) => setVoNumber(e.target.value)}
                                placeholder="VO403-202603-P001"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

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

                        <div className="col-span-2 md:col-span-1 grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">วันที่สร้าง</label>
                                <input
                                    type="date"
                                    value={createdDate}
                                    onChange={(e) => setCreatedDate(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm text-slate-600 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                />
                                <p className="mt-1 text-xs text-slate-500">ค่าเดิม: {formatCreatedAt(vo.createdAt)}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">วันที่ออกเอกสาร</label>
                                <input
                                    type="date"
                                    value={issueDate}
                                    onChange={(e) => setIssueDate(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm text-slate-600 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                />
                            </div>
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
                            <div className="bg-slate-50 p-3 border-t border-slate-200 flex flex-col gap-2 sm:flex-row sm:items-center">
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium px-2 py-1 flex items-center"
                                >
                                    <Plus size={16} className="mr-1" /> เพิ่มรายการใหม่
                                </button>
                                <label className="text-sm text-blue-600 hover:text-blue-800 font-medium px-2 py-1 flex items-center cursor-pointer">
                                    <Upload size={16} className="mr-1" /> นำเข้า CSV
                                    <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCsv} />
                                </label>
                                <button
                                    type="button"
                                    onClick={handleDownloadCsvSample}
                                    className="text-sm text-slate-600 hover:text-slate-900 font-medium px-2 py-1 flex items-center"
                                >
                                    <Download size={16} className="mr-1" /> ตัวอย่าง CSV
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
