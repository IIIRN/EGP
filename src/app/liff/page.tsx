"use client";

import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { db } from "@/lib/firebase";
import { FileText, FileEdit, Phone, MapPin, Search, ChevronRight, Loader2, Info, Store, ChevronDown, Filter } from "lucide-react";
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, limit } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PurchaseOrder } from "@/types/po";
import { VariationOrder } from "@/types/vo";
import { Vendor } from "@/types/vendor";
import liff from "@line/liff";

interface POWithVendor extends PurchaseOrder {
    vendorPhone?: string;
    vendorMap?: string;
    vendorAddress?: string;
}

export default function LiffDashboard() {
    const { user, userProfile } = useAuth();
    const { currentProject, projects, setCurrentProject } = useProject();

    const [activeTab, setActiveTab] = useState<"PO" | "Vendors">("PO");
    const [pos, setPos] = useState<POWithVendor[]>([]);
    const [poSearch, setPoSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [vendorSearch, setVendorSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [poLimit, setPoLimit] = useState(20);
    const [liffInitialized, setLiffInitialized] = useState(false);

    const filteredPOs = pos.filter(po => {
        const matchesSearch = po.poNumber.toLowerCase().includes(poSearch.toLowerCase()) ||
            po.vendorName?.toLowerCase().includes(poSearch.toLowerCase());
        const matchesStatus = statusFilter === "all" || po.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const filteredVendors = vendors.filter(v =>
        v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
        (v.taxId && v.taxId.includes(vendorSearch)) ||
        (v.contactName && v.contactName.toLowerCase().includes(vendorSearch.toLowerCase())) ||
        (v.vendorTypes && v.vendorTypes.some(t => t.toLowerCase().includes(vendorSearch.toLowerCase())))
    );

    // defaults to true unless explicitly false in .env
    const isDevMode = process.env.NEXT_PUBLIC_SHOW_DEV_MODE !== "false";

    useEffect(() => {
        const initLiff = async () => {
            const isLiffBrowser = typeof window !== "undefined" && /Line/i.test(navigator.userAgent);

            if (isDevMode && !isLiffBrowser) {
                setLiffInitialized(true);
                return;
            }

            try {
                await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || "1234567890-AbcdEfgh" });
                if (!liff.isLoggedIn()) {
                    liff.login({ redirectUri: window.location.href });
                    return;
                }

                // Get LINE Profile and login to Firebase
                const profile = await liff.getProfile();

                // Even if we already have Firebase user, it's safer to ensure the correct user is signed in
                const res = await fetch("/api/auth/line-login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ lineUserId: profile.userId })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.customToken && data.success) {
                        const { signInWithCustomToken } = await import("firebase/auth");
                        const { auth } = await import("@/lib/firebase");
                        await signInWithCustomToken(auth, data.customToken);
                    }
                } else {
                    console.log("LINE userId is not registered to any user.");
                }

                setLiffInitialized(true);
            } catch (err) {
                console.error("LIFF Init Error:", err);
                setLiffInitialized(true); // fall-through to avoid entirely blocking
            }
        };

        if (typeof window !== "undefined") {
            initLiff();
        }
    }, [isDevMode]);

    useEffect(() => {
        if (!user || !currentProject) {
            setLoading(false);
            return;
        }

        setLoading(true);

        // Fetch POs (with limit for performance)
        const poQ = query(
            collection(db, "purchase_orders"),
            where("projectId", "==", currentProject.id),
            where("createdBy", "==", user.uid),
            orderBy("createdAt", "desc"),
            limit(poLimit)
        );
        const unsubPO = onSnapshot(poQ, async (snapshot) => {
            const poData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder));

            // Fetch Vendor Info for each PO
            const poWithVendors: POWithVendor[] = [];
            for (const po of poData) {
                let vendorInfo = {};
                if (po.vendorId) {
                    try {
                        const vendorDoc = await getDoc(doc(db, "vendors", po.vendorId));
                        if (vendorDoc.exists()) {
                            const vData = vendorDoc.data();
                            vendorInfo = {
                                vendorPhone: vData.phone,
                                vendorMap: vData.googleMapUrl,
                                vendorAddress: vData.address
                            };
                        }
                    } catch (e) {
                        console.log("Error fetching vendor", e);
                    }
                }
                poWithVendors.push({ ...po, ...vendorInfo });
            }

            setPos(poWithVendors);
            setLoading(false);
        });

        // Fetch Global Vendors (Active)
        const vendorQ = query(collection(db, "vendors"), where("isActive", "==", true));
        const unsubVendor = onSnapshot(vendorQ, (snapshot) => {
            setVendors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor)));
        });

        return () => {
            unsubPO();
            unsubVendor();
        };
    }, [user, currentProject]);

    if (!liffInitialized) {
        return (
            <div className="flex flex-col items-center justify-center p-8 h-screen bg-slate-50 text-center">
                <Loader2 className="w-10 h-10 text-[#00c300] animate-spin mb-4" />
                <p className="text-slate-500 font-medium tracking-wide">กำลังเชื่อมต่อ LINE...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center p-8 h-screen bg-slate-50 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <Info className="w-8 h-8 text-blue-500" />
                </div>
                <h2 className="text-xl font-bold mb-2 text-slate-800">กรุณาเข้าสู่ระบบ</h2>
                <p className="text-slate-500 mb-6">คุณต้องลงชื่อเข้าใช้ก่อนถึงจะดูข้อมูลสำหรับมือถือได้</p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <Link href="/login" className="bg-blue-600 text-white px-6 py-3 rounded-full font-semibold shadow-lg w-full">
                        ไปที่หน้า Login
                    </Link>
                    <Link href="/liff/binding" className="bg-white text-[#00c300] border border-[#00c300] px-6 py-3 rounded-full font-semibold shadow-sm w-full">
                        ลงทะเบียนผ่านเบอร์ติดต่อ
                    </Link>
                </div>
            </div>
        );
    }

    if (!currentProject) {
        return (
            <div className="flex flex-col items-center justify-center p-8 h-[80vh] text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-orange-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">ยังไม่ได้ดึงข้อมูลโครงการ</h3>
                <p className="text-slate-500 mb-6 text-sm">เนื่องจากเปิดผ่านมือถือ กรุณารอสักครู่ให้ตัวระบบโหลดโครงการของคุณ</p>
                {loading && <Loader2 className="animate-spin text-blue-500" size={32} />}
            </div>
        );
    }

    const POStatusBadge = ({ status }: { status: string }) => {
        switch (status) {
            case 'approved': return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">อนุมัติแล้ว</span>;
            case 'rejected': return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">ไม่อนุมัติ</span>;
            case 'pending': return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">รออนุมัติ</span>;
            default: return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">ฉบับร่าง</span>;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Mobile Header - Enhanced with Gradient and Glassmorphism */}
            <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white p-4 pt-8 rounded-b-[2rem] shadow-xl shadow-blue-900/10 sticky top-0 z-40 overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>

                <div className="flex justify-between items-center mb-5 relative z-10">
                    <div className="flex-1 max-w-[80%] pr-4">
                        <div className="flex items-center space-x-2">
                            <h1 className="text-xl font-bold">โครงการปัจจุบัน</h1>
                            {isDevMode && (
                                <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full border border-white/30 backdrop-blur-sm">DEV MODE</span>
                            )}
                        </div>
                        <div className="relative mt-1">
                            <select
                                className="w-full bg-white/20 text-white border border-white/20 rounded-lg py-1.5 pl-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-white/50 appearance-none font-semibold truncate"
                                value={currentProject.id}
                                onChange={(e) => {
                                    const selected = projects.find(p => p.id === e.target.value);
                                    if (selected) {
                                        setCurrentProject(selected);
                                    }
                                }}
                            >
                                {projects.map(p => (
                                    <option key={p.id} value={p.id} className="text-slate-900 bg-white">
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white pointer-events-none" />
                        </div>
                    </div>
                    {/* User Profile Thumbnail */}
                    <div className="flex flex-col items-center shrink-0 ml-2">
                        <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30 font-bold overflow-hidden shadow-sm">
                            {userProfile?.lineProfilePic ? (
                                <img src={userProfile.lineProfilePic} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                user?.email?.charAt(0).toUpperCase()
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Actions - Glassmorphism style */}
                <div className="flex gap-3 mb-4 relative z-10">
                    <Link href="/liff/po/create" className="flex-1 flex justify-center items-center py-2.5 px-1 bg-white/15 hover:bg-white/25 rounded-2xl text-[11px] sm:text-xs font-bold transition-all border border-white/20 backdrop-blur-md shadow-lg shadow-black/5 active:scale-95">
                        <span className="bg-white text-blue-700 w-4 h-4 rounded-full flex items-center justify-center mr-1.5 text-sm leading-none pb-0.5 shadow-sm">+</span>
                        สร้าง PO
                    </Link>
                    <Link href="/liff/vendors/create" className="flex-1 flex justify-center items-center py-2.5 px-1 bg-white/15 hover:bg-white/25 rounded-2xl text-[11px] sm:text-xs font-bold transition-all border border-white/20 backdrop-blur-md shadow-lg shadow-black/5 active:scale-95">
                        <span className="bg-white text-blue-700 w-4 h-4 rounded-full flex items-center justify-center mr-1.5 text-sm leading-none pb-0.5 shadow-sm">+</span>
                        เพิ่มคู่ค้า
                    </Link>
                </div>

                {/* Tabs - Refined shape */}
                <div className="flex bg-black/10 p-1 rounded-2xl backdrop-blur-lg border border-white/10 relative z-10">
                    <button
                        onClick={() => setActiveTab("PO")}
                        className={`flex-1 flex justify-center items-center py-2.5 text-[11px] sm:text-xs font-bold rounded-xl transition-all ${activeTab === 'PO' ? 'bg-white text-blue-700 shadow-lg' : 'text-white/80'}`}
                    >
                        <FileText size={15} className="mr-1.5" />
                        ใบสั่งซื้อ
                    </button>
                    <button
                        onClick={() => setActiveTab("Vendors")}
                        className={`flex-1 flex justify-center items-center py-2.5 text-[11px] sm:text-xs font-bold rounded-xl transition-all ${activeTab === 'Vendors' ? 'bg-white text-blue-700 shadow-lg' : 'text-white/80'}`}
                    >
                        <Store size={15} className="mr-1.5" />
                        คู่ค้า
                    </button>
                </div>
            </div>

            <main className="p-4 space-y-4">
                {/* Search & Filters for PO */}
                {!loading && activeTab === 'PO' && (
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="ค้นหาเลขที่ PO หรือชื่อร้านค้า..."
                                value={poSearch}
                                onChange={(e) => setPoSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-slate-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium"
                            />
                        </div>

                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide no-scrollbar -mx-1 px-1">
                            {['all', 'pending', 'approved', 'rejected', 'draft'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-4 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all border ${statusFilter === status
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200'
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                                        }`}
                                >
                                    {status === 'all' ? 'ทั้งหมด' :
                                        status === 'pending' ? 'รออนุมัติ' :
                                            status === 'approved' ? 'อนุมัติแล้ว' :
                                                status === 'rejected' ? 'ไม่อนุมัติ' : 'ฉบับร่าง'}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {loading && (
                    <div className="flex justify-center py-10">
                        <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
                    </div>
                )}

                {/* PO Content */}
                {!loading && activeTab === 'PO' && filteredPOs.map(po => (
                    <div key={po.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all active:scale-[0.98]">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col">
                                <span className="font-black text-slate-800 text-lg tracking-tight">{po.poNumber}</span>
                                {po.poType === 'extra' && (
                                    <span className="text-[9px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-lg font-black w-fit mt-1 border border-amber-100 uppercase tracking-tighter">
                                        PO เพิ่มเติม
                                    </span>
                                )}
                            </div>
                            <POStatusBadge status={po.status} />
                        </div>
                        <p className="text-sm font-bold text-slate-700 mb-1 line-clamp-1">{po.vendorName}</p>
                        <div className="flex justify-between items-end">
                            <p className="text-xs font-medium text-slate-400">ยอดรวม: <span className="text-slate-600 font-bold">฿{po.totalAmount?.toLocaleString()}</span></p>
                            <span className="text-[10px] text-slate-300 font-medium">{(po.createdAt as any)?.toDate().toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                        </div>

                        <div className="flex gap-2 mt-4">
                            <a
                                href={po.vendorPhone ? `tel:${po.vendorPhone}` : '#'}
                                className={`flex-1 flex justify-center items-center py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${po.vendorPhone ? 'bg-green-50 text-green-600 border border-green-100 active:bg-green-100 shadow-sm shadow-green-100/50' : 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'}`}
                                onClick={(e) => !po.vendorPhone && e.preventDefault()}
                            >
                                <Phone size={14} className="mr-1.5" /> โทรออก
                            </a>
                            <a
                                href={po.vendorMap || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex-1 flex justify-center items-center py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${po.vendorMap ? 'bg-blue-50 text-blue-600 border border-blue-100 active:bg-blue-100 shadow-sm shadow-blue-100/50' : 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'}`}
                                onClick={(e) => !po.vendorMap && e.preventDefault()}
                            >
                                <MapPin size={14} className="mr-1.5" /> แผนที่
                            </a>
                            <Link
                                href={`/liff/po/${po.id}`}
                                className="w-12 flex justify-center items-center py-2.5 rounded-xl bg-slate-900 text-white shadow-lg shadow-slate-200 active:bg-slate-800 transition-all font-bold"
                            >
                                <ChevronRight size={18} />
                            </Link>
                        </div>
                    </div>
                ))}

                {!loading && activeTab === 'PO' && pos.length > 0 && filteredPOs.length < pos.length && (
                    <div className="text-center py-4">
                        <button
                            onClick={() => setPoLimit(prev => prev + 20)}
                            className="bg-white border border-slate-200 px-6 py-2.5 rounded-2xl text-xs font-bold text-slate-600 shadow-sm active:bg-slate-50"
                        >
                            โหลดเพิ่มเติม...
                        </button>
                    </div>
                )}

                {!loading && activeTab === 'PO' && pos.length === 0 && (
                    <div className="text-center text-slate-400 py-16 flex flex-col items-center">
                        <FileText size={48} className="text-slate-200 mb-3" />
                        <p className="font-bold text-sm">ไม่มีใบสั่งซื้อในโครงการนี้</p>
                    </div>
                )}

                {!loading && activeTab === 'PO' && pos.length > 0 && filteredPOs.length === 0 && (
                    <div className="text-center text-slate-400 py-16">
                        <p className="text-sm font-medium">ไม่พบข้อมูลที่ค้นหา</p>
                    </div>
                )}



                {/* Vendors Content */}
                {!loading && activeTab === 'Vendors' && (
                    <div className="mb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="ค้นหาร้านค้า, ประเภท หรือบุคคลติดต่อ..."
                                value={vendorSearch}
                                onChange={(e) => setVendorSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 bg-white focus:ring-blue-500 focus:border-blue-500 rounded-lg shadow-sm"
                            />
                        </div>
                    </div>
                )}

                {!loading && activeTab === 'Vendors' && filteredVendors.map(v => (
                    <div key={v.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-slate-800 text-lg line-clamp-1">{v.name}</span>
                        </div>
                        {v.vendorTypes && v.vendorTypes.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1 mb-2.5">
                                {v.vendorTypes.map(tag => (
                                    <span key={tag} className="bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                        <p className="text-sm font-medium text-slate-700 mb-1">ติดต่อ: {v.contactName}</p>

                        <div className="flex gap-2 mt-4">
                            <a
                                href={v.phone ? `tel:${v.phone}` : '#'}
                                className={`flex-1 flex justify-center items-center py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${v.phone ? 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100' : 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed'}`}
                                onClick={(e) => !v.phone && e.preventDefault()}
                            >
                                <Phone size={14} className="mr-1.5" /> {v.phone || "ไม่มีเบอร์"}
                            </a>
                            <a
                                href={v.googleMapUrl || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex-1 flex justify-center items-center py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${v.googleMapUrl ? 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100' : 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed'}`}
                                onClick={(e) => !v.googleMapUrl && e.preventDefault()}
                            >
                                <MapPin size={14} className="mr-1.5" /> แผนที่ร้าน
                            </a>
                        </div>
                    </div>
                ))}

                {!loading && activeTab === 'Vendors' && filteredVendors.length === 0 && (
                    <div className="text-center text-slate-400 py-10">
                        {vendorSearch ? "ไม่พบร้านค้าที่ตรงกับคำค้นหา" : "ไม่มีข้อมูลร้านค้าหรือคู่ค้า"}
                    </div>
                )}

            </main>
        </div>
    );
}
