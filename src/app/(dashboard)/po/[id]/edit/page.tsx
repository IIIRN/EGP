"use client";

import { use, useEffect, useState } from "react";
import { useProject } from "@/context/ProjectContext";
import { ArrowLeft, Save, Send, Plus, Loader2, Upload, Search, ChevronDown } from "lucide-react";
import Link from "next/link";
import { POItem, PurchaseOrder } from "@/types/po";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, updateDoc, serverTimestamp, query, collection, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Vendor } from "@/types/vendor";
import { parseDocumentItemsCsv, PROCESSING_FEE_LABEL, splitProcessingFeeItem } from "@/lib/documentItems";

type SignatureOption = {
    id: string;
    name: string;
    position?: string;
    signatureUrl?: string;
};

type CompanySettings = {
    signatures?: SignatureOption[];
};

export default function EditPOPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const { currentProject } = useProject();
    const { user } = useAuth();
    const router = useRouter();

    const [po, setPo] = useState<PurchaseOrder | null>(null);
    const [loading, setLoading] = useState(true);

    const createEmptyItem = (id: string): Partial<POItem> => ({
        id,
        description: "",
        quantity: 1,
        unit: "",
        unitPrice: 0,
        amount: 0,
        isClosed: false,
    });

    const [items, setItems] = useState<Partial<POItem>[]>([createEmptyItem("1")]);
    const [processingFee, setProcessingFee] = useState(0);
    const [isAllPricesClosed, setIsAllPricesClosed] = useState(false);
    const [vendorId, setVendorId] = useState("");
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [vatRate, setVatRate] = useState(7);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [creditDays, setCreditDays] = useState(30);
    const [poNumber, setPoNumber] = useState("");

    const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
    const [availableUnits, setAvailableUnits] = useState<string[]>([]);
    const [selectedSignatureId, setSelectedSignatureId] = useState("");
    const [searchVendor, setSearchVendor] = useState("");
    const [showVendorDropdown, setShowVendorDropdown] = useState(false);

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

        async function fetchPO() {
            if (!resolvedParams.id) return;
            try {
                const docRef = doc(db, "purchase_orders", resolvedParams.id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = { id: docSnap.id, ...docSnap.data() } as PurchaseOrder;

                    // Only allow editing if draft or rejected
                    if (data.status !== 'draft' && data.status !== 'rejected') {
                        alert("ใบสั่งซื้อนี้อยู่ในสถานะที่ไม่สามารถแก้ไขได้");
                        router.push(`/po/${data.id}`);
                        return;
                    }

                    setPo(data);
                    setVendorId(data.vendorId || "");
                    setVatRate(data.vatRate || 7);
                    setCreditDays(data.creditDays ?? 30);
                    setPoNumber(data.poNumber || "");

                    if (data.signatureId) {
                        setSelectedSignatureId(data.signatureId);
                    }
                    // auto-select first signature if available
                    // This logic needs companySettings to be fetched first, so it's better placed after companySettings are loaded.
                    // For now, we'll keep the original logic of setting signatureId from PO data.

                    if (data.items && data.items.length > 0) {
                        const { items: baseItems, processingFee: fee } = splitProcessingFeeItem(data.items);
                        const normalizedItems = baseItems.map((item) => ({ ...item, isClosed: Boolean(item.isClosed) }));
                        setItems(normalizedItems.length > 0 ? normalizedItems : [createEmptyItem("1")]);
                        setProcessingFee(fee);
                        setIsAllPricesClosed(normalizedItems.some(i => i.isClosed));
                    }
                } else {
                    console.error("No such document!");
                    alert("ไม่พบข้อมูลใบสั่งซื้อ");
                    router.push("/po");
                }
            } catch (error) {
                console.error("Error fetching PO:", error);
            } finally {
                setLoading(false);
            }
        }

        async function fetchCompanySettings() {
            try {
                const configRef = doc(db, "system_settings", "global_config");
                const configSnap = await getDoc(configRef);
                if (configSnap.exists() && configSnap.data().companySettings) {
                    const settings = configSnap.data().companySettings;
                    setCompanySettings(settings);

                    // We only want to set a default if PO data hasn't already loaded and set one. 
                    // To handle async race conditions easily, we can just do it if not set later or handled via selectedSignatureId directly.
                }
                if (configSnap.exists() && configSnap.data().itemUnits) {
                    setAvailableUnits(configSnap.data().itemUnits);
                }
            } catch (error) {
                console.error("Error fetching company settings:", error);
            }
        }

        fetchVendors();
        fetchPO();
        fetchCompanySettings();
    }, [resolvedParams.id, router]);

    const handleAddItem = () => {
        setItems([...items, createEmptyItem(Date.now().toString())]);
    };

    const handleItemChange = (id: string, field: keyof POItem, value: string | number) => {
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



    const handleImportCsv = (event: React.ChangeEvent<HTMLInputElement>) => {
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
                    isClosed: false,
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

    const normalizedProcessingFee = po?.poType === 'extra' ? 0 : Math.max(0, Number(processingFee) || 0);
    const itemsTotalBeforeFee = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const selectedVendor = vendors.find(v => v.id === vendorId);
    const filteredVendors = vendors.filter(v =>
        v.name.toLowerCase().includes(searchVendor.toLowerCase()) ||
        (v.taxId && v.taxId.includes(searchVendor))
    );

    const formatCreatedAt = (value: unknown) => {
        if (value && typeof value === "object" && "toDate" in value) {
            const timestamp = value as { toDate?: () => Date };
            if (typeof timestamp.toDate === "function") {
                return timestamp.toDate().toLocaleDateString("th-TH");
            }
        }
        return "ไม่ระบุ";
    };
    const subTotal = itemsTotalBeforeFee + normalizedProcessingFee;
    const vatAmount = (subTotal * vatRate) / 100;
    const totalAmount = subTotal + vatAmount;

    const handleUpdatePO = async (status: "draft" | "pending") => {
        if (!currentProject) {
            alert("ไม่พบข้อมูลโครงการ");
            return;
        }

        if (!user) {
            alert("ไม่พบข้อมูลผู้ใช้งานหรือไม่มีสิทธิ์ดำเนินการ");
            return;
        }

        if (!vendorId) {
            alert("กรุณาเลือกผู้ขาย/คู่ค้า");
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
                amount: Number(item.amount) || 0,
                isClosed: Boolean(isAllPricesClosed),
            }));

            if (normalizedProcessingFee > 0) {
                sanitizedItems.push({
                    id: `fee-${Date.now()}`,
                    description: PROCESSING_FEE_LABEL,
                    quantity: 0,
                    unit: "",
                    unitPrice: normalizedProcessingFee,
                    amount: normalizedProcessingFee,
                    isClosed: false,
                });
            }

            let signatureData: SignatureOption | null = null;
            if (companySettings?.signatures && selectedSignatureId) {
                signatureData = companySettings.signatures.find((s) => s.id === selectedSignatureId) || null;
            }

            const updatedPO = {
                // we don't change projectId, createdBy, createdAt etc.
                poNumber: poNumber.trim(),
                vendorId: vendorId || "unknown",
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

            setSuccess(true);
            setTimeout(() => {
                router.push(`/po/${resolvedParams.id}`);
            }, 2000);

        } catch (error) {
            console.error("Error updating PO:", error);
            alert("อัปเดตข้อมูลไม่สำเร็จ โปรดตรวจสอบหน้าต่าง Console");
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="animate-spin w-8 h-8 text-blue-600 mb-4" />
                <p className="text-slate-500">กำลังโหลดข้อมูลใบสั่งซื้อสำหรับการแก้ไข...</p>
            </div>
        );
    }

    if (!po) return null; // handled in useEffect

    return (
        <div className="max-w-5xl mx-auto space-y-6">

            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link href={`/po/${po.id}`} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">แก้ไขใบสั่งซื้อ</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {po.poNumber} • โครงการ: <span className="font-semibold text-blue-600">{currentProject?.name}</span> ({currentProject?.code})
                        </p>
                    </div>
                </div>

                <div className="flex space-x-3">
                    <button
                        onClick={() => handleUpdatePO("draft")}
                        disabled={saving || success}
                        className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                        <Save size={16} className="mr-2" />
                        บันทึกฉบับร่าง
                    </button>
                    <button
                        onClick={() => handleUpdatePO("pending")}
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">เลขที่ใบสั่งซื้อ (PO Number) <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={poNumber}
                                onChange={(e) => setPoNumber(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                                placeholder="PO403-202603-P001"
                            />
                        </div>

                        <div className="relative">
                            <label className="block text-sm font-medium text-slate-700 mb-1">ผู้ขาย / คู่ค้า <span className="text-red-500">*</span></label>
                            <div
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm flex justify-between items-center bg-white cursor-pointer hover:border-blue-400 transition-colors"
                                onClick={() => setShowVendorDropdown(!showVendorDropdown)}
                            >
                                <span className={vendorId ? "text-slate-900 truncate" : "text-slate-400"}>
                                    {vendorId ? (selectedVendor?.name || po.vendorName) : "ค้นหาและเลือกผู้ขาย..."}
                                </span>
                                <ChevronDown size={16} className={`text-slate-400 flex-shrink-0 ml-2 transition-transform duration-200 ${showVendorDropdown ? 'rotate-180' : ''}`} />
                            </div>

                            {showVendorDropdown && (
                                <div className="absolute top-[68px] left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                                    <div className="p-2 border-b border-slate-100 bg-slate-50">
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="พิมพ์ค้นหาชื่อ หรือเลขผู้เสียภาษี..."
                                                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 bg-white focus:ring-blue-500 focus:border-blue-500 rounded-md"
                                                value={searchVendor}
                                                onChange={(e) => setSearchVendor(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        {filteredVendors.length > 0 ? (
                                            filteredVendors.map(v => (
                                                <div
                                                    key={v.id}
                                                    className={`px-3 py-2.5 text-sm cursor-pointer border-b border-slate-50 last:border-0 hover:bg-blue-50 transition-colors ${vendorId === v.id ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-700'}`}
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
                                            <div className="px-3 py-6 text-center text-sm text-slate-500">
                                                ไม่พบรายชื่อผู้ขายนี้
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {showVendorDropdown && (
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowVendorDropdown(false)}
                                />
                            )}
                        </div>

                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">วันที่สร้าง</label>
                                <input type="text" disabled value={formatCreatedAt(po.createdAt)} className="w-full border border-slate-200 bg-slate-50 rounded-lg py-2 px-3 text-sm text-slate-500 cursor-not-allowed" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">เครดิต (วัน)</label>
                                <input
                                    type="number"
                                    value={creditDays}
                                    onChange={(e) => setCreditDays(Number(e.target.value))}
                                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm text-slate-600 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                    min="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">เลือกลายเซ็น</label>
                                <select
                                    value={selectedSignatureId}
                                    onChange={(e) => setSelectedSignatureId(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                                >
                                    <option value="">ไม่ระบุลายเซ็น</option>
                                    {companySettings?.signatures?.map((sig) => (
                                        <option key={sig.id} value={sig.id}>
                                            {sig.name} ({sig.position})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    <div>
                        <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-end mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">รายการสั่งซื้อ</h3>
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4">
                                <label className="inline-flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={isAllPricesClosed}
                                        onChange={(e) => setIsAllPricesClosed(e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="font-semibold text-blue-700">ปิดราคาทุกรายการ</span>
                                </label>
                                <p className="text-xs text-slate-500 hidden md:block">รองรับ CSV: description, quantity, unit, unitPrice</p>
                            </div>
                        </div>

                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">ลำดับ</th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-2/5">รายละเอียด / รายการวัสดุ</th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">จำนวน</th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">หน่วย</th>
                                        <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">ราคา/หน่วย</th>
                                        <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">รวมเป็นเงิน</th>
                                        <th scope="col" className="px-4 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100">
                                    {items.map((item, index) => (
                                        <tr key={item.id} className={`group ${isAllPricesClosed ? "bg-blue-50/30" : ""}`}>
                                            <td className="px-4 py-3 text-sm text-slate-400 font-medium">{index + 1}</td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={item.description}
                                                    onChange={(e) => handleItemChange(item.id!, 'description', e.target.value)}
                                                    placeholder="เช่น ปูนซีเมนต์ฉาบเรียบ 50กก."
                                                    className="w-full text-sm p-1 border-0 bg-transparent focus:ring-0 p-0 text-slate-900 placeholder-slate-300"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(item.id!, 'quantity', Number(e.target.value))}
                                                    className="w-20 text-sm border border-slate-200 rounded py-1 px-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    list="unit-list"
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
                                                    disabled={isAllPricesClosed}
                                                    className={`w-24 text-sm text-right border rounded py-1 px-2 ${isAllPricesClosed ? "border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed" : "border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                                                {item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                            {availableUnits.length > 0 && (
                                <datalist id="unit-list">
                                    {availableUnits.map(u => <option key={u} value={u} />)}
                                </datalist>
                            )}
                            <div className="bg-slate-50 p-3 border-t border-slate-200 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleAddItem}
                                        className="text-sm text-blue-600 hover:text-blue-800 font-medium px-2 py-1 flex items-center"
                                    >
                                        <Plus size={16} className="mr-1" /> เพิ่มรายการ
                                    </button>
                                    <label className="text-sm text-blue-600 hover:text-blue-800 font-medium px-2 py-1 flex items-center cursor-pointer">
                                        <Upload size={16} className="mr-1" /> นำเข้า CSV
                                        <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCsv} />
                                    </label>
                                </div>
                                
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-6">
                        <div className="w-80 space-y-3">
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>รวมราคาก่อนค่าดำเนินการ</span>
                                <span className="font-medium text-slate-900">฿ {itemsTotalBeforeFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            {po?.poType !== 'extra' && (
                                <div className="flex justify-between text-sm text-slate-600 items-center">
                                    <span>{PROCESSING_FEE_LABEL}</span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            value={processingFee}
                                            onChange={(e) => setProcessingFee(Number(e.target.value))}
                                            className="w-24 text-sm text-right border border-slate-300 rounded py-1 px-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                                            placeholder="0.00"
                                        />
                                        <span className="font-medium text-slate-900 w-24 text-right">฿ {normalizedProcessingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>ยอดรวมก่อนภาษี (Subtotal)</span>
                                <span className="font-medium text-slate-900">฿ {subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600 items-center mt-2">
                                <div className="flex items-center gap-2">
                                    <span>ภาษีมูลค่าเพิ่ม (VAT)</span>
                                    <select
                                        value={vatRate}
                                        onChange={(e) => setVatRate(Number(e.target.value))}
                                        className="text-sm border border-slate-300 rounded py-1 px-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                    >
                                        <option value={7}>7%</option>
                                        <option value={0}>ไม่มี VAT (0%)</option>
                                    </select>
                                </div>
                                <span className="font-medium text-slate-900">฿ {vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-base pt-3 border-t border-slate-200">
                                <span className="font-bold text-slate-900">ยอดเงินสุทธิเต็มจำนวน (Total)</span>
                                <span className="font-bold text-blue-700">฿ {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

        </div>
    );
}
