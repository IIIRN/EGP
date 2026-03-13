"use client";

import { useProject } from "@/context/ProjectContext";
import { ArrowLeft, Save, FileText, Send, Plus, Loader2, Search, ChevronDown, Upload } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, ChangeEvent } from "react";
import { POItem } from "@/types/po";
import { useAuth } from "@/context/AuthContext";
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Vendor } from "@/types/vendor";
import { parseDocumentItemsCsv, PROCESSING_FEE_LABEL } from "@/lib/documentItems";
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

export default function CreatePOPage() {
    const { currentProject } = useProject();
    const { user, userProfile } = useAuth();
    const router = useRouter();

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
    const [vatRate, setVatRate] = useState(7); // Default 7% VAT
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [creditDays, setCreditDays] = useState(30);
    const [poNumber, setPoNumber] = useState("");
    const [poType, setPoType] = useState<"project" | "extra">("project");
    const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
    const [availableUnits, setAvailableUnits] = useState<string[]>([]);
    const [selectedSignatureId, setSelectedSignatureId] = useState("");

    useEffect(() => {
        async function fetchNextPoNumber() {
            const normalizedProjectCode = normalizeProjectCode(currentProject?.code);
            if (!normalizedProjectCode) {
                setPoNumber("");
                return;
            }

            const typePrefix = poType === 'project' ? 'P' : 'O';
            const prefix = buildDocumentPrefix({
                series: "PO",
                projectCode: normalizedProjectCode,
                typeCode: typePrefix,
            });

            try {
                const q = query(
                    collection(db, "purchase_orders"),
                    where("poNumber", ">=", prefix),
                    where("poNumber", "<=", prefix + '\uf8ff'),
                    orderBy("poNumber", "desc"),
                    limit(1)
                );

                const snapshot = await getDocs(q);
                let nextNum = 1;

                if (!snapshot.empty) {
                    const lastPo = snapshot.docs[0].data();
                    if (lastPo.poNumber) {
                        const lastNum = parseDocumentSequence(String(lastPo.poNumber), prefix);
                        if (lastNum !== null) {
                            nextNum = lastNum + 1;
                        }
                    }
                }

                setPoNumber(buildDocumentNumber({
                    series: "PO",
                    projectCode: normalizedProjectCode,
                    typeCode: typePrefix,
                    sequence: nextNum,
                }));
            } catch (error) {
                console.error("Error generating PO Number:", error);
                setPoNumber(buildDocumentNumber({
                    series: "PO",
                    projectCode: normalizedProjectCode,
                    typeCode: typePrefix,
                    sequence: 1,
                }));
            }
        }

        fetchNextPoNumber();
    }, [poType, currentProject?.code]);

    // Vendor Search State
    const [searchVendor, setSearchVendor] = useState("");
    const [showVendorDropdown, setShowVendorDropdown] = useState(false);

    const filteredVendors = vendors.filter(v =>
        v.name.toLowerCase().includes(searchVendor.toLowerCase()) ||
        (v.taxId && v.taxId.includes(searchVendor))
    );

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
                    // auto-select first signature if available
                    if (settings.signatures && settings.signatures.length > 0) {
                        setSelectedSignatureId(settings.signatures[0].id);
                        // Extract itemUnits
                        if (configSnap.data().itemUnits) {
                            setAvailableUnits(configSnap.data().itemUnits);
                        }
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

    const handleItemChange = (id: string, field: keyof POItem, value: string | number) => {
        const newItems = items.map(item => {
            if (item.id === id) {
                const updated = { ...item } as Partial<POItem>;
                if (field === "quantity") {
                    const raw = typeof value === "string" ? value : String(value);
                    const parsed = Number(raw);
                    updated.quantity = raw === "" ? 0 : (Number.isFinite(parsed) ? parsed : 0);
                } else if (field === "unitPrice") {
                    const parsed = Number(value);
                    updated.unitPrice = Number.isFinite(parsed) ? parsed : 0;
                } else {
                    (updated as Record<string, unknown>)[field] = value;
                }

                updated.amount = (Number(updated.quantity) || 0) * (Number(updated.unitPrice) || 0);
                return updated;
            }
            return item;
        });
        setItems(newItems);
    };

    const ensureMinQuantity = (id: string) => {
        setItems((prev) =>
            prev.map((item) => {
                if (item.id !== id) return item;
                const quantity = Math.max(1, Number(item.quantity) || 1);
                const unitPrice = Number(item.unitPrice) || 0;
                return { ...item, quantity, amount: quantity * unitPrice };
            })
        );
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

    const normalizedProcessingFee = poType === 'extra' ? 0 : Math.max(0, Number(processingFee) || 0);
    const itemsTotalBeforeFee = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const subTotal = itemsTotalBeforeFee + normalizedProcessingFee;
    const vatAmount = (subTotal * vatRate) / 100;
    const totalAmount = subTotal + vatAmount;

    const handleSavePO = async (status: "draft" | "pending") => {
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

        if (!poNumber.trim()) {
            alert("กรุณาระบุเลขที่ใบสั่งซื้อ (PO Number)");
            return;
        }

        setSaving(true);

        try {
            const selectedVendor = vendors.find(v => v.id === vendorId);

            const sanitizedItems = items.map(item => {
                const quantity = Math.max(1, Number(item.quantity) || 1);
                const unitPrice = Number(item.unitPrice) || 0;
                return {
                    id: item.id || Date.now().toString(),
                    description: item.description || "",
                    quantity,
                    unit: item.unit || "",
                    unitPrice,
                    amount: quantity * unitPrice,
                    isClosed: Boolean(isAllPricesClosed),
                };
            });

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

            // In some cases userProfile isn't set depending on database state, so use primary firebase user uid
            const createdByUid = userProfile?.uid || user.uid;

            let signatureData: SignatureOption | null = null;
            if (companySettings?.signatures && selectedSignatureId) {
                signatureData = companySettings.signatures.find((s) => s.id === selectedSignatureId) || null;
            }

            const newPO = {
                poNumber: poNumber.trim(),
                poType: poType,
                projectId: currentProject.id,
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
                createdBy: createdByUid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            const docRef = await addDoc(collection(db, "purchase_orders"), newPO);

            if (status === "pending") {
                try {
                    const notifyRes = await fetch("/api/line/notify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "PO",
                            data: { ...newPO, id: docRef.id },
                            vendorData: selectedVendor,
                            projectName: currentProject.name
                        })
                    });

                    let notifyPayload: unknown = null;
                    try {
                        notifyPayload = await notifyRes.json();
                    } catch {
                        notifyPayload = null;
                    }

                    if (!notifyRes.ok) {
                        let notifyErrorMsg = "ส่งแจ้งเตือนไปยัง LINE ไม่สำเร็จ";
                        if (notifyPayload?.message) {
                            notifyErrorMsg = String(notifyPayload.message);
                        } else if (notifyPayload?.error) {
                            notifyErrorMsg = typeof notifyPayload.error === "string" ? notifyPayload.error : notifyErrorMsg;
                        }

                        const failedReason = notifyPayload?.firstFailedReason
                            ? ` (${String(notifyPayload.firstFailedReason)})`
                            : "";

                        console.error("Line notification failed:", notifyErrorMsg);
                        alert(`บันทึกเอกสารแล้ว แต่${notifyErrorMsg}${failedReason}`);
                    } else if (notifyPayload?.partial) {
                        // Keep user flow silent on partial notification success.
                        console.warn("Line notification partial:", notifyPayload);
                    }
                } catch (e) {
                    console.error("Line notification failed:", e);
                    alert("บันทึกเอกสารแล้ว แต่ส่งแจ้งเตือน LINE ไม่สำเร็จ");
                }
            }

            setSuccess(true);
            setTimeout(() => {
                router.push("/liff");
            }, 2000);

        } catch (error) {
            console.error("Error saving PO:", error);
            alert("บันทึกข้อมูลไม่สำเร็จ โปรดตรวจสอบหน้าต่าง Console");
            setSaving(false);
        }
    };

    if (!currentProject) {
        return (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-6 rounded-lg text-center flex flex-col items-center">
                <FileText className="w-12 h-12 text-blue-500 mb-3" />
                <h3 className="font-bold text-lg">ยังไม่ได้เลือกโครงการ</h3>
                <p className="mb-4">คุณต้องเลือกโครงการจากเมนูด้านบนก่อนสร้างใบสั่งซื้อ (PO)</p>
                <Link href="/liff" className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-600 transition">
                    กลับไปที่หน้าหลัก
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto ">

            <div className="bg-blue-100 p-4 md:p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                        <Link href="/liff" className="p-2 rounded-full border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                            <ArrowLeft size={18} />
                        </Link>
                        <div className="min-w-0">
                            <h1 className="text-xl md:text-2xl font-semibold text-slate-900 leading-tight">สร้างใบสั่งซื้อ (PO)</h1>
                            <p className="mt-1 text-sm text-slate-500 truncate">
                                โครงการ: <span className="font-medium text-slate-700">{currentProject.name}</span> ({currentProject.code})
                            </p>
                            <p className="mt-1 text-xs text-slate-400">เลขที่เอกสาร: {poNumber || "ระบบจะสร้างอัตโนมัติ"}</p>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center gap-2">
                        <button
                            onClick={() => handleSavePO("draft")}
                            disabled={saving || success}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            <Save size={16} className="mr-2" />
                            บันทึกร่าง
                        </button>
                        <button
                            onClick={() => handleSavePO("pending")}
                            disabled={saving || success}
                            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                        >
                            {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}
                            {success ? "สำเร็จ" : "ส่งอนุมัติ"}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 md:p-6 space-y-6 md:space-y-8">

                    {/* เลือกประเภท PO */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-3">ประเภทใบสั่งซื้อ</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label className={`flex items-start gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-all ${poType === 'project' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                                <input
                                    type="radio"
                                    name="poType"
                                    className="text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                    checked={poType === 'project'}
                                    onChange={() => setPoType('project')}
                                />
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 leading-none mb-1">PO ในโครงการ</p>
                                    <p className="text-xs text-slate-500">สั่งซื้อวัสดุ/ค่าใช้จ่ายสำหรับโครงการก่อสร้างนี้โดยตรง</p>
                                </div>
                            </label>

                            <label className={`flex items-start gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-all ${poType === 'extra' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                <input
                                    type="radio"
                                    name="poType"
                                    className="text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                    checked={poType === 'extra'}
                                    onChange={() => setPoType('extra')}
                                />
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 leading-none mb-1">PO เพิ่มเติม (นอกงบ/เบ็ดเตล็ด)</p>
                                    <p className="text-xs text-slate-500">ค่าใช้จ่ายเพิ่มเติมที่อาจไม่เกี่ยวกับ BOQ หลัก</p>
                                </div>
                            </label>
                        </div>
                    </div>

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
                                    {vendorId ? vendors.find(v => v.id === vendorId)?.name : "ค้นหาและเลือกผู้ขาย..."}
                                </span>
                                <ChevronDown size={16} className={`text-slate-400 flex-shrink-0 ml-2 transition-transform duration-200 ${showVendorDropdown ? 'rotate-180' : ''}`} />
                            </div>

                            {showVendorDropdown && (
                                <div className="absolute top-[68px] left-0 right-0 bg-white border border-slate-200 rounded-lg z-50 overflow-hidden">
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

                            {/* Backdrop to close dropdown when clicked outside */}
                            {showVendorDropdown && (
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowVendorDropdown(false)}
                                />
                            )}
                            {/* Re-position dropdown over backdrop */}
                            {showVendorDropdown && <div className="fixed z-40 hidden"></div>}
                        </div>

                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">วันที่</label>
                                <input type="date" className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm text-slate-600 focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">วันที่กำหนดส่ง</label>
                                <input type="date" className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm text-slate-600 focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">เครดิต (วัน)</label>
                                <input
                                    type="number"
                                    value={creditDays}
                                    onChange={(e) => setCreditDays(Number(e.target.value))}
                                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm text-slate-600 focus:ring-blue-500 focus:border-blue-500"
                                    min="0"
                                    placeholder="30"
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

                        <div className="md:hidden flex items-center gap-2 mb-3">
                            <button
                                onClick={handleAddItem}
                                className="flex-1 text-sm text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 font-medium px-3 py-2 rounded-lg flex items-center justify-center"
                            >
                                <Plus size={16} className="mr-1" /> เพิ่มรายการ
                            </button>
                            <label className="flex-1 text-sm text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 font-medium px-3 py-2 rounded-lg flex items-center justify-center cursor-pointer">
                                <Upload size={16} className="mr-1" /> นำเข้า CSV
                                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCsv} />
                            </label>
                        </div>

                        <div className="md:hidden space-y-3 mb-3">
                            {items.map((item, index) => (
                                <div key={item.id} className={`rounded-xl border p-3 ${isAllPricesClosed ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-white"}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-semibold text-slate-500">รายการที่ {index + 1}</p>
                                        <button
                                            type="button"
                                            onClick={() => removeItem(item.id!)}
                                            className="text-xs text-red-600 hover:text-red-700 font-medium"
                                        >
                                            ลบ
                                        </button>
                                    </div>

                                    <label className="block text-xs text-slate-500 mb-1">รายละเอียด</label>
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => handleItemChange(item.id!, "description", e.target.value)}
                                        className="w-full h-10 border border-slate-300 rounded-lg px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />

                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">จำนวน</label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={Number(item.quantity) > 0 ? item.quantity : ""}
                                                onChange={(e) => handleItemChange(item.id!, "quantity", e.target.value)}
                                                onBlur={() => ensureMinQuantity(item.id!)}
                                                className="w-full h-10 border border-slate-300 rounded-lg px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">หน่วย</label>
                                            <input
                                                type="text"
                                                list="unit-list"
                                                value={item.unit}
                                                onChange={(e) => handleItemChange(item.id!, "unit", e.target.value)}
                                                className="w-full h-10 border border-slate-300 rounded-lg px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-2">
                                        <label className="block text-xs text-slate-500 mb-1">ราคาต่อหน่วย</label>
                                        <input
                                            type="number"
                                            value={item.unitPrice}
                                            onChange={(e) => handleItemChange(item.id!, "unitPrice", Number(e.target.value))}
                                            disabled={isAllPricesClosed}
                                            className={`w-full h-10 border rounded-lg px-3 text-sm text-right ${isAllPricesClosed ? "border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed" : "border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`}
                                        />
                                    </div>

                                    <div className="mt-3 flex items-center justify-end">
                                        <div className="text-right">
                                            <p className="text-[11px] text-slate-500">รวม</p>
                                            <p className="text-sm font-semibold text-slate-900">
                                                {item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">ราคารวมรายการ</span>
                                    <span className="font-semibold text-slate-900">
                                        {itemsTotalBeforeFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                {poType !== 'extra' && (
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">{PROCESSING_FEE_LABEL}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={processingFee}
                                            onChange={(e) => setProcessingFee(Number(e.target.value))}
                                            className="w-full h-10 border border-slate-300 rounded-lg px-3 text-sm text-right focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="hidden md:block border border-slate-200 rounded-lg overflow-hidden">
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
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={Number(item.quantity) > 0 ? item.quantity : ""}
                                                    onChange={(e) => handleItemChange(item.id!, "quantity", e.target.value)}
                                                    onBlur={() => ensureMinQuantity(item.id!)}
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

                    <div className="flex justify-end pt-3">
                        <div className="w-full md:w-80 space-y-3">
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>รวมราคาก่อนค่าดำเนินการ</span>
                                <span className="font-medium text-slate-900">฿ {itemsTotalBeforeFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            {poType !== 'extra' && (
                                <div className="flex justify-between text-sm text-slate-600">
                                    <span>{PROCESSING_FEE_LABEL}</span>
                                    <span className="font-medium text-slate-900">฿ {normalizedProcessingFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>ยอดรวมก่อนภาษี</span>
                                <span className="font-medium text-slate-900">฿ {subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600 items-center mt-2">
                                <div className="flex items-center gap-2">
                                <span>ภาษีมูลค่าเพิ่ม</span>
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
                                <span className="font-bold text-slate-900">ยอดเงินสุทธิเต็มจำนวน</span>
                                <span className="font-bold text-blue-700">฿ {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => handleSavePO("draft")}
                        disabled={saving || success}
                        className="h-11 inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 text-sm font-semibold text-slate-700 disabled:opacity-50"
                    >
                        <Save size={16} className="mr-1.5" /> บันทึกร่าง
                    </button>
                    <button
                        onClick={() => handleSavePO("pending")}
                        disabled={saving || success}
                        className="h-11 inline-flex items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Send size={16} className="mr-1.5" />}
                        {success ? "สำเร็จ" : "ส่งอนุมัติ"}
                    </button>
                </div>
            </div>

        </div>
    );
}


