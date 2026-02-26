"use client";

import { useProject } from "@/context/ProjectContext";
import { ArrowLeft, Save, FileText, Send, Plus, Loader2, Search, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { WCItem } from "@/types/wc";
import { useAuth } from "@/context/AuthContext";
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Vendor } from "@/types/vendor";

export default function CreateWCPage() {
    const { currentProject } = useProject();
    const { user, userProfile } = useAuth();
    const router = useRouter();

    const [items, setItems] = useState<Partial<WCItem>[]>([
        { id: "1", description: "", quantity: 1, unit: "", unitPrice: 0, amount: 0 }
    ]);

    const [vendorId, setVendorId] = useState("");
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [vatRate, setVatRate] = useState(7);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [wcNumber, setWcNumber] = useState("");
    const [wcType, setWcType] = useState<"project" | "extra">("project");
    const [title, setTitle] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [paymentTerms, setPaymentTerms] = useState("");
    const [notes, setNotes] = useState("");
    const [companySettings, setCompanySettings] = useState<any>(null);
    const [availableUnits, setAvailableUnits] = useState<string[]>([]);
    const [selectedSignatureId, setSelectedSignatureId] = useState("");

    // Vendor Search
    const [searchVendor, setSearchVendor] = useState("");
    const [showVendorDropdown, setShowVendorDropdown] = useState(false);

    const filteredVendors = vendors.filter(v =>
        v.name.toLowerCase().includes(searchVendor.toLowerCase()) ||
        (v.taxId && v.taxId.includes(searchVendor))
    );

    // Auto-generate WC Number
    useEffect(() => {
        async function fetchNextWcNumber() {
            const yearStr = new Date().getFullYear().toString();
            const monthStr = (new Date().getMonth() + 1).toString().padStart(2, '0');
            const typePrefix = wcType === 'project' ? 'P' : 'E';
            const prefix = `WC-${yearStr}${monthStr}-${typePrefix}`;

            try {
                const q = query(
                    collection(db, "work_contracts"),
                    where("wcNumber", ">=", prefix),
                    where("wcNumber", "<=", prefix + '\uf8ff'),
                    orderBy("wcNumber", "desc"),
                    limit(1)
                );

                const snapshot = await getDocs(q);
                let nextNum = 1;

                if (!snapshot.empty) {
                    const lastWc = snapshot.docs[0].data();
                    if (lastWc.wcNumber) {
                        const lastNumStr = lastWc.wcNumber.substring(prefix.length);
                        const lastNum = parseInt(lastNumStr, 10);
                        if (!isNaN(lastNum)) nextNum = lastNum + 1;
                    }
                }

                setWcNumber(`${prefix}${nextNum.toString().padStart(3, '0')}`);
            } catch (error) {
                console.error("Error generating WC Number:", error);
                setWcNumber(`${prefix}001`);
            }
        }

        fetchNextWcNumber();
    }, [wcType]);

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

        async function fetchCompanySettings() {
            try {
                const configRef = doc(db, "system_settings", "global_config");
                const configSnap = await getDoc(configRef);
                if (configSnap.exists() && configSnap.data().companySettings) {
                    const settings = configSnap.data().companySettings;
                    setCompanySettings(settings);
                    if (settings.signatures && settings.signatures.length > 0) {
                        setSelectedSignatureId(settings.signatures[0].id);
                    }
                    if (configSnap.data().itemUnits) {
                        setAvailableUnits(configSnap.data().itemUnits);
                    }
                }
            } catch (error) {
                console.error("Error fetching company settings:", error);
            }
        }

        fetchVendors();
        fetchCompanySettings();
    }, []);

    const handleAddItem = () => {
        setItems([
            ...items,
            { id: Date.now().toString(), description: "", quantity: 1, unit: "", unitPrice: 0, amount: 0 }
        ]);
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

    const handleSaveWC = async (status: "draft" | "pending") => {
        if (!currentProject) { alert("ไม่พบข้อมูลโครงการ"); return; }
        if (!user) { alert("ไม่พบข้อมูลผู้ใช้งานหรือไม่มีสิทธิ์ดำเนินการ"); return; }
        if (!vendorId) { alert("กรุณาเลือกผู้รับจ้าง"); return; }
        if (!wcNumber.trim()) { alert("กรุณาระบุเลขที่ใบจ้างงาน"); return; }

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

            const createdByUid = userProfile?.uid || user.uid;

            let signatureData = null;
            if (companySettings?.signatures && selectedSignatureId) {
                signatureData = companySettings.signatures.find((s: any) => s.id === selectedSignatureId) || null;
            }

            const newWC = {
                wcNumber: wcNumber.trim(),
                wcType: wcType,
                projectId: currentProject.id,
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
                createdBy: createdByUid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            const docRef = await addDoc(collection(db, "work_contracts"), newWC);

            if (status === "pending") {
                try {
                    await fetch("/api/line/notify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "WC",
                            data: { ...newWC, id: docRef.id },
                            vendorData: selectedVendor,
                            projectName: currentProject.name
                        })
                    });
                } catch (e) {
                    console.error("Line notification failed:", e);
                }
            }

            setSuccess(true);
            setTimeout(() => {
                router.push("/wc");
            }, 2000);

        } catch (error) {
            console.error("Error saving WC:", error);
            alert("บันทึกข้อมูลไม่สำเร็จ โปรดตรวจสอบหน้าต่าง Console");
            setSaving(false);
        }
    };

    if (!currentProject) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-lg text-center flex flex-col items-center">
                <FileText className="w-12 h-12 text-yellow-500 mb-3" />
                <h3 className="font-bold text-lg">ยังไม่ได้เลือกโครงการ</h3>
                <p className="mb-4">คุณต้องเลือกโครงการจากเมนูด้านบนก่อนสร้างใบจ้างงาน</p>
                <Link href="/dashboard" className="bg-yellow-500 text-white px-4 py-2 rounded shadow hover:bg-yellow-600 transition">
                    กลับไปที่หน้าหลัก
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link href="/wc" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">สร้างใบจ้างงาน (Work Contract)</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            โครงการ: <span className="font-semibold text-emerald-600">{currentProject.name}</span> ({currentProject.code})
                        </p>
                    </div>
                </div>

                <div className="flex space-x-3">
                    <button
                        onClick={() => handleSaveWC("draft")}
                        disabled={saving || success}
                        className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                        <Save size={16} className="mr-2" />
                        บันทึกฉบับร่าง
                    </button>
                    <button
                        onClick={() => handleSaveWC("pending")}
                        disabled={saving || success}
                        className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                    >
                        {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}
                        {success ? "สำเร็จ!" : "ส่งขออนุมัติ"}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 space-y-8">

                    {/* ประเภทใบจ้างงาน */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-3">ประเภทใบจ้างงาน</label>
                        <div className="flex gap-4">
                            <label className={`flex items-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-all ${wcType === 'project' ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                                <input
                                    type="radio"
                                    name="wcType"
                                    className="text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                                    checked={wcType === 'project'}
                                    onChange={() => setWcType('project')}
                                />
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 leading-none mb-1">ใบจ้างงานในโครงการ (WC)</p>
                                    <p className="text-xs text-slate-500">จ้างงานก่อสร้าง/ติดตั้งสำหรับโครงการนี้โดยตรง</p>
                                </div>
                            </label>

                            <label className={`flex items-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-all ${wcType === 'extra' ? 'border-amber-500 bg-amber-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                                <input
                                    type="radio"
                                    name="wcType"
                                    className="text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                                    checked={wcType === 'extra'}
                                    onChange={() => setWcType('extra')}
                                />
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 leading-none mb-1">ใบจ้างงานเพิ่มเติม (EWC)</p>
                                    <p className="text-xs text-slate-500">งานเพิ่มเติมนอกสัญญาหลัก หรืองานแก้ไขพิเศษ</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* ข้อมูลหลัก */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">เลขที่ใบจ้างงาน <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={wcNumber}
                                onChange={(e) => setWcNumber(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                                placeholder="WC-YYYYMM-P001"
                            />
                        </div>

                        {/* Vendor Dropdown */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-slate-700 mb-1">ผู้รับจ้าง <span className="text-red-500">*</span></label>
                            <div
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm flex justify-between items-center bg-white cursor-pointer hover:border-emerald-400 transition-colors"
                                onClick={() => setShowVendorDropdown(!showVendorDropdown)}
                            >
                                <span className={vendorId ? "text-slate-900 truncate" : "text-slate-400"}>
                                    {vendorId ? vendors.find(v => v.id === vendorId)?.name : "ค้นหาและเลือกผู้รับจ้าง..."}
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
                                                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 bg-white focus:ring-emerald-500 focus:border-emerald-500 rounded-md"
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
                                                    className={`px-3 py-2.5 text-sm cursor-pointer border-b border-slate-50 last:border-0 hover:bg-emerald-50 transition-colors ${vendorId === v.id ? 'bg-emerald-50 text-emerald-600 font-semibold' : 'text-slate-700'}`}
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
                                            <div className="px-3 py-6 text-center text-sm text-slate-500">ไม่พบรายชื่อผู้รับจ้างนี้</div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {showVendorDropdown && (
                                <div className="fixed inset-0 z-40" onClick={() => setShowVendorDropdown(false)} />
                            )}
                        </div>

                        {/* หัวข้องาน */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">หัวข้อ / ชื่องาน</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                                placeholder="เช่น งานก่อสร้างอาคารโรงงาน ชั้น 1-3"
                            />
                        </div>

                        {/* วันเริ่ม-สิ้นสุด, ลายเซ็น */}
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">วันเริ่มงาน</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm text-slate-600 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">วันสิ้นสุดงาน</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm text-slate-600 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">วันที่ออกเอกสาร</label>
                                <input type="date" className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm text-slate-600 focus:ring-emerald-500 focus:border-emerald-500" />
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
                                        <option key={sig.id} value={sig.id}>
                                            {sig.name} ({sig.position})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* เงื่อนไขการจ่ายและหมายเหตุ */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">เงื่อนไขการชำระเงิน / งวดงาน</label>
                            <input
                                type="text"
                                value={paymentTerms}
                                onChange={(e) => setPaymentTerms(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                                placeholder="เช่น งวดที่ 1 = 30%, งวดที่ 2 = 70%"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">หมายเหตุ / ข้อกำหนดพิเศษ</label>
                            <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                                placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                            />
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* ตารางรายการงาน */}
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
                                                <input
                                                    type="text"
                                                    value={item.description}
                                                    onChange={(e) => handleItemChange(item.id!, 'description', e.target.value)}
                                                    placeholder="เช่น งานโครงสร้างเหล็กชั้น 2"
                                                    className="w-full text-sm border-0 bg-transparent focus:ring-0 text-slate-900 placeholder-slate-300"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(item.id!, 'quantity', Number(e.target.value))}
                                                    className="w-20 text-sm border border-slate-200 rounded py-1 px-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    list="unit-list"
                                                    value={item.unit}
                                                    onChange={(e) => handleItemChange(item.id!, 'unit', e.target.value)}
                                                    className="w-16 text-sm border border-slate-200 rounded py-1 px-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <input
                                                    type="number"
                                                    value={item.unitPrice}
                                                    onChange={(e) => handleItemChange(item.id!, 'unitPrice', Number(e.target.value))}
                                                    className="w-28 text-sm text-right border border-slate-200 rounded py-1 px-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
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
                            <div className="bg-slate-50 p-3 border-t border-slate-200">
                                <button
                                    onClick={handleAddItem}
                                    className="text-sm text-emerald-600 hover:text-emerald-800 font-medium px-2 py-1 flex items-center"
                                >
                                    <Plus size={16} className="mr-1" /> เพิ่มรายการงาน
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="flex justify-end pt-6">
                        <div className="w-80 space-y-3">
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
                                        className="text-sm border border-slate-300 rounded py-1 px-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                                    >
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
