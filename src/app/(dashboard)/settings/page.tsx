"use client";

import { useAuth } from "@/context/AuthContext";
import { Save, ShieldAlert, Loader2, MessageCircle, Link as LinkIcon, Bell, Trash2, Plus, UploadCloud, Database, CheckCircle, ExternalLink, RefreshCw, Building, Users, Box, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import Link from "next/link";

interface LineSettings {
    lineToken: string;
    groupId: string;
    userId: string;
    isEnabled: boolean;
}

export interface SignatureItem {
    id: string;
    name: string;
    position: string;
    signatureUrl: string;
}

interface CompanySettings {
    name: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string;
    signatureUrl?: string; // legacy
    signatures?: SignatureItem[];
}

interface SystemSettings {
    lineIntegration: LineSettings;
    companySettings: CompanySettings;
    vendorTypes: string[];
    itemUnits: string[];
}
export default function SettingsPage() {
    const { userProfile } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const [settings, setSettings] = useState<SystemSettings>({
        lineIntegration: {
            lineToken: "",
            groupId: "",
            userId: "",
            isEnabled: false,
        },
        companySettings: {
            name: "บริษัท พาวเวอร์เทค เอนจิเนียริ่ง จำกัด",
            address: "9/10 ถ.มิตรสาร ต.ประตูชัย อ.พระนครศรีอยุธยา จ.พระนครศรีอยุธยา 13000",
            phone: "083-995-5629, 083-995-4495",
            email: "Powertec.civil@gmail.com",
            logoUrl: "",
            signatureUrl: "",
            signatures: [],
        },
        vendorTypes: ["วัสดุก่อสร้าง general", "เครื่องมือ-เครื่องจักร", "ผู้รับเหมาช่วง (Sub-contractor)"],
        itemUnits: ["ชิ้น", "อัน", "กล่อง", "ลัง", "พาเลท", "งาน", "เดือน", "วัน"]
    });

    const [newVendorType, setNewVendorType] = useState("");
    const [newItemUnit, setNewItemUnit] = useState("");
    const [activeTab, setActiveTab] = useState('line');

    const tabs = [
        { id: 'line', label: 'แจ้งเตือน LINE', icon: MessageCircle },
        { id: 'company', label: 'ข้อมูลบริษัท', icon: Building },
        { id: 'vendor', label: 'ประเภทคู่ค้า', icon: Users },
        { id: 'units', label: 'หน่วยนับ', icon: Box },
        { id: 'database', label: 'Database Index', icon: Database },
    ];

    const [indexStatuses, setIndexStatuses] = useState<{ name: string; status: 'idle' | 'loading' | 'ready' | 'missing' | 'error'; link?: string; errorMsg?: string }[]>([
        { name: "ใบสั่งซื้อ (PO) เรียงตามเวลา", status: 'idle' },
        { name: "งานเพิ่ม-ลด (VO) เรียงตามเวลา", status: 'idle' },
    ]);

    const checkIndexes = async () => {
        setIndexStatuses(prev => prev.map(i => ({ ...i, status: 'loading', errorMsg: undefined, link: undefined })));

        // 1. Check PO index
        try {
            const poQ = query(collection(db, "purchase_orders"), where("projectId", "==", "dummy"), orderBy("createdAt", "desc"), limit(1));
            await getDocs(poQ);
            setIndexStatuses(prev => prev.map(i => i.name.includes("PO") ? { ...i, status: 'ready' } : i));
        } catch (error: any) {
            console.error("PO Index Check Error:", error);
            if (error.message && error.message.includes("index")) {
                const urlMatch = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
                setIndexStatuses(prev => prev.map(i => i.name.includes("PO") ? { ...i, status: 'missing', link: urlMatch ? urlMatch[0] : '' } : i));
            } else {
                setIndexStatuses(prev => prev.map(i => i.name.includes("PO") ? { ...i, status: 'error', errorMsg: error.message } : i));
            }
        }

        // 2. Check VO index
        try {
            const voQ = query(collection(db, "variation_orders"), where("projectId", "==", "dummy"), orderBy("createdAt", "desc"), limit(1));
            await getDocs(voQ);
            setIndexStatuses(prev => prev.map(i => i.name.includes("VO") ? { ...i, status: 'ready' } : i));
        } catch (error: any) {
            console.error("VO Index Check Error:", error);
            if (error.message && error.message.includes("index")) {
                const urlMatch = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
                setIndexStatuses(prev => prev.map(i => i.name.includes("VO") ? { ...i, status: 'missing', link: urlMatch ? urlMatch[0] : '' } : i));
            } else {
                setIndexStatuses(prev => prev.map(i => i.name.includes("VO") ? { ...i, status: 'error', errorMsg: error.message } : i));
            }
        }
    };

    useEffect(() => {
        async function fetchSettings() {
            try {
                // Fetch line settings from a global config document
                const docRef = doc(db, "system_settings", "global_config");
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setSettings(prev => ({ ...prev, ...docSnap.data() }));
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchSettings();
    }, []);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSaving(true);
        try {
            const storageRef = ref(storage, `settings/logo_${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            setSettings({ ...settings, companySettings: { ...settings.companySettings, logoUrl: url } });
        } catch (error) {
            console.error("Error uploading logo:", error);
            setErrorMsg("อัปโหลดโลโก้ล้มเหลว");
        } finally {
            setSaving(false);
        }
    };

    const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSaving(true);
        try {
            const storageRef = ref(storage, `settings/signature_${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            const currentSigs = settings.companySettings.signatures || [];
            const updatedSignatures = currentSigs.map(sig =>
                sig.id === id ? { ...sig, signatureUrl: url } : sig
            );

            setSettings({ ...settings, companySettings: { ...settings.companySettings, signatures: updatedSignatures } });
        } catch (error) {
            console.error("Error uploading signature:", error);
            setErrorMsg("อัปโหลดลายเซ็นล้มเหลว");
        } finally {
            setSaving(false);
        }
    };

    const addSignature = () => {
        const newSig: SignatureItem = {
            id: Date.now().toString(),
            name: "",
            position: "",
            signatureUrl: ""
        };
        const currentSigs = settings.companySettings.signatures || [];
        setSettings({
            ...settings,
            companySettings: {
                ...settings.companySettings,
                signatures: [...currentSigs, newSig]
            }
        });
    };

    const removeSignature = (id: string) => {
        const currentSigs = settings.companySettings.signatures || [];
        setSettings({
            ...settings,
            companySettings: {
                ...settings.companySettings,
                signatures: currentSigs.filter(s => s.id !== id)
            }
        });
    };

    const updateSignature = (id: string, field: keyof SignatureItem, value: string) => {
        const currentSigs = settings.companySettings.signatures || [];
        setSettings({
            ...settings,
            companySettings: {
                ...settings.companySettings,
                signatures: currentSigs.map(s => s.id === id ? { ...s, [field]: value } : s)
            }
        });
    };

    // Only Admin can edit system settings (or bootstrap user)
    const isAdmin = userProfile?.role === "admin" || !userProfile;
    if (!isAdmin) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-lg text-center flex flex-col items-center">
                <ShieldAlert className="w-12 h-12 text-red-500 mb-3" />
                <h3 className="font-bold text-lg">ไม่มีสิทธิ์ใช้งาน</h3>
                <p className="mb-4">เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถจัดการตั้งค่าระบบได้</p>
                <Link href="/dashboard" className="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 transition">
                    กลับไปที่หน้าหลัก
                </Link>
            </div>
        );
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setErrorMsg("");
        setSuccessMsg("");

        try {
            const docRef = doc(db, "system_settings", "global_config");
            await setDoc(docRef, {
                ...settings,
                updatedAt: serverTimestamp(),
                updatedBy: userProfile?.uid || "unknown"
            });

            setSuccessMsg("บันทึกการตั้งค่าระบบเรียบร้อยแล้ว");

            // clear success message after 3 seconds
            setTimeout(() => {
                setSuccessMsg("");
            }, 3000);

        } catch (error: any) {
            console.error("Error saving settings:", error);
            setErrorMsg("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="animate-spin w-8 h-8 text-blue-600 mb-4" />
                <p className="text-slate-500">กำลังโหลดการตั้งค่าระบบ...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center">
                    <Settings className="w-6 h-6 mr-3 text-slate-700" />
                    การตั้งค่าระบบ
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    จัดการการตั้งค่าระบบทั้งหมด รวมถึงแจ้งเตือน ข้อมูลบริษัท และประเภทคู่ค้า
                </p>
            </div>

            {/* Tabs Navigation */}
            <div className="flex space-x-1 border-b border-slate-200 overflow-x-auto pb-px">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                                ? 'border-blue-500 text-blue-600 bg-blue-50/50 rounded-t-lg'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50 rounded-t-lg'
                            }`}
                    >
                        <tab.icon className={`w-4 h-4 mr-2 ${activeTab === tab.id ? 'text-blue-500' : 'text-slate-400'}`} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {(errorMsg || successMsg) && (
                    <div className="px-8 pt-8 pb-2 space-y-4">
                        {errorMsg && (
                            <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center text-sm border border-red-100">
                                <ShieldAlert className="w-5 h-5 mr-2 flex-shrink-0" />
                                {errorMsg}
                            </div>
                        )}

                        {successMsg && (
                            <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center text-sm border border-green-100">
                                <Bell className="w-5 h-5 mr-2 flex-shrink-0" />
                                {successMsg}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'line' && (
                    <div className="p-8 space-y-8">

                        {/* Enable Toggle */}
                        <div className="flex items-center space-x-3 bg-slate-50 p-4 border border-slate-200 rounded-lg">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.lineIntegration.isEnabled}
                                    onChange={(e) => setSettings({ ...settings, lineIntegration: { ...settings.lineIntegration, isEnabled: e.target.checked } })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                            <div>
                                <span className="text-sm font-bold text-slate-800 block">
                                    เปิดใช้งานการแจ้งเตือนผ่าน LINE
                                </span>
                                <span className="text-xs text-slate-500">
                                    {settings.lineIntegration.isEnabled ? "ระบบจะส่งข้อความแจ้งเตือนเมื่อมีการดำเนินการ PO/VO" : "ระบบปิดการแจ้งเตือนอยู่ จะไม่มีการส่งข้อความใด ๆ ไปยัง LINE"}
                                </span>
                            </div>
                        </div>

                        <div className={`space-y-6 ${!settings.lineIntegration.isEnabled ? 'opacity-50 grayscale pointer-events-none' : ''}`}>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center">
                                    <LinkIcon className="w-4 h-4 mr-1 text-slate-400" />
                                    LINE Channel Access Token <span className="text-red-500 ml-1">*</span>
                                </label>
                                <input
                                    type="text"
                                    required={settings.lineIntegration.isEnabled}
                                    value={settings.lineIntegration.lineToken}
                                    onChange={(e) => setSettings({ ...settings, lineIntegration: { ...settings.lineIntegration, lineToken: e.target.value } })}
                                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-green-500 focus:border-green-500 font-mono"
                                    placeholder="เช่น wY3mZ...vL2X"
                                />
                                <p className="text-xs text-slate-400 mt-2">
                                    นำมาจาก LINE Developers Console (Long-lived access token)
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Group ID ทั่วไป
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.lineIntegration.groupId}
                                        onChange={(e) => setSettings({ ...settings, lineIntegration: { ...settings.lineIntegration, groupId: e.target.value } })}
                                        className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-green-500 focus:border-green-500"
                                        placeholder="เช่น C12345678... (ถ้าจะให้ส่งเข้ากลุ่ม)"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        User ID รับเรื่องแจ้งเตือน
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.lineIntegration.userId}
                                        onChange={(e) => setSettings({ ...settings, lineIntegration: { ...settings.lineIntegration, userId: e.target.value } })}
                                        className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-green-500 focus:border-green-500"
                                        placeholder="เช่น U12345678... (แจ้งเตือนหาคนนี้เป็นหลัก)"
                                    />
                                </div>
                            </div>

                            <div className="bg-green-50 rounded-lg p-4 border border-green-100 flex start">
                                <MessageCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                                <div className="text-sm text-green-800">
                                    <strong>คำแนะนำการใช้งาน:</strong>
                                    <ul className="list-disc list-inside mt-2 space-y-1 text-green-700">
                                        <li>บอทต้องอยู่ในกลุ่ม LINE (ถ้าใช้ Group ID) ถึงจะส่งข้อความได้</li>
                                        <li>อย่างน้อยควรใส่ Group ID หรือ User ID อย่างใดอย่างหนึ่งเป็นตัวหลัก</li>
                                        <li>อย่าลืมเอาบอท LINE OA แอดเข้ากลุ่มก่อนทดสอบการตอบสนอง</li>
                                    </ul>
                                </div>
                            </div>

                        </div>
                    </div>
                )}

                {/* Company Settings for PDF Header */}
                {activeTab === 'company' && (
                    <div className="p-8">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-slate-800 mb-2">ข้อมูลหัวกระดาษ (PDF เอกสาร)</h2>
                            <p className="text-sm text-slate-500">
                                ข้อมูลบริษัทสำหรับแสดงบนหัวกระดาษเวลาพิมพ์ใบสั่งซื้อ (PO) และเอกสารต่างๆ
                            </p>
                        </div>

                        <div className="space-y-4 max-w-2xl">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    ชื่อบริษัท (Company Name)
                                </label>
                                <input
                                    type="text"
                                    value={settings.companySettings?.name || ""}
                                    onChange={(e) => setSettings({ ...settings, companySettings: { ...settings.companySettings, name: e.target.value } })}
                                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="เช่น บริษัท พาวเวอร์เทค เอนจิเนียริ่ง จำกัด"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    ที่อยู่ (Address)
                                </label>
                                <input
                                    type="text"
                                    value={settings.companySettings?.address || ""}
                                    onChange={(e) => setSettings({ ...settings, companySettings: { ...settings.companySettings, address: e.target.value } })}
                                    className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        เบอร์โทรศัพท์ (Phone)
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.companySettings?.phone || ""}
                                        onChange={(e) => setSettings({ ...settings, companySettings: { ...settings.companySettings, phone: e.target.value } })}
                                        className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        อีเมล (Email)
                                    </label>
                                    <input
                                        type="email"
                                        value={settings.companySettings?.email || ""}
                                        onChange={(e) => setSettings({ ...settings, companySettings: { ...settings.companySettings, email: e.target.value } })}
                                        className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="mt-6 border-t border-slate-200 pt-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        โลโก้ (Logo)
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleLogoUpload}
                                            className="hidden"
                                            id="upload-logo"
                                        />
                                        <label
                                            htmlFor="upload-logo"
                                            className="cursor-pointer inline-flex items-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
                                        >
                                            <UploadCloud className="w-4 h-4 mr-2" />
                                            อัปโหลดโลโก้ใหม่
                                        </label>
                                        {settings.companySettings?.logoUrl && (
                                            <div className="p-2 bg-slate-50 border border-slate-200 rounded max-w-xs h-16 flex items-center justify-center">
                                                <img src={settings.companySettings.logoUrl} alt="Logo Preview" className="max-h-full max-w-full object-contain" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="block text-base font-semibold text-slate-800">
                                        ลายเซ็นผู้อนุมัติ / ผู้จัดการ (Signatures)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={addSignature}
                                        className="inline-flex items-center px-3 py-1.5 border border-blue-600 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
                                    >
                                        <Plus className="w-4 h-4 mr-1" />
                                        เพิ่มลายเซ็น
                                    </button>
                                </div>

                                {(!settings.companySettings.signatures || settings.companySettings.signatures.length === 0) && (
                                    <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 p-4 rounded-lg text-center">
                                        ยังไม่มีลายเซ็นในระบบ กดปุ่ม "เพิ่มลายเซ็น" ด้านบน
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {settings.companySettings.signatures?.map((sig, idx) => (
                                        <div key={sig.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 flex flex-col md:flex-row gap-4 items-start md:items-center">
                                            <div className="flex-1 space-y-3 w-full">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-500 mb-1">ชื่อ-สกุล</label>
                                                        <input
                                                            type="text"
                                                            value={sig.name}
                                                            onChange={(e) => updateSignature(sig.id, "name", e.target.value)}
                                                            className="w-full border border-slate-300 rounded-md py-1.5 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                                                            placeholder="( นายธรรม ทรงดี )"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-500 mb-1">ตำแหน่ง</label>
                                                        <input
                                                            type="text"
                                                            value={sig.position}
                                                            onChange={(e) => updateSignature(sig.id, "position", e.target.value)}
                                                            className="w-full border border-slate-300 rounded-md py-1.5 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                                                            placeholder="ผู้จัดการโครงการ"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(e) => handleSignatureUpload(e, sig.id)}
                                                        className="hidden"
                                                        id={`upload-sig-${sig.id}`}
                                                    />
                                                    <label
                                                        htmlFor={`upload-sig-${sig.id}`}
                                                        className="cursor-pointer inline-flex items-center px-3 py-1.5 border border-slate-300 rounded bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                                                    >
                                                        <UploadCloud className="w-4 h-4 mr-1" />
                                                        อัปโหลดรูปลายเซ็น
                                                    </label>

                                                    {sig.signatureUrl && (
                                                        <div className="h-10 px-2 bg-white border border-slate-200 rounded flex items-center justify-center">
                                                            <img src={sig.signatureUrl} alt="Sig Preview" className="max-h-full max-w-[120px] object-contain" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => removeSignature(sig.id)}
                                                className="text-red-500 hover:text-red-700 p-2"
                                                title="ลบลายเซ็น"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>
                )}

                {/* Vendor Types Section */}
                {activeTab === 'vendor' && (
                    <div className="p-8">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 mb-2">ประเภทคู่ค้า / ผู้ขาย (Vendor Categories)</h2>
                            <p className="text-sm text-slate-500 mb-6">
                                เพิ่มหรือลบประเภทสำหรับใช้จัดกลุ่มร้านค้า วัสดุ หรือผู้รับเหมาในระบบ
                            </p>
                        </div>

                        <div className="space-y-4 max-w-lg">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newVendorType}
                                    onChange={(e) => setNewVendorType(e.target.value)}
                                    placeholder="เช่น เครื่องมือช่าง, รถแบ็คโฮ"
                                    className="flex-1 border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (newVendorType.trim() && !settings.vendorTypes.includes(newVendorType.trim())) {
                                                setSettings(prev => ({
                                                    ...prev,
                                                    vendorTypes: [...prev.vendorTypes, newVendorType.trim()]
                                                }));
                                                setNewVendorType("");
                                            }
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (newVendorType.trim() && !settings.vendorTypes.includes(newVendorType.trim())) {
                                            setSettings(prev => ({
                                                ...prev,
                                                vendorTypes: [...prev.vendorTypes, newVendorType.trim()]
                                            }));
                                            setNewVendorType("");
                                        }
                                    }}
                                    className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition"
                                >
                                    เพิ่ม
                                </button>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 min-h-[100px]">
                                {settings.vendorTypes.length === 0 ? (
                                    <p className="text-slate-400 text-sm text-center py-4">ยังไม่มีประเภทคู่ค้า</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {settings.vendorTypes.map((vType, idx) => (
                                            <span key={idx} className="inline-flex items-center bg-white border border-slate-300 text-slate-700 text-sm font-medium px-3 py-1 rounded-full shadow-sm">
                                                {vType}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSettings(prev => ({
                                                            ...prev,
                                                            vendorTypes: prev.vendorTypes.filter(t => t !== vType)
                                                        }));
                                                    }}
                                                    className="ml-2 text-slate-400 hover:text-red-500 focus:outline-none focus:text-red-500 transition-colors"
                                                    title={`ลบ ${vType}`}
                                                >
                                                    &times;
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Item Units Section */}
                {activeTab === 'units' && (
                    <div className="p-8">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 mb-2">หน่วยนับ (Item Units)</h2>
                            <p className="text-sm text-slate-500 mb-6">
                                เพิ่มหรือลบหน่วยนับที่ใช้บ่อย เพื่อใช้เป็นตัวเลือกอัตโนมัติในหน้าสร้างใบสั่งซื้อ (PO)
                            </p>
                        </div>

                        <div className="space-y-4 max-w-lg">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newItemUnit}
                                    onChange={(e) => setNewItemUnit(e.target.value)}
                                    placeholder="เช่น ถุง, ตัน, คิว"
                                    className="flex-1 border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (newItemUnit.trim() && !settings.itemUnits?.includes(newItemUnit.trim())) {
                                                setSettings(prev => ({
                                                    ...prev,
                                                    itemUnits: [...(prev.itemUnits || ["ชิ้น", "อัน"]), newItemUnit.trim()]
                                                }));
                                                setNewItemUnit("");
                                            }
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (newItemUnit.trim() && !settings.itemUnits?.includes(newItemUnit.trim())) {
                                            setSettings(prev => ({
                                                ...prev,
                                                itemUnits: [...(prev.itemUnits || ["ชิ้น", "อัน"]), newItemUnit.trim()]
                                            }));
                                            setNewItemUnit("");
                                        }
                                    }}
                                    className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition"
                                >
                                    เพิ่ม
                                </button>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 min-h-[80px]">
                                {(!settings.itemUnits || settings.itemUnits.length === 0) ? (
                                    <p className="text-slate-400 text-sm text-center py-4">ยังไม่ได้ตั้งค่าหน่วยนับ</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {settings.itemUnits.map((unit, idx) => (
                                            <span key={idx} className="inline-flex items-center bg-white border border-slate-300 text-slate-700 text-sm font-medium px-3 py-1 rounded-full shadow-sm">
                                                {unit}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSettings(prev => ({
                                                            ...prev,
                                                            itemUnits: prev.itemUnits.filter(r => r !== unit)
                                                        }));
                                                    }}
                                                    className="ml-2 text-slate-400 hover:text-red-500 focus:outline-none transition-colors"
                                                    title={`ลบ ${unit}`}
                                                >
                                                    &times;
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Database Indexes Section */}
                {activeTab === 'database' && (
                    <div className="p-8">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center">
                                    <Database className="w-5 h-5 mr-2 text-blue-600" />
                                    ตัวช่วยสร้าง Database Index (ดัชนีฐานข้อมูล)
                                </h2>
                                <p className="text-sm text-slate-500">
                                    ตรวจสอบและสร้าง Index เพื่อให้การค้นหาเรียงลำดับเอกสาร PO/VO ในหน้าแอปพลิเคชันทำงานได้ถูกต้อง
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={checkIndexes}
                                className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                ตรวจสอบ
                            </button>
                        </div>

                        <div className="space-y-4">
                            {indexStatuses.map((idxStat, i) => (
                                <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                    <div className="mb-2 sm:mb-0">
                                        <h4 className="font-semibold text-slate-800 text-sm">{idxStat.name}</h4>
                                        {idxStat.status === 'idle' && <p className="text-xs text-slate-500 mt-1">กดปุ่มตรวจสอบเพื่อเช็คสถานะ</p>}
                                        {idxStat.status === 'loading' && <p className="text-xs text-blue-500 mt-1 flex items-center"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> กำลังตรวจสอบ...</p>}
                                        {idxStat.status === 'error' && <p className="text-xs text-red-500 mt-1">เกิดข้อผิดพลาด: {idxStat.errorMsg}</p>}
                                        {idxStat.status === 'ready' && <p className="text-xs text-green-600 mt-1 flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> พร้อมใช้งาน</p>}
                                        {idxStat.status === 'missing' && <p className="text-xs text-orange-500 mt-1 flex items-center"><ShieldAlert className="w-3 h-3 mr-1" /> พบว่ายังไม่มี Index นี้ในระบบ</p>}
                                    </div>
                                    <div className="flex items-center">
                                        {idxStat.status === 'missing' && idxStat.link && (
                                            <a
                                                href={idxStat.link}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center px-3 py-1.5 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg text-sm font-semibold transition-colors"
                                            >
                                                <ExternalLink className="w-4 h-4 mr-1.5" />
                                                คลิกเพื่อสร้าง Index
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end space-x-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-500 shadow-sm transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        บันทึกการตั้งค่าทั้งหมด
                    </button>
                </div>
            </form>
        </div>
    );
}
