"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, Printer, FileText, Loader2, Edit } from "lucide-react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { WorkContract } from "@/types/wc";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";

export default function WCDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { userProfile } = useAuth();
    const { currentProject } = useProject();

    const [wc, setWc] = useState<WorkContract | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [companySettings, setCompanySettings] = useState({
        name: "บริษัท พาวเวอร์เทค เอนจิเนียริ่ง จำกัด",
        address: "9/10 ถ.มิตรสาร ต.ประตูชัย อ.พระนครศรีอยุธยา จ.พระนครศรีอยุธยา 13000",
        phone: "083-995-5629, 083-995-4495",
        email: "Powertec.civil@gmail.com",
        logoUrl: "",
        signatureUrl: "",
        signatures: [] as any[]
    });

    useEffect(() => {
        async function fetchData() {
            if (!resolvedParams.id) return;
            try {
                const configRef = doc(db, "system_settings", "global_config");
                const configSnap = await getDoc(configRef);
                if (configSnap.exists() && configSnap.data().companySettings) {
                    setCompanySettings(configSnap.data().companySettings);
                }

                const docRef = doc(db, "work_contracts", resolvedParams.id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setWc({ id: docSnap.id, ...docSnap.data() } as WorkContract);
                } else {
                    console.error("No such document!");
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [resolvedParams.id]);

    const handleStatusUpdate = async (newStatus: "approved" | "rejected") => {
        if (!wc || !userProfile) return;
        setActionLoading(true);

        try {
            const wcRef = doc(db, "work_contracts", wc.id);
            await updateDoc(wcRef, {
                status: newStatus,
                updatedAt: serverTimestamp(),
            });

            if (newStatus === "approved") {
                try {
                    await fetch("/api/line/notify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "WC",
                            data: { ...wc, status: newStatus },
                            projectName: currentProject?.name
                        })
                    });
                } catch (e) {
                    console.error("Line notification failed:", e);
                }
            }

            setWc({ ...wc, status: newStatus });

        } catch (error) {
            console.error("Error updating WC status:", error);
            alert("ไม่สามารถอัปเดตสถานะได้");
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return "-";
        try {
            return new Date(dateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="animate-spin w-8 h-8 text-emerald-600 mb-4" />
                <p className="text-slate-500">กำลังโหลดข้อมูลใบจ้างงาน...</p>
            </div>
        );
    }

    if (!wc) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
                <FileText className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">ไม่พบข้อมูล</h3>
                <p>ไม่พบใบจ้างงานที่คุณกำลังค้นหา อาจถูกลบหรือไม่มีอยู่จริง</p>
                <Link href="/wc" className="mt-4 inline-block text-emerald-600 hover:underline">กลับไปหน้ารายการใบจ้างงาน</Link>
            </div>
        );
    }

    const isPending = wc.status === "pending";
    const canApprove = userProfile?.role === "admin" || userProfile?.role === "pm";

    return (
        <div className="max-w-4xl mx-auto space-y-6 print:space-y-0 print:m-0 print:w-full print:max-w-none">

            {/* Header Actions */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between print:hidden">
                <div className="flex items-center space-x-4">
                    <Link href="/wc" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors shrink-0">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-slate-900">รายละเอียดใบจ้างงาน</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {wc.wcNumber} • โครงการ: {currentProject?.name}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => window.print()}
                        className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                    >
                        <Printer size={16} className="mr-2" />
                        พิมพ์ PDF
                    </button>

                    {(wc.status === "draft" || wc.status === "rejected") && (
                        <Link
                            href={`/wc/${wc.id}/edit`}
                            className="inline-flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-emerald-100 transition-colors"
                        >
                            <Edit size={16} className="mr-2" />
                            แก้ไขใบจ้างงาน
                        </Link>
                    )}

                    {isPending && canApprove && (
                        <>
                            <button
                                onClick={() => handleStatusUpdate("rejected")}
                                disabled={actionLoading}
                                className="inline-flex items-center justify-center rounded-lg bg-white border border-red-200 text-red-600 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                                <XCircle size={16} className="mr-2" />
                                ไม่อนุมัติ
                            </button>
                            <button
                                onClick={() => handleStatusUpdate("approved")}
                                disabled={actionLoading}
                                className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 transition-colors disabled:opacity-50"
                            >
                                {actionLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CheckCircle size={16} className="mr-2" />}
                                อนุมัติใบจ้างงาน
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Document Content */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto print:overflow-visible print:shadow-none print:border-0 print:rounded-none">
                <div className="p-8 space-y-8 min-w-[800px] print:min-w-0 print:w-full print:p-0 print:text-black">

                    <div className="border border-black p-6 print:p-1 print:border-none relative">

                        {/* Company Header */}
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-[120px] h-[80px] flex items-center justify-center shrink-0 overflow-hidden text-center">
                                {companySettings.logoUrl ? (
                                    <img src={companySettings.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                                ) : (
                                    <span className="text-emerald-600 text-xs font-bold shrink-0">LOGO</span>
                                )}
                            </div>
                            <div className="flex-1 text-center px-4 font-sans">
                                <h2 className="text-[20px] font-bold mb-1 leading-tight">{companySettings.name}</h2>
                                <p className="text-[11px] leading-relaxed font-semibold">{companySettings.address}</p>
                                <p className="text-[11px] leading-relaxed font-semibold">โทรศัพท์: <span className="font-bold">{companySettings.phone}</span></p>
                                <p className="text-[11px] leading-relaxed font-semibold">Email : <span className="font-bold">{companySettings.email}</span></p>
                            </div>
                            {/* Document Type Label - Right */}
                            <div className="w-[160px] shrink-0 flex items-start justify-end">
                                <span className="text-[13px] font-bold border-2 border-black px-3 py-1.5 inline-block text-center leading-tight">
                                    {wc.wcType === 'extra' ? 'EXTRA WORK CONTRACT' : 'WORK CONTRACT'}
                                    <br />
                                    <span className="text-[10px] font-semibold">
                                        {wc.wcType === 'extra' ? 'ใบจ้างงานเพิ่มเติม' : 'ใบจ้างงาน'}
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* To / Info Section */}
                        <div className="grid grid-cols-12 gap-x-2 gap-y-2 mb-4 text-[12px] font-medium items-center border-b border-black pb-4">
                            <div className="col-span-1">เรียน</div>
                            <div className="col-span-8 border-b-2 border-black h-5 mr-10 leading-none">{wc.vendorName}</div>
                            <div className="col-span-1 text-right">วันที่</div>
                            <div className="col-span-2 text-right border-b-2 border-black h-5 leading-none">
                                {(wc.createdAt as any)?.toDate().toLocaleDateString('th-TH') || 'N/A'}
                            </div>

                            <div className="col-span-1">เรื่อง</div>
                            <div className="col-span-8 border-b-2 border-black h-5 mr-10 leading-none">
                                {wc.title || currentProject?.name}
                            </div>
                            <div className="col-span-1 text-right">เลขที่</div>
                            <div className="col-span-2 text-right border-b-2 border-black h-5 leading-none">{wc.wcNumber}</div>
                        </div>

                        {/* Title Bar */}
                        <div className="flex justify-between items-center mb-4 border-b border-black pb-4">
                            <div className="text-left font-bold text-[14px]">
                                {wc.wcType === 'extra' ? 'EXTRA WORK CONTRACT' : 'WORK CONTRACT'}
                            </div>
                            <div className="text-right font-bold text-[12px]">
                                {companySettings.name} มีความยินดีที่จะว่าจ้างงาน ตามรายการดังต่อไปนี้
                            </div>
                        </div>

                        {/* Items Table */}
                        <table className="w-full border-collapse border border-black text-[11px] font-medium font-sans mt-2">
                            <thead>
                                <tr>
                                    <th className="border border-black py-1.5 px-0 text-center w-10 font-bold" rowSpan={2}>ลำดับ</th>
                                    <th className="border border-black py-1.5 px-2 text-center font-bold" rowSpan={2}>รายการงาน</th>
                                    <th className="border border-black py-1.5 px-0 text-center w-16 font-bold" rowSpan={2}>จำนวน</th>
                                    <th className="border border-black py-1.5 px-0 text-center w-16 font-bold" rowSpan={2}>หน่วย</th>
                                    <th className="border border-black py-0.5 px-1 text-center font-bold" colSpan={2}>ราคาต่อหน่วย</th>
                                    <th className="border border-black py-1.5 px-2 text-center w-24 font-bold" rowSpan={2}>ราคารวม<br />ในสัญญา</th>
                                </tr>
                                <tr>
                                    <th className="border border-black py-1 px-1 text-center w-16 font-bold">ค่าของ</th>
                                    <th className="border border-black py-1 px-1 text-center w-16 font-bold">ค่าแรง</th>
                                </tr>
                            </thead>
                            <tbody>
                                {wc.items.map((item, index) => (
                                    <tr key={item.id} className="align-top">
                                        <td className="border-x border-black py-1.5 px-1 text-center">{index + 1}</td>
                                        <td className="border-x border-black py-1.5 px-2">{item.description}</td>
                                        <td className="border-x border-black py-1.5 px-1 text-center">{item.quantity}</td>
                                        <td className="border-x border-black py-1.5 px-1 text-center">{item.unit}</td>
                                        <td className="border-x border-black py-1.5 px-1 text-right"></td>
                                        <td className="border-x border-black py-1.5 px-1 text-right">{item.unitPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td className="border-x border-black py-1.5 px-2 text-right">{item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                                {/* Padding row */}
                                <tr>
                                    <td className="border-x border-black h-[100px]"></td>
                                    <td className="border-x border-black h-[100px]"></td>
                                    <td className="border-x border-black h-[100px]"></td>
                                    <td className="border-x border-black h-[100px]"></td>
                                    <td className="border-x border-black h-[100px] border-b-2"></td>
                                    <td className="border-x border-black h-[100px] border-b-2"></td>
                                    <td className="border-x border-black h-[100px]"></td>
                                </tr>
                                {/* Payment Terms row */}
                                <tr>
                                    <td colSpan={4} className="border-x border-t border-black py-1 px-2 font-bold text-xs align-bottom uppercase">
                                        {wc.paymentTerms ? `เงื่อนไข: ${wc.paymentTerms}` : `ระยะเวลาดำเนินงาน: ${formatDate(wc.startDate)} – ${formatDate(wc.endDate)}`}
                                    </td>
                                    <td colSpan={2} className="border border-black py-1.5 px-2 text-center font-bold">Total Not Included Vat</td>
                                    <td className="border border-black py-1.5 px-2 text-right">{wc.subTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td className="border-x border-b-transparent p-0 align-top" colSpan={4} rowSpan={1}></td>
                                    <td colSpan={2} className="border border-black py-1.5 px-2 text-center font-bold">Vat {wc.vatRate}%</td>
                                    <td className="border border-black py-1.5 px-2 text-right">{wc.vatAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                                <tr>
                                    <td className="border-x border-b border-black font-bold p-2 text-center h-28 text-[10px] align-top" colSpan={4}>
                                        {wc.notes && <span className="text-left block">หมายเหตุ: {wc.notes}</span>}
                                    </td>
                                    <td colSpan={2} className="border border-black py-1.5 px-2 text-center font-bold">Total Included Vat</td>
                                    <td className="border border-black py-1.5 px-2 text-right font-bold">{wc.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                            </tfoot>
                        </table>

                        {/* Signatures */}
                        <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 text-[11px] font-semibold mt-4">
                            <div></div>
                            <div className="text-center space-y-12 w-full max-w-[400px] ml-auto">
                                <div className="-ml-10">
                                    {companySettings.name} หวังว่าท่านจะได้รับความไว้วางใจให้ดำเนินการ <br />
                                    <span className="font-bold">และขอขอบคุณมา ณ โอกาสนี้ ด้วยความนับถือ</span>
                                </div>
                                <div className="flex justify-center gap-8 -ml-10">
                                    {wc.signatureData ? (
                                        <div className="space-y-1 flex flex-col items-center">
                                            {wc.signatureData.signatureUrl ? (
                                                <div className="h-12 w-32 border-b border-black mb-1 flex items-end justify-center">
                                                    <img src={wc.signatureData.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                                                </div>
                                            ) : (
                                                <p className="mb-2">.............................................</p>
                                            )}
                                            <p>{wc.signatureData.name || "( ................................................ )"}</p>
                                            <p className="font-bold text-xs mt-1">{wc.signatureData.position || "ตำแหน่ง..............................."}</p>
                                        </div>
                                    ) : companySettings.signatures && companySettings.signatures.length > 0 ? (
                                        companySettings.signatures.map((sig: any) => (
                                            <div key={sig.id} className="space-y-1 flex flex-col items-center">
                                                {sig.signatureUrl ? (
                                                    <div className="h-12 w-32 border-b border-black mb-1 flex items-end justify-center">
                                                        <img src={sig.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                                                    </div>
                                                ) : (
                                                    <p className="mb-2">.............................................</p>
                                                )}
                                                <p>{sig.name || "( ................................................ )"}</p>
                                                <p className="font-bold text-xs mt-1">{sig.position || "ตำแหน่ง..............................."}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="space-y-1 flex flex-col items-center">
                                            {companySettings.signatureUrl ? (
                                                <div className="h-12 w-32 border-b border-black mb-1 flex items-end justify-center">
                                                    <img src={companySettings.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                                                </div>
                                            ) : (
                                                <p className="mb-2">.............................................</p>
                                            )}
                                            <p>( นายองศิลป์ วิริยะสัญญา )</p>
                                            <p className="font-bold text-xs mt-1">ผู้จัดการ</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

        </div>
    );
}
