"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, Printer, FileEdit, Loader2, Edit, Trash2 } from "lucide-react";
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { VariationOrder } from "@/types/vo";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";

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
    logoUrl?: string;
    signatureUrl?: string;
    signatures?: SignatureOption[];
};

function toSignedCurrency(value: number) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default function VODetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { userProfile } = useAuth();
    const { currentProject } = useProject();

    const [vo, setVo] = useState<VariationOrder | null>(null);
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
        async function fetchSettingsAndVO() {
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

                const voRef = doc(db, "variation_orders", resolvedParams.id);
                const voSnap = await getDoc(voRef);

                if (voSnap.exists()) {
                    setVo({ id: voSnap.id, ...voSnap.data() } as VariationOrder);
                } else {
                    console.error("No such document!");
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchSettingsAndVO();
    }, [resolvedParams.id]);

    const handleStatusUpdate = async (newStatus: "approved" | "rejected") => {
        if (!vo || !userProfile) return;
        setActionLoading(true);

        try {
            const voRef = doc(db, "variation_orders", vo.id);
            await updateDoc(voRef, {
                status: newStatus,
                updatedAt: serverTimestamp(),
            });

            if (newStatus === "approved" && currentProject) {
                try {
                    await fetch("/api/line/notify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "VO",
                            data: { ...vo, status: newStatus },
                            projectName: currentProject.name,
                        }),
                    });
                } catch (e) {
                    console.error("Line notification failed:", e);
                }
            }

            setVo({ ...vo, status: newStatus });
        } catch (error) {
            console.error("Error updating VO status:", error);
            alert("ไม่สามารถอัปเดตสถานะได้");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!vo || !resolvedParams.id) return;
        if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบใบสั่งเปลี่ยนงาน \"${vo.voNumber}\"?\nการกระทำนี้ลบถาวรและไม่สามารถกู้คืนได้`)) {
            return;
        }

        setDeleting(true);
        try {
            await deleteDoc(doc(db, "variation_orders", resolvedParams.id));
            router.push("/vo");
        } catch (error) {
            console.error("Error deleting VO:", error);
            alert("ลบข้อมูลไม่สำเร็จ");
            setDeleting(false);
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
            // ignore malformed values and use fallback
        }
        return "N/A";
    };

    const canApprove = userProfile?.role === "admin" || userProfile?.role === "pm";

    const primarySignature = useMemo(() => {
        if (companySettings.signatures && companySettings.signatures.length > 0) {
            return companySettings.signatures[0];
        }

        if (companySettings.signatureUrl) {
            return {
                name: "( ................................................ )",
                position: "ผู้อนุมัติ",
                signatureUrl: companySettings.signatureUrl,
            } satisfies SignatureOption;
        }

        return null;
    }, [companySettings.signatures, companySettings.signatureUrl]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="animate-spin w-8 h-8 text-orange-600 mb-4" />
                <p className="text-slate-500">กำลังโหลดข้อมูลงานเพิ่ม-ลด...</p>
            </div>
        );
    }

    if (!vo) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
                <FileEdit className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">ไม่พบข้อมูล</h3>
                <p>ไม่พบรายการงานเพิ่ม-ลดที่คุณกำลังค้นหา อาจถูกลบหรือไม่มีอยู่จริง</p>
                <Link href="/vo" className="mt-4 inline-block text-orange-600 hover:underline">กลับไปหน้ารายการ VO</Link>
            </div>
        );
    }

    const isPending = vo.status === "pending";
    const canEdit = vo.status === "draft" || vo.status === "rejected";
    const minDisplayRows = 10;
    const emptyRowCount = Math.max(0, minDisplayRows - vo.items.length);

    return (
        <div className="max-w-4xl mx-auto space-y-6 print:space-y-0 print:m-0 print:w-full print:max-w-none">
            <div className="flex items-center justify-between print:hidden">
                <div className="flex items-center space-x-4">
                    <Link href="/vo" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">รายละเอียดใบสั่งเปลี่ยนงาน</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {vo.voNumber} • โครงการ: {currentProject?.name}
                        </p>
                    </div>
                </div>

                <div className="flex space-x-3">
                    <button
                        onClick={() => window.print()}
                        className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                    >
                        <Printer size={16} className="mr-2" />
                        พิมพ์ PDF
                    </button>

                    {canEdit && (
                        <Link
                            href={`/vo/${vo.id}/edit`}
                            className="inline-flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-blue-100 transition-colors"
                        >
                            <Edit size={16} className="mr-2" />
                            แก้ไขใบสั่งเปลี่ยนงาน
                        </Link>
                    )}

                    {canEdit && (
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="inline-flex items-center justify-center rounded-lg bg-white text-red-600 border border-red-200 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                            {deleting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Trash2 size={16} className="mr-2" />}
                            ลบ
                        </button>
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
                                อนุมัติ (ส่งผลต่องบประมาณ)
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
                                    <span className="text-orange-600 text-xs font-bold shrink-0">LOGO</span>
                                )}
                            </div>
                            <div className="flex-1 text-center px-4 font-sans">
                                <h2 className="text-[20px] font-bold mb-1 leading-tight">{companySettings.name}</h2>
                                <p className="text-[11px] leading-relaxed font-semibold">{companySettings.address}</p>
                                <p className="text-[11px] leading-relaxed font-semibold">โทรศัพท์: <span className="font-bold">{companySettings.phone}</span></p>
                                <p className="text-[11px] leading-relaxed font-semibold">Email: <span className="font-bold">{companySettings.email}</span></p>
                            </div>
                            <div className="w-[180px] shrink-0 flex items-start justify-end">
                                <span className="text-[13px] font-bold border-2 border-black px-3 py-1.5 inline-block text-center leading-tight">
                                    VARIATION ORDER
                                    <br />
                                    <span className="text-[10px] font-semibold">ใบสั่งเปลี่ยนแปลงงาน</span>
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-12 gap-x-2 gap-y-2 mb-4 text-[12px] font-medium items-center border-b border-black pb-4">
                            <div className="col-span-1">เรียน</div>
                            <div className="col-span-8 border-b-2 border-black h-5 mr-10 leading-none">ผู้เกี่ยวข้องในโครงการ</div>
                            <div className="col-span-1 text-right">วันที่</div>
                            <div className="col-span-2 text-right border-b-2 border-black h-5 leading-none">{formatCreatedAt(vo.createdAt)}</div>

                            <div className="col-span-1">เรื่อง</div>
                            <div className="col-span-8 border-b-2 border-black h-5 mr-10 leading-none">{vo.title}</div>
                            <div className="col-span-1 text-right">เลขที่</div>
                            <div className="col-span-2 text-right border-b-2 border-black h-5 leading-none">{vo.voNumber}</div>
                        </div>

                        <div className="flex justify-between items-center mb-4 border-b border-black pb-4">
                            <div className="text-left font-bold text-[14px]">VARIATION ORDER</div>
                            <div className="text-right font-bold text-[12px]">
                                เอกสารนี้เป็นใบสั่งเปลี่ยนแปลงงาน (เพิ่ม/ลด) ที่มีผลต่องบประมาณโครงการ
                            </div>
                        </div>

                        <table className="w-full border-collapse border border-black text-[11px] font-medium font-sans mt-2">
                            <thead>
                                <tr>
                                    <th className="border border-black py-1.5 px-1 text-center w-10 font-bold">ลำดับ</th>
                                    <th className="border border-black py-1.5 px-2 text-center w-20 font-bold">ประเภท</th>
                                    <th className="border border-black py-1.5 px-2 text-center font-bold">รายละเอียดงาน/วัสดุ</th>
                                    <th className="border border-black py-1.5 px-1 text-center w-16 font-bold">จำนวน</th>
                                    <th className="border border-black py-1.5 px-1 text-center w-16 font-bold">หน่วย</th>
                                    <th className="border border-black py-1.5 px-2 text-center w-28 font-bold">ราคา/หน่วย</th>
                                    <th className="border border-black py-1.5 px-2 text-center w-28 font-bold">ผลกระทบงบ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vo.items.map((item, index) => {
                                    const amount = Number(item.amount) || 0;
                                    const signedAmount = item.type === "add" ? Math.abs(amount) : -Math.abs(amount);
                                    return (
                                        <tr key={item.id || `${index}-${item.description}`} className="align-top">
                                            <td className="border-x border-black py-1.5 px-1 text-center">{index + 1}</td>
                                            <td className="border-x border-black py-1.5 px-2 text-center font-bold">{item.type === "add" ? "เพิ่ม" : "ลด"}</td>
                                            <td className="border-x border-black py-1.5 px-2">{item.description}</td>
                                            <td className="border-x border-black py-1.5 px-1 text-center">{item.quantity}</td>
                                            <td className="border-x border-black py-1.5 px-1 text-center">{item.unit}</td>
                                            <td className="border-x border-black py-1.5 px-2 text-right">{(item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="border-x border-black py-1.5 px-2 text-right font-bold">{toSignedCurrency(signedAmount)}</td>
                                        </tr>
                                    );
                                })}

                                {Array.from({ length: emptyRowCount }).map((_, index) => (
                                    <tr key={`empty-row-${index}`} className="align-top h-8">
                                        <td className="border-x border-black py-1.5 px-1 text-center"></td>
                                        <td className="border-x border-black py-1.5 px-2 text-center"></td>
                                        <td className="border-x border-black py-1.5 px-2"></td>
                                        <td className="border-x border-black py-1.5 px-1 text-center"></td>
                                        <td className="border-x border-black py-1.5 px-1 text-center"></td>
                                        <td className="border-x border-black py-1.5 px-2 text-right"></td>
                                        <td className="border-x border-black py-1.5 px-2 text-right"></td>
                                    </tr>
                                ))}

                                <tr>
                                    <td colSpan={5} className="border-x border-t border-black py-1 px-2 font-bold text-xs align-bottom">
                                        เหตุผล/รายละเอียดเพิ่มเติม: {vo.reason || "ไม่ระบุ"}
                                    </td>
                                    <td className="border border-black py-1.5 px-2 text-center font-bold">Total Not Included Vat</td>
                                    <td className="border border-black py-1.5 px-2 text-right">{toSignedCurrency(vo.subTotal || 0)}</td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td className="border-x border-b-transparent p-0 align-top" colSpan={5}></td>
                                    <td className="border border-black py-1.5 px-2 text-center font-bold">Vat {vo.vatRate || 0}%</td>
                                    <td className="border border-black py-1.5 px-2 text-right">{toSignedCurrency(vo.vatAmount || 0)}</td>
                                </tr>
                                <tr>
                                    <td className="border-x border-b border-black font-bold p-2 text-left h-20 text-[10px] align-top" colSpan={5}>
                                    </td>
                                    <td className="border border-black py-1.5 px-2 text-center font-bold">Total Included Vat</td>
                                    <td className="border border-black py-1.5 px-2 text-right font-bold">{toSignedCurrency(vo.totalAmount || 0)}</td>
                                </tr>
                            </tfoot>
                        </table>

                        <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 text-[11px] font-semibold mt-10 gap-8">
                            <div className="text-center space-y-2">
                                <div className="h-12 w-56 border-b border-black mx-auto"></div>
                                <p>( ................................................ )</p>
                                <p className="font-bold text-xs">ผู้เสนอขอเปลี่ยนแปลงงาน</p>
                            </div>

                            <div className="text-center space-y-2">
                                {primarySignature ? (
                                    <div className="space-y-2 flex flex-col items-center">
                                        {primarySignature.signatureUrl ? (
                                            <div className="h-12 w-56 border-b border-black flex items-end justify-center">
                                                <img src={primarySignature.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                                            </div>
                                        ) : (
                                            <div className="h-12 w-56 border-b border-black"></div>
                                        )}
                                        <p>{primarySignature.name || "( ................................................ )"}</p>
                                        <p className="font-bold text-xs">{primarySignature.position || "ผู้อนุมัติ"}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 flex flex-col items-center">
                                        <div className="h-12 w-56 border-b border-black"></div>
                                        <p>( ................................................ )</p>
                                        <p className="font-bold text-xs">ผู้อนุมัติ</p>
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
