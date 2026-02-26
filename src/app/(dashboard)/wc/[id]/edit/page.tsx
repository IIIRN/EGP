"use client";

import { use, useEffect, useState } from "react";
import { useProject } from "@/context/ProjectContext";
import { ArrowLeft, Save, FileText, Send, Plus, Loader2 } from "lucide-react";
import Link from "next/link";
import { WCItem, WorkContract } from "@/types/wc";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, updateDoc, serverTimestamp, query, collection, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Vendor } from "@/types/vendor";

export default function EditWCPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const { currentProject } = useProject();
    const { user, userProfile } = useAuth();
    const router = useRouter();

    const [wc, setWc] = useState<WorkContract | null>(null);
    const [loading, setLoading] = useState(true);

    const [items, setItems] = useState<Partial<WCItem>[]>([{ id: "1", description: "", quantity: 1, unit: "", unitPrice: 0, amount: 0 }]);
    const [vendorId, setVendorId] = useState("");
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [vatRate, setVatRate] = useState(7);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [wcNumber, setWcNumber] = useState("");
    const [title, setTitle] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [paymentTerms, setPaymentTerms] = useState("");
    const [notes, setNotes] = useState("");

    const [companySettings, setCompanySettings] = useState<any>(null);
    const [availableUnits, setAvailableUnits] = useState<string[]>([]);
    const [selectedSignatureId, setSelectedSignatureId] = useState("");

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

        async function fetchWC() {
            if (!resolvedParams.id) return;
            try {
                const docRef = doc(db, "work_contracts", resolvedParams.id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = { id: docSnap.id, ...docSnap.data() } as WorkContract;

                    if (data.status !== 'draft' && data.status !== 'rejected') {
                        alert("ใบจ้างงานนี้อยู่ในสถานะที่ไม่สามารถแก้ไขได้");
                        router.push(`/wc/${data.id}`);
                        return;
                    }

                    setWc(data);
                    setVendorId(data.vendorId || "");
                    setVatRate(data.vatRate || 7);
                    setWcNumber(data.wcNumber || "");
                    setTitle(data.title || "");
                    setStartDate(data.startDate || "");
                    setEndDate(data.endDate || "");
                    setPaymentTerms(data.paymentTerms || "");
                    setNotes(data.notes || "");

                    if (data.signatureId) setSelectedSignatureId(data.signatureId);
                    if (data.items && data.items.length > 0) setItems(data.items);
                } else {
                    alert("ไม่พบข้อมูลใบจ้างงาน");
                    router.push("/wc");
                }
            } catch (error) {
                console.error("Error fetching WC:", error);
            } finally {
                setLoading(false);
            }
        }

        async function fetchCompanySettings() {
            try {
                const configRef = doc(db, "system_settings", "global_config");
                const configSnap = await getDoc(configRef);
                if (configSnap.exists() && configSnap.data().companySettings) {
                    setCompanySettings(configSnap.data().companySettings);
                }
                if (configSnap.exists() && configSnap.data().itemUnits) {
                    setAvailableUnits(configSnap.data().itemUnits);
                }
            } catch (error) {
                console.error("Error fetching company settings:", error);
            }
        }

        fetchVendors();
        fetchWC();
        fetchCompanySettings();
    }, [resolvedParams.id, router]);

    const handleAddItem = () => {
        setItems([...items, { id: Date.now().toString(), description: "", quantity: 1, unit: "", unitPrice: 0, amount: 0 }]);
    };

    const handleItemChange = (id: string, field: keyof WCItem, value: any) => {
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

    const handleUpdateWC = async (status: "draft" | "pending") => {
        if (!currentProject) { alert("ไม่พบข้อมูลโครงการ"); return; }
        if (!user) { alert("ไม่พบข้อมูลผู้ใช้งาน"); return; }
        if (!vendorId) { alert("กรุณาเลือกผู้รับจ้าง"); return; }

        setSaving(true);

        try {
            const selectedVendor = vendors.find(v => v.id === vendorId);

            const sanitizedItems = items.map(item => ({
                id: item.id || Date.now().toString(),
                description: item.description || "",
                quantity: Number(item.quantity) || 0,
                unit: item.unit || "",
                unitPrice: Number(item.unitPrice) || 0,
                amount: Number(item.amount) || 0
            }));

            let signatureData = null;
            if (companySettings?.signatures && selectedSignatureId) {
                signatureData = companySettings.signatures.find((s: any) => s.id === selectedSignatureId) || null;
            }

            const updatedWC = {
                wcNumber: wcNumber.trim(),
                vendorId: vendorId || "unknown",
                vendorName: selectedVendor ? selectedVendor.name : "ไม่ระบุผู้รับจ้าง",
                title: title.trim(),
                items: sanitizedItems,
                subTotal,
                vatRate,
                vatAmount,
                totalAmount,
                status: status,
                startDate: startDate || "",
                endDate: endDate || "",
                paymentTerms: paymentTerms.trim(),
                notes: notes.trim(),
                signatureId: selectedSignatureId,
                signatureData: signatureData,
                updatedAt: serverTimestamp(),
            };

            const wcRef = doc(db, "work_contracts", resolvedParams.id);
            await updateDoc(wcRef, updatedWC);

            setSuccess(true);
            setTimeout(() => {
                router.push(`/wc/${resolvedParams.id}`);
            }, 2000);

        } catch (error) {
            console.error("Error updating WC:", error);
            alert("อัปเดตข้อมูลไม่สำเร็จ");
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="animate-spin w-8 h-8 text-emerald-600 mb-4" />
                <p className="text-slate-500">กำลังโหลดข้อมูลสำหรับการแก้ไข...</p>
            </div>
        );
    }

    if (!wc) return null;

    return (
        <div className="max-w-5xl mx-auto space-y-6">

            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link href={`/wc/${wc.id}`} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">แก้ไขใบจ้างงาน</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {wc.wcNumber} • โครงการ: <span className="font-semibold text-emerald-600">{currentProject?.name}</span> ({currentProject?.code})
                        </p>
                    </div>
                </div>

                <div className="flex space-x-3">
                    <button
                        onClick={() => handleUpdateWC("draft")}
                        disabled={saving || success}
                        className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                        <Save size={16} className="mr-2" />
                        บันทึกฉบับร่าง
                    </button>
                    <button
                        onClick={() => handleUpdateWC("pending")}
                        disabled={saving || success}
                        className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                    >
                        {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}
                        {success ? "สำเร็จ!" : "ส่งขออนุมัติอีกครั้ง"}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 space-y-8">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">เลขที่ใบจ้างงาน <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={wcNumber}
                                onChange={(e) => setWcNumber(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">ผู้รับจ้าง <span className="text-red-500">*</span></label>
                            <select
                                value={vendorId}
                                onChange={(e) => setVendorId(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                            >
                                <option value="">เลือกผู้รับจ้าง...</option>
                                {vendors.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">หัวข้อ / ชื่องาน</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                            />
                        </div>

                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">วันเริ่มงาน</label>
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm text-slate-600 focus:ring-emerald-500 focus:border-emerald-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">วันสิ้นสุดงาน</label>
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm text-slate-600 focus:ring-emerald-500 focus:border-emerald-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">เงื่อนไขการชำระเงิน</label>
                                <input type="text" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                                    placeholder="เช่น งวดที่ 1 = 50%" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">เลือกลายเซ็น</label>
                                <select
                                    value={selectedSignatureId}
                                    onChange={(e) => setSelectedSignatureId(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                                >
                                    <option value="">ไม่ระบุลายเซ็น</option>
                                    {companySettings?.signatures?.map((sig: any) => (
                                        <option key={sig.id} value={sig.id}>{sig.name} ({sig.position})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">หมายเหตุ</label>
                            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                                placeholder="หมายเหตุ/ข้อกำหนดพิเศษ" />
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    <div>
                        <div className="flex justify-between items-end mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">รายการงาน / ค่าแรง</h3>
                        </div>

                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">ลำดับ</th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-2/5">รายละเอียดงาน</th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">จำนวน</th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">หน่วย</th>
                                        <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">ราคา/หน่วย</th>
                                        <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">รวมเป็นเงิน</th>
                                        <th scope="col" className="px-4 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100">
                                    {items.map((item, index) => (
                                        <tr key={item.id} className="group">
                                            <td className="px-4 py-3 text-sm text-slate-400 font-medium">{index + 1}</td>
                                            <td className="px-4 py-3">
                                                <input type="text" value={item.description}
                                                    onChange={(e) => handleItemChange(item.id!, 'description', e.target.value)}
                                                    className="w-full text-sm border-0 bg-transparent focus:ring-0 text-slate-900 placeholder-slate-300" />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input type="number" value={item.quantity}
                                                    onChange={(e) => handleItemChange(item.id!, 'quantity', Number(e.target.value))}
                                                    className="w-20 text-sm border border-slate-200 rounded py-1 px-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input type="text" list="unit-list" value={item.unit}
                                                    onChange={(e) => handleItemChange(item.id!, 'unit', e.target.value)}
                                                    className="w-16 text-sm border border-slate-200 rounded py-1 px-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <input type="number" value={item.unitPrice}
                                                    onChange={(e) => handleItemChange(item.id!, 'unitPrice', Number(e.target.value))}
                                                    className="w-24 text-sm text-right border border-slate-200 rounded py-1 px-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                                                {item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={() => removeItem(item.id!)}
                                                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {availableUnits.length > 0 && (
                                <datalist id="unit-list">
                                    {availableUnits.map(u => <option key={u} value={u} />)}
                                </datalist>
                            )}
                            <div className="bg-slate-50 p-3 border-t border-slate-200">
                                <button onClick={handleAddItem}
                                    className="text-sm text-emerald-600 hover:text-emerald-800 font-medium px-2 py-1 flex items-center">
                                    <Plus size={16} className="mr-1" /> เพิ่มรายการงาน
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-6">
                        <div className="w-80 space-y-3">
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>ยอดรวมก่อนภาษี (Subtotal)</span>
                                <span className="font-medium text-slate-900">฿ {subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600 items-center mt-2">
                                <div className="flex items-center gap-2">
                                    <span>ภาษีมูลค่าเพิ่ม (VAT)</span>
                                    <select value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))}
                                        className="text-sm border border-slate-300 rounded py-1 px-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white">
                                        <option value={7}>7%</option>
                                        <option value={0}>ไม่มี VAT (0%)</option>
                                    </select>
                                </div>
                                <span className="font-medium text-slate-900">฿ {vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-base pt-3 border-t border-slate-200">
                                <span className="font-bold text-slate-900">ยอดเงินสุทธิเต็มจำนวน (Total)</span>
                                <span className="font-bold text-emerald-700">฿ {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

        </div>
    );
}
