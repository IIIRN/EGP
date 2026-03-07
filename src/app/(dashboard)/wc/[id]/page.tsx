"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle, Printer, FileText, Loader2, Edit, Trash2 } from "lucide-react";
import { doc, getDoc, updateDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { WorkContract } from "@/types/wc";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { FUEL_FEE_LABEL, PROCESSING_FEE_LABEL, splitAdditionalFeeItems } from "@/lib/documentItems";

type SignatureOption = {
    id?: string;
    name?: string;
    position?: string;
    signatureUrl?: string;
};

type CompanySettings = {
    name: string;
    address: string;
    phone: string;
    email: string;
    logoUrl: string;
    signatureUrl: string;
    signatures: SignatureOption[];
};

export default function WCDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { userProfile } = useAuth();
    const { currentProject } = useProject();

    const [wc, setWc] = useState<WorkContract | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [companySettings, setCompanySettings] = useState<CompanySettings>({
        name: "บริษัท พาวเวอร์เทค เอนจิเนียริ่ง จำกัด",
        address: "9/10 ถ.มิตรสาร ต.ประตูชัย อ.พระนครศรีอยุธยา จ.พระนครศรีอยุธยา 13000",
        phone: "083-995-5629, 083-995-4495",
        email: "Powertec.civil@gmail.com",
        logoUrl: "",
        signatureUrl: "",
        signatures: [],
    });

    useEffect(() => {
        async function fetchData() {
            if (!resolvedParams.id) return;
            try {
                const configRef = doc(db, "system_settings", "global_config");
                const configSnap = await getDoc(configRef);
                if (configSnap.exists() && configSnap.data().companySettings) {
                    const settings = configSnap.data().companySettings as Partial<CompanySettings>;
                    setCompanySettings((prev) => ({
                        ...prev,
                        ...settings,
                        signatures: Array.isArray(settings.signatures) ? settings.signatures : prev.signatures,
                    }));
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
                            projectName: currentProject?.name,
                        }),
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

    const handleDelete = async () => {
        if (!wc || !resolvedParams.id) return;
        if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบใบจ้างงาน \"${wc.wcNumber}\"?\nการกระทำนี้ลบถาวรและไม่สามารถกู้คืนได้`)) {
            return;
        }

        setDeleting(true);
        try {
            await deleteDoc(doc(db, "work_contracts", resolvedParams.id));
            router.push("/wc");
        } catch (error) {
            console.error("Error deleting WC:", error);
            alert("ลบข้อมูลไม่สำเร็จ");
            setDeleting(false);
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return "-";
        try {
            return new Date(dateStr).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
        } catch {
            return dateStr;
        }
    };

    const formatCreatedAt = (value: unknown) => {
        try {
            if (value && typeof value === "object" && "toDate" in value) {
                const timestamp = value as { toDate?: () => Date };
                if (typeof timestamp.toDate === "function") {
                    return timestamp.toDate().toLocaleDateString("th-TH");
                }
            }
            if (value && typeof value === "object" && "seconds" in value) {
                const unixTimestamp = value as { seconds?: number; nanoseconds?: number };
                if (typeof unixTimestamp.seconds === "number") {
                    const millis = (unixTimestamp.seconds * 1000) + Math.floor((unixTimestamp.nanoseconds ?? 0) / 1_000_000);
                    return new Date(millis).toLocaleDateString("th-TH");
                }
            }
            if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
                const date = new Date(value);
                if (!Number.isNaN(date.getTime())) {
                    return date.toLocaleDateString("th-TH");
                }
            }
        } catch {
            // Ignore malformed date values and show fallback.
        }
        return "N/A";
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
    const { items: displayItems, processingFee, fuelFee } = splitAdditionalFeeItems(wc.items);
    const itemsTotalBeforeFee = displayItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    const minDisplayRows = 10;
    const emptyRowCount = Math.max(0, minDisplayRows - displayItems.length);

    return (
        <div className="max-w-4xl mx-auto space-y-6 print:space-y-0 print:m-0 print:w-full print:max-w-none">
            <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between print:hidden">
                <div className="flex items-center space-x-4">
                    <Link href="/wc" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors shrink-0">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-lg md:text-xl font-bold text-slate-900">รายละเอียดใบจ้างงาน</h1>
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
                        <>
                            <Link
                                href={`/wc/${wc.id}/edit`}
                                className="inline-flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-emerald-100 transition-colors"
                            >
                                <Edit size={16} className="mr-2" />
                                แก้ไขใบจ้างงาน
                            </Link>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="inline-flex items-center justify-center rounded-lg bg-white text-red-600 border border-red-200 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                                {deleting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Trash2 size={16} className="mr-2" />}
                                ลบ
                            </button>
                        </>
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

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto print:overflow-visible print:shadow-none print:border-0 print:rounded-none">
                <div className="p-8 space-y-8 min-w-[800px] print:min-w-0 print:w-full print:p-0 print:text-black">
                    <div className="border border-black p-6 print:p-1 print:border-none relative">
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
                                <p className="text-[11px] leading-relaxed font-semibold">Email: <span className="font-bold">{companySettings.email}</span></p>
                            </div>
                            <div className="w-[160px] shrink-0 flex items-start justify-end">
                                <span className="text-[13px] font-bold border-2 border-black px-3 py-1.5 inline-block text-center leading-tight">
                                    {wc.wcType === "extra" ? "EXTRA WORK CONTRACT" : "WORK CONTRACT"}
                                    <br />
                                    <span className="text-[10px] font-semibold">
                                        {wc.wcType === "extra" ? "ใบจ้างงานเพิ่มเติม" : "ใบจ้างงาน"}
                                    </span>
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-12 gap-x-2 gap-y-2 mb-4 text-[12px] font-medium items-center border-b border-black pb-4">
                            <div className="col-span-1">เรียน</div>
                            <div className="col-span-8 border-b-2 border-black h-5 mr-10 leading-none">{wc.vendorName}</div>
                            <div className="col-span-1 text-right">วันที่</div>
                            <div className="col-span-2 text-right border-b-2 border-black h-5 leading-none">
                                {wc.issueDate ? formatDate(wc.issueDate) : formatCreatedAt(wc.createdAt)}
                            </div>

                            <div className="col-span-1">เรื่อง</div>
                            <div className="col-span-8 border-b-2 border-black h-5 mr-10 leading-none">
                                {wc.title || currentProject?.name}
                            </div>
                            <div className="col-span-1 text-right">เลขที่</div>
                            <div className="col-span-2 text-right border-b-2 border-black h-5 leading-none">{wc.wcNumber}</div>
                        </div>

                        <div className="flex justify-between items-center mb-4 border-b border-black pb-4">
                            <div className="text-left font-bold text-[14px]">
                                {wc.wcType === "extra" ? "EXTRA WORK CONTRACT" : "WORK CONTRACT"}
                            </div>
                            <div className="text-right font-bold text-[12px]">
                                {companySettings.name} มีความยินดีที่จะว่าจ้างงาน ตามรายการดังต่อไปนี้
                            </div>
                        </div>

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
                                {displayItems.map((item, index) => (
                                    <tr key={item.id} className="align-top">
                                        <td className="border-x border-black py-1.5 px-1 text-center">{index + 1}</td>
                                        <td className="border-x border-black py-1.5 px-2">{item.description}</td>
                                        <td className="border-x border-black py-1.5 px-1 text-center">{item.quantity}</td>
                                        <td className="border-x border-black py-1.5 px-1 text-center">{item.unit}</td>
                                        <td className="border-x border-black py-1.5 px-1 text-right"></td>
                                        <td className="border-x border-black py-1.5 px-1 text-right">
                                            {item.isClosed ? "-" : item.unitPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="border-x border-black py-1.5 px-2 text-right">
                                            {item.isClosed ? "-" : item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}

                                <tr>
                                    <td className="border-x border-black py-1.5 px-1 text-center font-bold">{displayItems.length + 1}</td>
                                    <td className="border-x border-black py-1.5 px-2 font-bold">ราคารวม</td>
                                    <td className="border-x border-black py-1.5 px-1 text-center"></td>
                                    <td className="border-x border-black py-1.5 px-1 text-center"></td>
                                    <td className="border-x border-black py-1.5 px-1 text-right"></td>
                                    <td className="border-x border-black py-1.5 px-1 text-right"></td>
                                    <td className="border-x border-black py-1.5 px-2 text-right font-bold">{itemsTotalBeforeFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                                <tr>
                                    <td className="border-x border-black py-1.5 px-1 text-center font-bold">{displayItems.length + 2}</td>
                                    <td className="border-x border-black py-1.5 px-2 font-bold">{PROCESSING_FEE_LABEL}</td>
                                    <td className="border-x border-black py-1.5 px-1 text-center"></td>
                                    <td className="border-x border-black py-1.5 px-1 text-center"></td>
                                    <td className="border-x border-black py-1.5 px-1 text-right"></td>
                                    <td className="border-x border-black py-1.5 px-1 text-right"></td>
                                    <td className="border-x border-black py-1.5 px-2 text-right font-bold">{processingFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                                <tr>
                                    <td className="border-x border-black py-1.5 px-1 text-center font-bold">{displayItems.length + 3}</td>
                                    <td className="border-x border-black py-1.5 px-2 font-bold">{FUEL_FEE_LABEL}</td>
                                    <td className="border-x border-black py-1.5 px-1 text-center"></td>
                                    <td className="border-x border-black py-1.5 px-1 text-center"></td>
                                    <td className="border-x border-black py-1.5 px-1 text-right"></td>
                                    <td className="border-x border-black py-1.5 px-1 text-right"></td>
                                    <td className="border-x border-black py-1.5 px-2 text-right font-bold">{fuelFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                                {Array.from({ length: emptyRowCount }).map((_, index) => (
                                    <tr key={`empty-row-${index}`} className="align-top h-8">
                                        <td className="border-x border-black py-1.5 px-1 text-center"></td>
                                        <td className="border-x border-black py-1.5 px-2"></td>
                                        <td className="border-x border-black py-1.5 px-1 text-center"></td>
                                        <td className="border-x border-black py-1.5 px-1 text-center"></td>
                                        <td className="border-x border-black py-1.5 px-1 text-right"></td>
                                        <td className="border-x border-black py-1.5 px-1 text-right"></td>
                                        <td className="border-x border-black py-1.5 px-2 text-right"></td>
                                    </tr>
                                ))}

                                <tr>
                                    <td colSpan={4} className="border-x border-t border-black py-1 px-2 font-bold text-xs align-bottom">
                                        {wc.paymentTerms
                                            ? `เงื่อนไข: ${wc.paymentTerms}`
                                            : `ระยะเวลาดำเนินงาน: ${formatDate(wc.startDate)} - ${formatDate(wc.endDate)}`}
                                    </td>
                                    <td colSpan={2} className="border border-black py-1.5 px-2 text-center font-bold">Total Not Included Vat</td>
                                    <td className="border border-black py-1.5 px-2 text-right">{wc.subTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td className="border-x border-b-transparent p-0 align-top" colSpan={4}></td>
                                    <td colSpan={2} className="border border-black py-1.5 px-2 text-center font-bold">Vat {wc.vatRate}%</td>
                                    <td className="border border-black py-1.5 px-2 text-right">{wc.vatAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                                <tr>
                                    <td className="border-x border-b border-black font-bold p-2 text-center h-20 text-[10px] align-top" colSpan={4}>
                                        {wc.notes && <span className="text-left block">หมายเหตุ: {wc.notes}</span>}
                                    </td>
                                    <td colSpan={2} className="border border-black py-1.5 px-2 text-center font-bold">Total Included Vat</td>
                                    <td className="border border-black py-1.5 px-2 text-right font-bold">{wc.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                            </tfoot>
                        </table>

                        <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 text-[11px] font-semibold mt-12 print:mt-14 gap-8">
                            <div className="text-center space-y-2">
                                <div className="h-12 w-56 border-b border-black mx-auto"></div>
                                <p>( {wc.vendorName || "................................................"} )</p>
                                <p className="font-bold text-xs">ผู้รับจ้าง / ผู้ถูกจ้างงาน</p>
                            </div>

                            <div className="text-center space-y-2">
                                {wc.signatureData ? (
                                    <div className="space-y-2 flex flex-col items-center">
                                        {wc.signatureData.signatureUrl ? (
                                            <div className="h-12 w-56 border-b border-black flex items-end justify-center">
                                                <img src={wc.signatureData.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                                            </div>
                                        ) : (
                                            <div className="h-12 w-56 border-b border-black"></div>
                                        )}
                                        <p>{wc.signatureData.name || "( ................................................ )"}</p>
                                        <p className="font-bold text-xs">{wc.signatureData.position || "ผู้ว่าจ้าง"}</p>
                                    </div>
                                ) : companySettings.signatures && companySettings.signatures.length > 0 ? (
                                    companySettings.signatures.map((sig) => (
                                        <div key={sig.id} className="space-y-2 flex flex-col items-center">
                                            {sig.signatureUrl ? (
                                                <div className="h-12 w-56 border-b border-black flex items-end justify-center">
                                                    <img src={sig.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                                                </div>
                                            ) : (
                                                <div className="h-12 w-56 border-b border-black"></div>
                                            )}
                                            <p>{sig.name || "( ................................................ )"}</p>
                                            <p className="font-bold text-xs">{sig.position || "ผู้ว่าจ้าง"}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="space-y-2 flex flex-col items-center">
                                        {companySettings.signatureUrl ? (
                                            <div className="h-12 w-56 border-b border-black flex items-end justify-center">
                                                <img src={companySettings.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                                            </div>
                                        ) : (
                                            <div className="h-12 w-56 border-b border-black"></div>
                                        )}
                                        <p>( ................................................ )</p>
                                        <p className="font-bold text-xs">ผู้ว่าจ้าง</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
