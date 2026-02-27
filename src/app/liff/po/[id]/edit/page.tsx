"use client";

import { useProject } from "@/context/ProjectContext";
import { ArrowLeft, Save, Send, Plus, Loader2, Search, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, use } from "react";
import { POItem, PurchaseOrder } from "@/types/po";
import { useAuth } from "@/context/AuthContext";
import { collection, serverTimestamp, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Vendor } from "@/types/vendor";

export default function LiffEditPOPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const { currentProject } = useProject();
    const { user, userProfile } = useAuth();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<Partial<POItem>[]>([]);
    const [vendorId, setVendorId] = useState("");
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [vatRate, setVatRate] = useState(7);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [poType, setPoType] = useState<"project" | "extra">("project");

    const [creditDays, setCreditDays] = useState(30);
    const [poNumber, setPoNumber] = useState("");
    const [companySettings, setCompanySettings] = useState<any>(null);
    const [selectedSignatureId, setSelectedSignatureId] = useState("");

    // Vendor Search State
    const [searchVendor, setSearchVendor] = useState("");
    const [showVendorDropdown, setShowVendorDropdown] = useState(false);

    const filteredVendors = vendors.filter(v =>
        v.name.toLowerCase().includes(searchVendor.toLowerCase()) ||
        (v.taxId && v.taxId.includes(searchVendor))
    );

    useEffect(() => {
        async function fetchData() {
            if (!resolvedParams.id) return;
            try {
                // Fetch Vendors
                const vQ = query(collection(db, "vendors"), where("isActive", "==", true));
                const vSnap = await getDocs(vQ);
                const vendorList: Vendor[] = [];
                vSnap.forEach(doc => {
                    vendorList.push({ id: doc.id, ...doc.data() } as Vendor);
                });
                setVendors(vendorList.sort((a, b) => a.name.localeCompare(b.name)));

                // Fetch Settings
                const configRef = doc(db, "system_settings", "global_config");
                const configSnap = await getDoc(configRef);
                if (configSnap.exists() && configSnap.data().companySettings) {
                    setCompanySettings(configSnap.data().companySettings);
                }

                // Fetch PO
                const poRef = doc(db, "purchase_orders", resolvedParams.id);
                const poSnap = await getDoc(poRef);

                if (poSnap.exists()) {
                    const poData = poSnap.data() as PurchaseOrder;
                    setPoNumber(poData.poNumber);
                    setPoType(poData.poType || "project");
                    setVendorId(poData.vendorId || "");
                    setItems(poData.items || []);
                    setCreditDays(poData.creditDays || 30);
                    setVatRate(poData.vatRate || 7);
                    setSelectedSignatureId(poData.signatureId || "");
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [resolvedParams.id]);

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

    const handleUpdatePO = async (status: "draft" | "pending") => {
        if (!user) {
            alert("ไม่พบข้อมูลผู้ใช้งาน");
            return;
        }

        if (!vendorId) {
            alert("กรุณาเลือกผู้ขาย/คู่ค้า");
            return;
        }

        if (!poNumber.trim()) {
            alert("กรุณาระบุเลขที่ใบสั่งซื้อ (PO Number)");
            return;
        }

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

            const updatedPO = {
                poNumber: poNumber.trim(),
                poType: poType,
                vendorId: vendorId,
                vendorName: selectedVendor ? selectedVendor.name : "ไม่ระบุผู้ขาย",
                items: sanitizedItems,
                subTotal,
                vatRate,
                vatAmount,
                totalAmount,
                status: status,
                creditDays: creditDays,
                signatureId: selectedSignatureId,
                signatureData: signatureData,
                updatedAt: serverTimestamp(),
            };

            const poRef = doc(db, "purchase_orders", resolvedParams.id);
            await updateDoc(poRef, updatedPO);

            if (status === "pending") {
                try {
                    await fetch("/api/line/notify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "PO",
                            data: { ...updatedPO, id: resolvedParams.id },
                            vendorData: selectedVendor,
                            projectName: currentProject?.name
                        })
                    });
                } catch (e) {
                    console.error("Line notification failed:", e);
                }
            }

            setSuccess(true);
            setTimeout(() => {
                router.push(`/liff/po/${resolvedParams.id}`);
            }, 1000);

        } catch (error) {
            console.error("Error updating PO:", error);
            alert("บันทึกข้อมูลไม่สำเร็จ");
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 h-screen bg-slate-50 text-center">
                <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
                <p className="text-slate-500 text-sm font-medium">กำลังโหลดข้อมูล...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-24 text-slate-900">
            {/* Header - Enhanced with Gradient */}
            <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white p-4 pt-6 shadow-lg sticky top-0 z-40 flex items-center overflow-hidden">
                <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <button onClick={() => router.back()} className="mr-3 p-1.5 bg-white/15 rounded-full hover:bg-white/25 transition-colors relative z-10 backdrop-blur-sm">
                    <ArrowLeft size={20} />
                </button>
                <div className="relative z-10">
                    <h1 className="text-lg font-black leading-tight tracking-tight">แก้ไขใบสั่งซื้อ</h1>
                    <p className="text-[10px] text-blue-100 font-bold uppercase tracking-widest">{poNumber}</p>
                </div>
            </div>

            <main className="p-4 space-y-6">
                {/* PO Type Selection */}
                <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-100 flex">
                    <button
                        onClick={() => setPoType("project")}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${poType === "project" ? "bg-blue-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"}`}
                    >
                        ใบสั่งซื้อปกติ
                    </button>
                    <button
                        onClick={() => setPoType("extra")}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${poType === "extra" ? "bg-blue-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"}`}
                    >
                        ใบสั่งซื้อเพิ่มเติม
                    </button>
                </div>

                {/* Main Settings */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-800 mb-2">เลขที่ใบสั่งซื้อ (PO Number) <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={poNumber}
                            onChange={(e) => setPoNumber(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg py-3 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            placeholder="PO-XXXXXX-XXX"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-800 mb-2">เครดิต (วัน)</label>
                            <input
                                type="number"
                                value={creditDays}
                                onChange={(e) => setCreditDays(Number(e.target.value))}
                                className="w-full border border-slate-300 rounded-lg py-3 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                                min="0"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-800 mb-2">เลือกลายเซ็น</label>
                            <select
                                value={selectedSignatureId}
                                onChange={(e) => setSelectedSignatureId(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg py-3 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            >
                                <option value="">ไม่ระบุลายเซ็น</option>
                                {companySettings?.signatures?.map((sig: any) => (
                                    <option key={sig.id} value={sig.id}>
                                        {sig.name} ({sig.position})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Vendor Select */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative">
                    <label className="block text-sm font-bold text-slate-800 mb-2">เลือกร้านค้า / คู่ค้า <span className="text-red-500">*</span></label>

                    <div
                        className="w-full border border-slate-300 rounded-lg py-3 px-3 text-sm flex justify-between items-center bg-white cursor-pointer"
                        onClick={() => setShowVendorDropdown(!showVendorDropdown)}
                    >
                        <span className={vendorId ? "text-slate-900 line-clamp-1" : "text-slate-400"}>
                            {vendorId ? vendors.find(v => v.id === vendorId)?.name : "-- ค้นหาและเลือกร้านค้า --"}
                        </span>
                        <ChevronDown size={16} className={`text-slate-400 flex-shrink-0 ml-2 transition-transform duration-200 ${showVendorDropdown ? 'rotate-180' : ''}`} />
                    </div>

                    {showVendorDropdown && (
                        <div className="absolute top-[85px] left-4 right-4 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                            <div className="p-3 border-b border-slate-100 bg-slate-50">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="พิมพ์ชื่อร้านค้า หรือผู้เสียภาษี เพื่อค้นหา..."
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 bg-white focus:ring-blue-500 focus:border-blue-500 rounded-lg"
                                        value={searchVendor}
                                        onChange={(e) => setSearchVendor(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                                {filteredVendors.length > 0 ? (
                                    filteredVendors.map(v => (
                                        <div
                                            key={v.id}
                                            className={`px-4 py-3 text-sm cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50 ${vendorId === v.id ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700'}`}
                                            onClick={() => {
                                                setVendorId(v.id);
                                                setShowVendorDropdown(false);
                                                setSearchVendor("");
                                            }}
                                        >
                                            {v.name}
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-4 py-8 flex flex-col items-center justify-center text-center">
                                        <Search className="h-8 w-8 text-slate-200 mb-2" />
                                        <p className="text-sm text-slate-500">ไม่พบรายชื่อร้านค้านี้</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {showVendorDropdown && (
                        <div className="fixed inset-0 z-40" onClick={() => setShowVendorDropdown(false)} />
                    )}
                </div>

                {/* Items List */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-800 text-sm">รายการสิ่งของ</h3>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {items.map((item, index) => (
                            <div key={item.id} className="p-4 space-y-3 relative">
                                <div className="absolute top-4 right-4 text-xs font-bold text-slate-300">#{index + 1}</div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">ชื่อรายการ</label>
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => handleItemChange(item.id!, 'description', e.target.value)}
                                        className="w-full text-sm border border-slate-200 rounded-lg py-2 px-3 focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">จำนวน</label>
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(item.id!, 'quantity', Number(e.target.value))}
                                            className="w-full text-sm border border-slate-200 rounded-lg py-2 px-3"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">หน่วย</label>
                                        <input
                                            type="text"
                                            value={item.unit}
                                            onChange={(e) => handleItemChange(item.id!, 'unit', e.target.value)}
                                            className="w-full text-sm border border-slate-200 rounded-lg py-2 px-3"
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
                                            className="w-full text-sm border border-slate-200 rounded-lg py-2 px-3"
                                        />
                                    </div>
                                    <div className="flex-[2]">
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">รวม (บาท)</label>
                                        <div className="w-full text-sm border border-slate-100 bg-slate-50 rounded-lg py-2 px-3 font-semibold text-slate-700 text-right">
                                            {(item.amount || 0).toLocaleString()}
                                        </div>
                                    </div>
                                    {items.length > 1 && (
                                        <button onClick={() => removeItem(item.id!)} className="h-[38px] w-[38px] bg-red-50 text-red-500 rounded-lg border border-red-100">✕</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-3 bg-slate-50 border-t border-slate-100">
                        <button onClick={handleAddItem} className="w-full py-2 flex items-center justify-center text-sm font-semibold text-blue-600 bg-blue-50 rounded-lg">
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
                </div>
            </main>

            {/* Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 bg-white p-4 border-t border-slate-200 z-50 flex gap-3 pb-8">
                <button
                    onClick={() => handleUpdatePO("draft")}
                    disabled={saving || success}
                    className="flex-1 flex justify-center items-center py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm"
                >
                    <Save size={18} className="mr-2 text-slate-500" /> บันทึกฉบับร่าง
                </button>
                <button
                    onClick={() => handleUpdatePO("pending")}
                    disabled={saving || success}
                    className="flex-[1.5] flex justify-center items-center py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md"
                >
                    {saving ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Send size={18} className="mr-2" />}
                    {success ? "สำเร็จ!" : "ส่งขออนุมัติ"}
                </button>
            </div>
        </div>
    );
}
