"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, Printer, FileEdit, Loader2, Edit, Trash2, Mail } from "lucide-react";
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { VariationOrder } from "@/types/vo";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { Project } from "@/types/project";
import { CompanySettings, SignatureOption, VariationOrderDocument } from "@/components/vo/VariationOrderDocument";

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
    const [voProject, setVoProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [emailSending, setEmailSending] = useState(false);
    const [emailSentSuccess, setEmailSentSuccess] = useState(false);
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");
    const [includeAttachment, setIncludeAttachment] = useState(true);

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
                    const voData = { id: voSnap.id, ...voSnap.data() } as VariationOrder;
                    setVo(voData);

                    if (voData.projectId) {
                        const projectRef = doc(db, "projects", voData.projectId);
                        const projectSnap = await getDoc(projectRef);

                        if (projectSnap.exists()) {
                            setVoProject({ id: projectSnap.id, ...projectSnap.data() } as Project);
                        } else {
                            setVoProject(null);
                        }
                    } else {
                        setVoProject(null);
                    }
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

            if (newStatus === "approved") {
                try {
                    await fetch("/api/line/notify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "VO",
                            data: { ...vo, status: newStatus },
                            projectName: resolvedProject?.name || currentProject?.name || "",
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

    const openEmailModal = () => {
        if (!vo) return;
        if (!projectContactEmail) {
            alert("ไม่พบอีเมลผู้ติดต่อโครงการ");
            return;
        }

        setEmailSubject(defaultEmailSubject);
        setEmailBody(defaultEmailBody);
        setIncludeAttachment(true);
        setEmailSentSuccess(false);
        setEmailModalOpen(true);
    };

    const handleSendEmail = () => {
        if (!vo) return;
        if (!projectContactEmail) {
            alert("ไม่พบอีเมลผู้ติดต่อโครงการ");
            return;
        }

        if (!emailSubject.trim()) {
            alert("กรุณาระบุหัวข้ออีเมล");
            return;
        }

        if (!emailBody.trim()) {
            alert("กรุณาระบุเนื้อหาอีเมล");
            return;
        }

        setEmailSending(true);

        fetch("/api/vo/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                voId: vo.id,
                subject: emailSubject.trim(),
                textBody: emailBody.trim(),
                includeAttachment,
            }),
        })
            .then(async (response) => {
                const result = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(result?.error || "ส่งอีเมลไม่สำเร็จ");
                }

                setEmailModalOpen(false);
                setEmailSentSuccess(true);
                window.setTimeout(() => {
                    setEmailSentSuccess(false);
                }, 3000);
            })
            .catch((error: unknown) => {
                const message = error instanceof Error ? error.message : "ส่งอีเมลไม่สำเร็จ";
                alert(message);
            })
            .finally(() => {
                setEmailSending(false);
            });
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
    const resolvedProject = currentProject?.id === vo?.projectId ? currentProject : voProject;
    const projectContactName = resolvedProject?.contactName?.trim() || "ผู้ติดต่อโครงการ";
    const projectContactEmail = resolvedProject?.contactEmail?.trim() || "";
    const defaultEmailSubject = vo ? `แจ้งอนุมัติ VO ${vo.voNumber} - ${resolvedProject?.name || "โครงการ"}` : "";
    const defaultEmailBody = vo
        ? [
            `เรียน ${projectContactName}`,
            "",
            "เอกสารใบสั่งเปลี่ยนแปลงงาน (VO) ได้รับการอนุมัติเรียบร้อยแล้ว",
            `โครงการ: ${resolvedProject?.name || "-"}`,
            `เลขที่เอกสาร: ${vo.voNumber}`,
            `เรื่อง: ${vo.title}`,
            `วันที่เอกสาร: ${formatCreatedAt(vo.createdAt)}`,
            `ผลกระทบงบประมาณ: ${toSignedCurrency(vo.totalAmount || 0)} บาท`,
            "",
            "กรุณาตรวจสอบรายละเอียดเอกสารจากระบบ",
            "",
            "ขอบคุณครับ/ค่ะ",
        ].join("\n")
        : "";

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
                            {vo.voNumber} • โครงการ: {resolvedProject?.name || currentProject?.name || "-"}
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

                    {vo.status === "approved" && (
                        <button
                            type="button"
                            onClick={openEmailModal}
                            disabled={emailSending}
                            title={projectContactEmail ? `ส่งอีเมลไปที่ ${projectContactEmail}` : "ไม่พบอีเมลผู้ติดต่อโครงการ"}
                            className={`inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                emailSentSuccess
                                    ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-50"
                                    : "bg-white border-blue-200 text-blue-600 hover:bg-blue-50"
                            }`}
                        >
                            {emailSending ? (
                                <Loader2 size={16} className="mr-2 animate-spin" />
                            ) : emailSentSuccess ? (
                                <CheckCircle size={16} className="mr-2" />
                            ) : (
                                <Mail size={16} className="mr-2" />
                            )}
                            {emailSending ? "กำลังส่งเมล..." : emailSentSuccess ? "ส่งสำเร็จ" : "ส่งเมล"}
                        </button>
                    )}

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

            <VariationOrderDocument
                vo={vo}
                companySettings={companySettings}
                projectName={resolvedProject?.name || currentProject?.name || "-"}
                projectContactName={projectContactName}
                createdAtLabel={formatCreatedAt(vo.createdAt)}
                primarySignature={primarySignature}
            />

            {emailModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
                    <div className="absolute inset-0 bg-slate-900/50" onClick={() => !emailSending && setEmailModalOpen(false)} />
                    <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-900">ส่งอีเมลเอกสาร VO</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                ผู้รับ: <span className="font-medium text-slate-700">{projectContactEmail}</span>
                            </p>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">หัวข้อ</label>
                                <input
                                    type="text"
                                    value={emailSubject}
                                    onChange={(event) => setEmailSubject(event.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">เนื้อหา</label>
                                <textarea
                                    rows={10}
                                    value={emailBody}
                                    onChange={(event) => setEmailBody(event.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>

                            <label className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 bg-slate-50">
                                <input
                                    type="checkbox"
                                    checked={includeAttachment}
                                    onChange={(event) => setIncludeAttachment(event.target.checked)}
                                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span>
                                    <span className="block text-sm font-medium text-slate-800">แนบเอกสาร VO</span>
                                    <span className="block text-xs text-slate-500 mt-1">ระบบจะสร้างไฟล์ PDF สรุปเอกสาร VO และแนบไปพร้อมอีเมล</span>
                                </span>
                            </label>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setEmailModalOpen(false)}
                                disabled={emailSending}
                                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={handleSendEmail}
                                disabled={emailSending}
                                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                            >
                                {emailSending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Mail size={16} className="mr-2" />}
                                {emailSending ? "กำลังส่ง..." : "ยืนยันส่งเมล"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
