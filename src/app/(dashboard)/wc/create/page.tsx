"use client";

import { useProject } from "@/context/ProjectContext";
import { ArrowLeft, Save, FileText, Send, Plus, Loader2, Search, ChevronDown, Upload } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, ChangeEvent } from "react";
import { WCItem } from "@/types/wc";
import { useAuth } from "@/context/AuthContext";
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Contractor } from "@/types/contractor";
import { parseDocumentItemsCsv, PROCESSING_FEE_LABEL, FUEL_FEE_LABEL } from "@/lib/documentItems";
import { buildDocumentNumber, buildDocumentPrefix, normalizeProjectCode, parseDocumentSequence } from "@/lib/documentNumbers";

type SignatureOption = {
    id: string;
    name: string;
    position?: string;
    signatureUrl?: string;
};

type CompanySettings = {
    signatures?: SignatureOption[];
};

type SystemConfig = {
    companySettings?: CompanySettings;
    itemUnits?: string[];
    wcPaymentTermTemplates?: string[];
    wcNoteTemplates?: string[];
};

type VatMode = "none" | "exclusive" | "inclusive";
const DEFAULT_VAT_RATE = 7;

export default function CreateWCPage() {
    const { currentProject } = useProject();
    const { user, userProfile } = useAuth();
    const router = useRouter();

    const createEmptyItem = (id: string): Partial<WCItem> => ({
        id,
        description: "",
        quantity: 1,
        unit: "",
        unitPrice: 0,
        amount: 0,
        isClosed: false,
    });

    const [items, setItems] = useState<Partial<WCItem>[]>([createEmptyItem("1")]);
    const [processingFee, setProcessingFee] = useState(0);
    const [fuelFee, setFuelFee] = useState(0);
    const [isAllPricesClosed, setIsAllPricesClosed] = useState(false);

    const [vendorId, setVendorId] = useState("");
    const [vendors, setVendors] = useState<Contractor[]>([]);
    const [vatMode, setVatMode] = useState<VatMode>("exclusive");
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [wcNumber, setWcNumber] = useState("");
    const [wcType, setWcType] = useState<"project" | "extra">("project");
    const [title, setTitle] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [issueDate, setIssueDate] = useState(() => {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    });
    const [paymentTerms, setPaymentTerms] = useState("");
    const [notes, setNotes] = useState("");
    const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
    const [availableUnits, setAvailableUnits] = useState<string[]>([]);
    const [paymentTermTemplates, setPaymentTermTemplates] = useState<string[]>([]);
    const [noteTemplates, setNoteTemplates] = useState<string[]>([]);
    const [selectedSignatureId, setSelectedSignatureId] = useState("");
    const [selectedPaymentTermTemplate, setSelectedPaymentTermTemplate] = useState("");
    const [selectedNoteTemplate, setSelectedNoteTemplate] = useState("");

    // Vendor Search
    const [searchVendor, setSearchVendor] = useState("");
    const [showVendorDropdown, setShowVendorDropdown] = useState(false);

    const filteredVendors = vendors
        .filter((v): v is Contractor & { id: string } => Boolean(v.id))
        .filter((v) => {
            const term = searchVendor.trim().toLowerCase();
            if (!term) return true;

            return (
                (v.fullName || "").toLowerCase().includes(term) ||
                (v.nickname || "").toLowerCase().includes(term) ||
                (v.idContractor || "").toLowerCase().includes(term) ||
                (v.phone || "").toLowerCase().includes(term)
            );
        });

    // Auto-generate WC Number
    useEffect(() => {
        async function fetchNextWcNumber() {
            const normalizedProjectCode = normalizeProjectCode(currentProject?.code);
            if (!normalizedProjectCode) {
                setWcNumber("");
                return;
            }

            const typePrefix = wcType === 'project' ? 'P' : 'E';
            const prefix = buildDocumentPrefix({
                series: "WC",
                projectCode: normalizedProjectCode,
                typeCode: typePrefix,
            });

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
                        const lastNum = parseDocumentSequence(String(lastWc.wcNumber), prefix);
                        if (lastNum !== null) nextNum = lastNum + 1;
                    }
                }

                setWcNumber(buildDocumentNumber({
                    series: "WC",
                    projectCode: normalizedProjectCode,
                    typeCode: typePrefix,
                    sequence: nextNum,
                }));
            } catch (error) {
                console.error("Error generating WC Number:", error);
                setWcNumber(buildDocumentNumber({
                    series: "WC",
                    projectCode: normalizedProjectCode,
                    typeCode: typePrefix,
                    sequence: 1,
                }));
            }
        }

        fetchNextWcNumber();
    }, [wcType, currentProject?.code]);

    useEffect(() => {
        async function fetchVendors() {
            try {
                const q = query(collection(db, "contractors"), where("isActive", "==", true));
                const snapshot = await getDocs(q);
                const vendorList: Contractor[] = [];
                snapshot.forEach(doc => {
                    vendorList.push({ id: doc.id, ...doc.data() } as Contractor);
                });
                setVendors(vendorList.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "")));
            } catch (error) {
                console.error("Error fetching contractors:", error);
            }
        }

        async function fetchCompanySettings() {
            try {
                const configRef = doc(db, "system_settings", "global_config");
                const configSnap = await getDoc(configRef);
                if (configSnap.exists()) {
                    const configData = configSnap.data() as SystemConfig;
                    if (configData.companySettings) {
                        const settings = configData.companySettings as CompanySettings;
                        setCompanySettings(settings);
                        if (settings.signatures && settings.signatures.length > 0) {
                            setSelectedSignatureId(settings.signatures[0].id);
                        }
                    }
                    if (configData.itemUnits) {
                        setAvailableUnits(configData.itemUnits);
                    }
                    if (configData.wcPaymentTermTemplates) {
                        setPaymentTermTemplates(configData.wcPaymentTermTemplates);
                    }
                    if (configData.wcNoteTemplates) {
                        setNoteTemplates(configData.wcNoteTemplates);
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
        setItems([...items, createEmptyItem(Date.now().toString())]);
    };

    const handleItemChange = (id: string, field: keyof WCItem, value: string | number) => {
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

    const normalizedProcessingFee = Math.max(0, Number(processingFee) || 0);
    const normalizedFuelFee = Math.max(0, Number(fuelFee) || 0);
    const itemsTotalBeforeFee = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const extraFeeTotal = normalizedProcessingFee + normalizedFuelFee;
    const amountBeforeVat = itemsTotalBeforeFee + extraFeeTotal;
    const vatRate = vatMode === "none" ? 0 : DEFAULT_VAT_RATE;
    const vatAmount = vatMode === "exclusive"
        ? (amountBeforeVat * DEFAULT_VAT_RATE) / 100
        : vatMode === "inclusive"
            ? (amountBeforeVat * DEFAULT_VAT_RATE) / (100 + DEFAULT_VAT_RATE)
            : 0;
    const subTotal = vatMode === "inclusive" ? amountBeforeVat - vatAmount : amountBeforeVat;
    const totalAmount = vatMode === "exclusive" ? amountBeforeVat + vatAmount : amountBeforeVat;

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

            if (normalizedFuelFee > 0) {
                sanitizedItems.push({
                    id: `fuel-${Date.now()}`,
                    description: FUEL_FEE_LABEL,
                    quantity: 0,
                    unit: "",
                    unitPrice: normalizedFuelFee,
                    amount: normalizedFuelFee,
                    isClosed: false,
                });
            }

            const createdByUid = userProfile?.uid || user.uid;

            let signatureData: SignatureOption | null = null;
            if (companySettings?.signatures && selectedSignatureId) {
                signatureData = companySettings.signatures.find((s) => s.id === selectedSignatureId) || null;
            }

            const newWC = {
                wcNumber: wcNumber.trim(),
                wcType: wcType,
                projectId: currentProject.id,
                vendorId: vendorId || "unknown",
                vendorName: selectedVendor ? selectedVendor.fullName : "ไม่ระบุผู้รับจ้าง",
                title: title.trim(),
                items: sanitizedItems,
                subTotal,
                vatRate,
                vatMode,
                vatAmount,
                totalAmount,
                status: status,
                startDate: startDate || "",
                endDate: endDate || "",
                issueDate: issueDate || "",
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
                            vendorData: selectedVendor
                                ? {
                                    name: selectedVendor.fullName,
                                    phone: selectedVendor.phone,
                                    address: selectedVendor.address,
                                }
                                : null,
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
                        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition-colors"
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
                                placeholder="WC403-202603-P001"
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
                                    {vendorId ? vendors.find(v => v.id === vendorId)?.fullName : "ค้นหาและเลือกผู้รับจ้าง..."}
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
                                                placeholder="ค้นหาชื่อ, ชื่อเล่น, รหัสลูกจ้าง หรือเบอร์โทร..."
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
                                                    <div className="font-medium text-slate-900">{v.fullName}</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">{v.nickname || "-"} | {v.idContractor}</div>
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
                                <input
                                    type="date"
                                    value={issueDate}
                                    onChange={(e) => setIssueDate(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm text-slate-600 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">เลือกลายเซ็น</label>
                                <select
                                    value={selectedSignatureId}
                                    onChange={(e) => setSelectedSignatureId(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white"
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

                        {/* เงื่อนไขการจ่ายและหมายเหตุ */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">เงื่อนไขการชำระเงิน / งวดงาน</label>
                            {paymentTermTemplates.length > 0 && (
                                <select
                                    value={selectedPaymentTermTemplate}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSelectedPaymentTermTemplate(value);
                                        if (value) setPaymentTerms(value);
                                    }}
                                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white mb-2"
                                >
                                    <option value="">เลือกจากแม่แบบที่บันทึกไว้</option>
                                    {paymentTermTemplates.map((template) => (
                                        <option key={template} value={template}>
                                            {template}
                                        </option>
                                    ))}
                                </select>
                            )}
                            <textarea
                                value={paymentTerms}
                                onChange={(e) => setPaymentTerms(e.target.value)}
                                rows={3}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                                placeholder="เช่น งวดที่ 1 = 30%, งวดที่ 2 = 70%"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">หมายเหตุ / ข้อกำหนดพิเศษ</label>
                            {noteTemplates.length > 0 && (
                                <select
                                    value={selectedNoteTemplate}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSelectedNoteTemplate(value);
                                        if (value) setNotes(value);
                                    }}
                                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white mb-2"
                                >
                                    <option value="">เลือกจากแม่แบบที่บันทึกไว้</option>
                                    {noteTemplates.map((template) => (
                                        <option key={template} value={template}>
                                            {template}
                                        </option>
                                    ))}
                                </select>
                            )}
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                                placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                            />
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* ตารางรายการงาน */}
                    <div>
                        <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-end mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">รายการงาน / ค่าแรง</h3>
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4">
                                <label className="inline-flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={isAllPricesClosed}
                                        onChange={(e) => setIsAllPricesClosed(e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span className="font-semibold text-emerald-700">ปิดราคาทุกรายการ</span>
                                </label>
                                <p className="text-xs text-slate-500">รองรับ CSV: description, quantity, unit, unitPrice (มีหัวตารางหรือไม่มีก็ได้)</p>
                            </div>
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
                                        <tr key={item.id} className={`group ${isAllPricesClosed ? "bg-emerald-50/30" : ""}`}>
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
                                                    disabled={isAllPricesClosed}
                                                    className={`w-28 text-sm text-right border rounded py-1 px-2 ${isAllPricesClosed ? "border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed" : "border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"}`}
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
                                    <tr className="bg-slate-50/70">
                                        <td className="px-4 py-3 text-sm text-slate-700 font-semibold">{items.length + 1}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">ราคารวม</td>
                                        <td className="px-4 py-3"></td>
                                        <td className="px-4 py-3"></td>
                                        <td className="px-4 py-3"></td>
                                        <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                                            {itemsTotalBeforeFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3"></td>
                                    </tr>
                                    <tr className="bg-amber-50/50">
                                        <td className="px-4 py-3 text-sm text-amber-700 font-semibold">{items.length + 2}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-amber-900">
                                            {PROCESSING_FEE_LABEL}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-500"></td>
                                        <td className="px-4 py-3 text-sm text-slate-500"></td>
                                        <td className="px-4 py-3 text-right">
                                            <input
                                                type="number"
                                                min="0"
                                                value={processingFee}
                                                onChange={(e) => setProcessingFee(Number(e.target.value))}
                                                className="w-28 text-sm text-right border border-amber-200 rounded py-1 px-2 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-semibold text-amber-900">
                                            {normalizedProcessingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3"></td>
                                    </tr>
                                    <tr className="bg-orange-50/50">
                                        <td className="px-4 py-3 text-sm text-orange-700 font-semibold">{items.length + 3}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-orange-900">
                                            {FUEL_FEE_LABEL}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-500"></td>
                                        <td className="px-4 py-3 text-sm text-slate-500"></td>
                                        <td className="px-4 py-3 text-right">
                                            <input
                                                type="number"
                                                min="0"
                                                value={fuelFee}
                                                onChange={(e) => setFuelFee(Number(e.target.value))}
                                                className="w-28 text-sm text-right border border-orange-200 rounded py-1 px-2 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 bg-white"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-semibold text-orange-900">
                                            {normalizedFuelFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3"></td>
                                    </tr>
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
                                        className="text-sm text-emerald-600 hover:text-emerald-800 font-medium px-2 py-1 flex items-center"
                                    >
                                        <Plus size={16} className="mr-1" /> เพิ่มรายการงาน
                                    </button>
                                    <label className="text-sm text-emerald-600 hover:text-emerald-800 font-medium px-2 py-1 flex items-center cursor-pointer">
                                        <Upload size={16} className="mr-1" /> นำเข้า CSV
                                        <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCsv} />
                                    </label>
                                </div>
                                <span className="text-xs text-slate-500">ระบบจะเขียนรายการท้ายเป็น {PROCESSING_FEE_LABEL} และ {FUEL_FEE_LABEL} อัตโนมัติเมื่อมีค่า</span>
                            </div>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="flex justify-end pt-6">
                        <div className="w-80 space-y-3">
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>รวมราคาก่อนค่าเพิ่มเติม</span>
                                <span className="font-medium text-slate-900">฿ {itemsTotalBeforeFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>{PROCESSING_FEE_LABEL}</span>
                                <span className="font-medium text-slate-900">฿ {normalizedProcessingFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>{FUEL_FEE_LABEL}</span>
                                <span className="font-medium text-slate-900">฿ {normalizedFuelFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>ยอดรวมก่อนภาษี (Subtotal)</span>
                                <span className="font-medium text-slate-900">฿ {subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600 items-center">
                                <span>ประเภทภาษี</span>
                                <select
                                    value={vatMode}
                                    onChange={(e) => setVatMode(e.target.value as VatMode)}
                                    className="text-sm border border-slate-300 rounded py-1 px-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                                >
                                    <option value="none">ไม่มี VAT</option>
                                    <option value="exclusive">VAT 7% (ราคาไม่รวม VAT)</option>
                                    <option value="inclusive">VAT 7% (ราคารวม VAT)</option>
                                </select>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600 items-center mt-2">
                                <span>ภาษีมูลค่าเพิ่ม (VAT {vatRate}%)</span>
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

