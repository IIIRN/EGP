"use client";

import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
import { FileText, FileEdit, Phone, MapPin, Search, ChevronRight, Loader2, Info, Store } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PurchaseOrder } from "@/types/po";
import { VariationOrder } from "@/types/vo";
import { Vendor } from "@/types/vendor";

interface POWithVendor extends PurchaseOrder {
    vendorPhone?: string;
    vendorMap?: string;
    vendorAddress?: string;
}

export default function LiffDashboard() {
    const { user } = useAuth();
    const { currentProject } = useProject();

    const [activeTab, setActiveTab] = useState<"PO" | "VO" | "Vendors">("PO");
    const [pos, setPos] = useState<POWithVendor[]>([]);
    const [vos, setVos] = useState<VariationOrder[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !currentProject) {
            setLoading(false);
            return;
        }

        setLoading(true);

        // Fetch POs
        const poQ = query(
            collection(db, "purchase_orders"),
            where("projectId", "==", currentProject.id),
            where("createdBy", "==", user.uid),
            orderBy("createdAt", "desc")
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
        });

        // Fetch VOs
        const voQ = query(
            collection(db, "variation_orders"),
            where("projectId", "==", currentProject.id),
            where("createdBy", "==", user.uid),
            orderBy("createdAt", "desc")
        );
        const unsubVO = onSnapshot(voQ, (snapshot) => {
            setVos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VariationOrder)));
            setLoading(false); // Assume done when VOs load
        });

        // Fetch Global Vendors (Active)
        const vendorQ = query(collection(db, "vendors"), where("isActive", "==", true));
        const unsubVendor = onSnapshot(vendorQ, (snapshot) => {
            setVendors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor)));
        });

        return () => {
            unsubPO();
            unsubVO();
            unsubVendor();
        };
    }, [user, currentProject]);

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center p-8 h-screen bg-slate-50 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <Info className="w-8 h-8 text-blue-500" />
                </div>
                <h2 className="text-xl font-bold mb-2 text-slate-800">กรุณาเข้าสู่ระบบ</h2>
                <p className="text-slate-500 mb-6">คุณต้องลงชื่อเข้าใช้ก่อนถึงจะดูข้อมูลสำหรับมือถือได้</p>
                <Link href="/login" className="bg-blue-600 text-white px-6 py-3 rounded-full font-semibold shadow-lg">
                    ไปที่หน้า Login
                </Link>
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
            {/* Mobile Header */}
            <div className="bg-blue-600 text-white p-4 pt-8 rounded-b-3xl shadow-md sticky top-0 z-40">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <div className="flex items-center space-x-2">
                            <h1 className="text-xl font-bold">โครงการปัจจุบัน</h1>
                            <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full border border-white/30 backdrop-blur-sm">DEV MODE</span>
                        </div>
                        <p className="opacity-90 text-sm truncate w-64">{currentProject.name}</p>
                    </div>
                    {/* User Profile Thumbnail */}
                    <div className="flex flex-col items-center">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30 font-bold mb-1">
                            {user?.email?.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 mb-4">
                    <Link href="/liff/po/create" className="flex-1 flex justify-center items-center py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold transition-colors border border-white/20 backdrop-blur-sm">
                        <span className="bg-white text-blue-600 w-5 h-5 rounded-full flex items-center justify-center mr-2 text-lg leading-none pb-0.5">+</span>
                        สร้าง PO
                    </Link>
                    <Link href="/liff/vo/create" className="flex-1 flex justify-center items-center py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold transition-colors border border-white/20 backdrop-blur-sm">
                        <span className="bg-white text-blue-600 w-5 h-5 rounded-full flex items-center justify-center mr-2 text-lg leading-none pb-0.5">+</span>
                        สร้าง VO
                    </Link>
                    <Link href="/liff/vendors/create" className="flex-1 flex justify-center items-center py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold transition-colors border border-white/20 backdrop-blur-sm">
                        <span className="bg-white text-blue-600 w-5 h-5 rounded-full flex items-center justify-center mr-2 text-lg leading-none pb-0.5">+</span>
                        เพิ่มคู่ค้า
                    </Link>
                </div>

                {/* Tabs */}
                <div className="flex bg-white/20 p-1 rounded-full backdrop-blur-sm">
                    <button
                        onClick={() => setActiveTab("PO")}
                        className={`flex-1 flex justify-center items-center py-2 text-sm font-semibold rounded-full transition-colors ${activeTab === 'PO' ? 'bg-white text-blue-600 shadow-sm' : 'text-white'}`}
                    >
                        <FileText size={16} className="mr-2" />
                        ใบสั่งซื้อ (PO)
                    </button>
                    <button
                        onClick={() => setActiveTab("VO")}
                        className={`flex-1 flex justify-center items-center py-2 text-sm font-semibold rounded-full transition-colors ${activeTab === 'VO' ? 'bg-white text-blue-600 shadow-sm' : 'text-white'}`}
                    >
                        <FileEdit size={16} className="mr-2" />
                        เพิ่ม-ลด (VO)
                    </button>
                    <button
                        onClick={() => setActiveTab("Vendors")}
                        className={`flex-1 flex justify-center items-center py-2 text-sm font-semibold rounded-full transition-colors ${activeTab === 'Vendors' ? 'bg-white text-blue-600 shadow-sm' : 'text-white'}`}
                    >
                        <Store size={16} className="mr-2" />
                        คู่ค้า
                    </button>
                </div>
            </div>

            <main className="p-4 space-y-4">
                {loading && (
                    <div className="flex justify-center py-10">
                        <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
                    </div>
                )}

                {/* PO Content */}
                {!loading && activeTab === 'PO' && pos.map(po => (
                    <div key={po.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-slate-800 text-lg">{po.poNumber}</span>
                            <POStatusBadge status={po.status} />
                        </div>
                        <p className="text-sm font-medium text-slate-600 mb-1 line-clamp-1">{po.vendorName}</p>
                        <p className="text-sm text-slate-500 mb-4 line-clamp-1">ยอดรวม: ฿{po.totalAmount?.toLocaleString()}</p>

                        <div className="flex gap-2">
                            <a
                                href={po.vendorPhone ? `tel:${po.vendorPhone}` : '#'}
                                className={`flex-1 flex justify-center items-center py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${po.vendorPhone ? 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100' : 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed'}`}
                                onClick={(e) => !po.vendorPhone && e.preventDefault()}
                            >
                                <Phone size={14} className="mr-1.5" /> โทรออก
                            </a>
                            <a
                                href={po.vendorMap || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex-1 flex justify-center items-center py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${po.vendorMap ? 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100' : 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed'}`}
                                onClick={(e) => !po.vendorMap && e.preventDefault()}
                            >
                                <MapPin size={14} className="mr-1.5" /> แผนที่
                            </a>
                            <Link
                                href={`/po/${po.id}`}
                                className="w-10 flex justify-center items-center py-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100"
                            >
                                <ChevronRight size={18} />
                            </Link>
                        </div>
                    </div>
                ))}

                {!loading && activeTab === 'PO' && pos.length === 0 && (
                    <div className="text-center text-slate-400 py-10">
                        ไม่มีรายการสั่งซื้อ (PO) ในโครงการนี้
                    </div>
                )}

                {/* VO Content */}
                {!loading && activeTab === 'VO' && vos.map(vo => (
                    <div key={vo.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-slate-800 text-lg">{vo.voNumber}</span>
                            <POStatusBadge status={vo.status} />
                        </div>
                        <p className="text-sm font-medium text-slate-700 mb-1 line-clamp-2">{vo.title}</p>
                        <p className="text-xs text-slate-500 mb-3 pr-4 line-clamp-2">{vo.reason || 'ไม่ได้ระบุเหตุผล'}</p>

                        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                            <span className="text-xs font-semibold text-slate-500 uppercase">ยอดสุทธิรวม</span>
                            <span className={`font-bold ${vo.totalAmount > 0 ? 'text-red-600' : vo.totalAmount < 0 ? 'text-green-600' : 'text-slate-900'}`}>
                                {vo.totalAmount > 0 ? '+' : ''}฿ {vo.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>

                        <div className="mt-3">
                            <Link
                                href={`/vo/${vo.id}`}
                                className="w-full flex justify-center items-center py-2 rounded-lg bg-blue-50 text-blue-600 font-semibold border border-blue-200 hover:bg-blue-100 text-sm"
                            >
                                ดูรายละเอียดเอกสาร <ChevronRight size={16} className="ml-1" />
                            </Link>
                        </div>
                    </div>
                ))}

                {!loading && activeTab === 'VO' && vos.length === 0 && (
                    <div className="text-center text-slate-400 py-10">
                        ไม่มีรายการงานเพิ่ม-ลด (VO) ในโครงการนี้
                    </div>
                )}

                {/* Vendors Content */}
                {!loading && activeTab === 'Vendors' && vendors.map(v => (
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

                {!loading && activeTab === 'Vendors' && vendors.length === 0 && (
                    <div className="text-center text-slate-400 py-10">
                        ไม่มีข้อมูลร้านค้าหรือคู่ค้า
                    </div>
                )}

            </main>
        </div>
    );
}
