"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Save, Loader2, Tag } from "lucide-react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Vendor } from "@/types/vendor";

export default function CreateVendorPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState<Partial<Vendor>>({
        name: "",
        taxId: "",
        contactName: "",
        phone: "",
        email: "",
        address: "",
        googleMapUrl: "",
        vendorTypes: [],
        isActive: true
    });

    const [availableTypes, setAvailableTypes] = useState<string[]>([]);

    useState(() => {
        async function fetchVendorTypes() {
            try {
                const docRef = doc(db, "system_settings", "global_config");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.vendorTypes) {
                        setAvailableTypes(data.vendorTypes);
                    }
                }
            } catch (error) {
                console.error("Error fetching vendor types:", error);
            }
        }
        fetchVendorTypes();
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleTypeChange = (type: string) => {
        setFormData(prev => {
            const currentTypes = prev.vendorTypes || [];
            if (currentTypes.includes(type)) {
                return { ...prev, vendorTypes: currentTypes.filter(t => t !== type) };
            } else {
                return { ...prev, vendorTypes: [...currentTypes, type] };
            }
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.contactName || !formData.phone) {
            alert("à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸—à¸µà¹ˆà¸¡à¸µà¸”à¸­à¸à¸ˆà¸±à¸™ (*) à¹ƒà¸«à¹‰à¸„à¸£à¸šà¸–à¹‰à¸§à¸™");
            return;
        }

        setSaving(true);

        try {
            const newVendor = {
                ...formData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await addDoc(collection(db, "vendors"), newVendor);

            router.push("/liff");
        } catch (error) {
            console.error("Error adding vendor:", error);
            alert("à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸„à¸¹à¹ˆà¸„à¹‰à¸²à¹„à¸”à¹‰ à¹‚à¸›à¸£à¸”à¸¥à¸­à¸‡à¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡");
            setSaving(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">

            <div className="flex items-center space-x-4">
                <Link href="/liff" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">à¹€à¸žà¸´à¹ˆà¸¡à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¸„à¸¹à¹ˆà¸„à¹‰à¸²à¹ƒà¸«à¸¡à¹ˆ</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        à¸à¸£à¸­à¸à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸šà¸£à¸´à¸©à¸±à¸—à¸œà¸¹à¹‰à¸‚à¸²à¸¢à¹ƒà¸«à¸¡à¹ˆà¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸š
                    </p>
                </div>
            </div>

            <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 md:p-8 space-y-6">

                    <div className="flex items-center space-x-3 mb-6">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800">à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸šà¸£à¸´à¸©à¸±à¸—</h3>
                            <p className="text-sm text-slate-500">à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸žà¸·à¹‰à¸™à¸à¸²à¸™à¸‚à¸­à¸‡à¸™à¸´à¸•à¸´à¸šà¸¸à¸„à¸„à¸¥</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">à¸Šà¸·à¹ˆà¸­à¸šà¸£à¸´à¸©à¸±à¸— / à¸£à¹‰à¸²à¸™à¸„à¹‰à¸² <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="name"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="à¹€à¸Šà¹ˆà¸™ à¸šà¸£à¸´à¸©à¸±à¸— à¸šà¸¸à¸à¸–à¸²à¸§à¸£à¹€à¸‹à¸£à¸²à¸¡à¸´à¸„ à¸ˆà¸³à¸à¸±à¸”"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">à¹€à¸¥à¸‚à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¸™à¸´à¸•à¸´à¸šà¸¸à¸„à¸„à¸¥ / à¸œà¸¹à¹‰à¹€à¸ªà¸µà¸¢à¸ à¸²à¸©à¸µ</label>
                            <input
                                type="text"
                                name="taxId"
                                value={formData.taxId}
                                onChange={handleChange}
                                placeholder="à¹€à¸¥à¸‚à¸›à¸£à¸°à¸ˆà¸³à¸•à¸±à¸§à¸œà¸¹à¹‰à¹€à¸ªà¸µà¸¢à¸ à¸²à¸©à¸µ 13 à¸«à¸¥à¸±à¸ (à¸–à¹‰à¸²à¸£à¸°à¸šà¸¸)"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white font-mono"
                            />
                        </div>
                    </div>

                    {availableTypes.length > 0 && (
                        <>
                            <hr className="border-slate-100 my-6" />

                            <div className="flex items-center space-x-3 mb-4">
                                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
                                    <Tag size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-slate-800">à¸›à¸£à¸°à¹€à¸ à¸—à¸„à¸¹à¸„à¹‰à¸² / à¸ªà¸´à¸™à¸„à¹‰à¸²</h3>
                                    <p className="text-sm text-slate-500">à¹€à¸¥à¸·à¸­à¸à¸›à¸£à¸°à¹€à¸ à¸—à¹€à¸žà¸·à¹ˆà¸­à¹ƒà¸«à¹‰à¸‡à¹ˆà¸²à¸¢à¸•à¹ˆà¸­à¸à¸²à¸£à¸„à¹‰à¸™à¸«à¸²</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {availableTypes.map(type => {
                                    const isSelected = formData.vendorTypes?.includes(type);
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => handleTypeChange(type)}
                                            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${isSelected ? 'bg-purple-100 border-purple-300 text-purple-700 shadow-sm' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            {type}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    <hr className="border-slate-100 my-6" />

                    <h3 className="text-base font-semibold text-slate-800 mb-4">à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸à¸²à¸£à¸•à¸´à¸”à¸•à¹ˆà¸­</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">à¸Šà¸·à¹ˆà¸­à¸œà¸¹à¹‰à¸•à¸´à¸”à¸•à¹ˆà¸­ (à¹€à¸‹à¸¥à¸ªà¹Œ) <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="contactName"
                                required
                                value={formData.contactName}
                                onChange={handleChange}
                                placeholder="à¸Šà¸·à¹ˆà¸­-à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥ à¸‚à¸­à¸‡à¸œà¸¹à¹‰à¹à¸—à¸™à¸à¹ˆà¸²à¸¢à¸‚à¸²à¸¢"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">à¹€à¸šà¸­à¸£à¹Œà¹‚à¸—à¸£à¸¨à¸±à¸žà¸—à¹Œ <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="phone"
                                required
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="à¹€à¸Šà¹ˆà¸™ 081-xxx-xxxx"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">à¸­à¸µà¹€à¸¡à¸¥</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="email@vendor.com"
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆà¸˜à¸¸à¸£à¸à¸´à¸ˆ</label>
                            <textarea
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                rows={3}
                                placeholder="à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆà¸ªà¸³à¸«à¸£à¸±à¸šà¸­à¸­à¸à¹ƒà¸šà¹à¸ˆà¹‰à¸‡à¸«à¸™à¸µà¹‰ / à¹ƒà¸šà¹€à¸ªà¸£à¹‡à¸ˆà¸£à¸±à¸šà¹€à¸‡à¸´à¸™..."
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">à¸¥à¸´à¸‡à¸à¹Œà¸•à¸³à¹à¸«à¸™à¹ˆà¸‡à¸£à¹‰à¸²à¸™ (Google Maps)</label>
                            <input
                                type="url"
                                name="googleMapUrl"
                                value={formData.googleMapUrl || ""}
                                onChange={handleChange}
                                placeholder="https://maps.app.goo.gl/..."
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-blue-600"
                            />
                        </div>
                    </div>

                </div>

                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end space-x-3">
                    <Link
                        href="/liff"
                        className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                    >
                        à¸¢à¸à¹€à¸¥à¸´à¸
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition-colors"
                    >
                        {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                        à¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸„à¸¹à¹ˆà¸„à¹‰à¸²
                    </button>
                </div>
            </form>

        </div>
    );
}


