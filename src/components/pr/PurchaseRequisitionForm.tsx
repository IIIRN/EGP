"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    Download,
    FileText,
    Loader2,
    Plus,
    Save,
    Send,
    Upload,
} from "lucide-react";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from "firebase/firestore";
import { useProject } from "@/context/ProjectContext";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import type {
    PurchaseRequisition,
    PurchaseRequisitionFulfillmentType,
    PurchaseRequisitionItem,
    PurchaseRequisitionUrgency,
    PurchaseRequisitionVatMode,
} from "@/types/pr";
import { buildDocumentNumber, buildDocumentPrefix, normalizeProjectCode, parseDocumentSequence } from "@/lib/documentNumbers";
import { downloadDocumentItemsCsvTemplate, parseDocumentItemsCsv } from "@/lib/documentItems";
import {
    buildPendingNeedApprovalTrail,
    DEFAULT_PR_VAT_RATE,
} from "@/lib/purchaseRequisition";

type PurchaseRequisitionFormProps = {
    mode: "create" | "edit";
    requisition?: PurchaseRequisition | null;
    requisitionId?: string;
    backHref?: string;
    projectFallbackHref?: string;
    redirectAfterSaveHref?: string;
    redirectAfterSaveBasePath?: string;
};

function createEmptyItem(id: string): PurchaseRequisitionItem {
    return {
        id,
        description: "",
        quantity: 1,
        unit: "",
        unitPrice: 0,
        amount: 0,
    };
}

export default function PurchaseRequisitionForm({
    mode,
    requisition,
    requisitionId,
    backHref,
    projectFallbackHref,
    redirectAfterSaveHref,
    redirectAfterSaveBasePath,
}: PurchaseRequisitionFormProps) {
    const { currentProject } = useProject();
    const { user, userProfile } = useAuth();
    const router = useRouter();

    const [items, setItems] = useState<PurchaseRequisitionItem[]>([createEmptyItem("1")]);
    const [requestType, setRequestType] = useState<"material" | "service">("material");
    const [fulfillmentType, setFulfillmentType] = useState<PurchaseRequisitionFulfillmentType>("po");
    const [title, setTitle] = useState("");
    const [requiredDate, setRequiredDate] = useState("");
    const [reason, setReason] = useState("");
    const [urgency, setUrgency] = useState<PurchaseRequisitionUrgency>("normal");
    const [vatMode, setVatMode] = useState<PurchaseRequisitionVatMode>("exclusive");
    const [prNumber, setPrNumber] = useState("");
    const [availableUnits, setAvailableUnits] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [bootstrapped, setBootstrapped] = useState(false);

    useEffect(() => {
        let isMounted = true;

        async function fetchSettings() {
            try {
                const configRef = doc(db, "system_settings", "global_config");
                const configSnap = await getDoc(configRef);
                if (!isMounted || !configSnap.exists()) return;

                const data = configSnap.data() as { itemUnits?: string[] };
                setAvailableUnits(Array.isArray(data.itemUnits) ? data.itemUnits : []);
            } catch (error) {
                console.error("Error fetching PR settings:", error);
            }
        }

        void fetchSettings();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (mode !== "edit" || !requisition || bootstrapped) return;

        setItems(requisition.items?.length ? requisition.items : [createEmptyItem("1")]);
        setRequestType(requisition.requestType || "material");
        setFulfillmentType(requisition.fulfillmentType || "po");
        setTitle(requisition.title || "");
        setRequiredDate(requisition.requiredDate || "");
        setReason(requisition.reason || "");
        setUrgency(requisition.urgency || "normal");
        setVatMode(requisition.vatMode || "exclusive");
        setPrNumber(requisition.prNumber || "");
        setBootstrapped(true);
    }, [bootstrapped, mode, requisition]);

    useEffect(() => {
        if (mode !== "create" || !currentProject?.code) return;

        async function fetchNextPrNumber() {
            const normalizedProjectCode = normalizeProjectCode(currentProject?.code);
            if (!normalizedProjectCode) {
                setPrNumber("");
                return;
            }

            const prefix = buildDocumentPrefix({
                series: "PR",
                projectCode: normalizedProjectCode,
            });

            try {
                const latestQuery = query(
                    collection(db, "purchase_requisitions"),
                    where("prNumber", ">=", prefix),
                    where("prNumber", "<=", `${prefix}\uf8ff`),
                    orderBy("prNumber", "desc"),
                    limit(1)
                );
                const snapshot = await getDocs(latestQuery);

                let nextSequence = 1;
                if (!snapshot.empty) {
                    const lastPrNumber = String(snapshot.docs[0].data().prNumber || "");
                    const lastSequence = parseDocumentSequence(lastPrNumber, prefix);
                    if (lastSequence !== null) {
                        nextSequence = lastSequence + 1;
                    }
                }

                setPrNumber(buildDocumentNumber({
                    series: "PR",
                    projectCode: normalizedProjectCode,
                    sequence: nextSequence,
                }));
            } catch (error) {
                console.error("Error generating PR number:", error);
                setPrNumber(buildDocumentNumber({
                    series: "PR",
                    projectCode: normalizedProjectCode,
                    sequence: 1,
                }));
            }
        }

        void fetchNextPrNumber();
    }, [currentProject?.code, mode]);

    const handleAddItem = () => {
        setItems((currentItems) => [...currentItems, createEmptyItem(Date.now().toString())]);
    };

    const handleItemChange = (
        id: string,
        field: keyof PurchaseRequisitionItem,
        value: string | number
    ) => {
        setItems((currentItems) =>
            currentItems.map((item) => {
                if (item.id !== id) return item;

                const nextItem = {
                    ...item,
                    [field]: value,
                } as PurchaseRequisitionItem;

                if (field === "quantity" || field === "unitPrice") {
                    nextItem.amount = (Number(nextItem.quantity) || 0) * (Number(nextItem.unitPrice) || 0);
                }

                return nextItem;
            })
        );
    };

    const handleRemoveItem = (id: string) => {
        setItems((currentItems) => currentItems.filter((item) => item.id !== id));
    };

    const handleImportCsv = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const inputRef = event.target;
        const reader = new FileReader();

        reader.onload = () => {
            try {
                const importedRows = parseDocumentItemsCsv(String(reader.result || ""));
                if (importedRows.length === 0) {
                    alert("ไม่พบข้อมูลรายการในไฟล์ CSV");
                    return;
                }

                setItems(
                    importedRows.map((row, index) => ({
                        id: `csv-${Date.now()}-${index}`,
                        description: row.description,
                        quantity: row.quantity || 1,
                        unit: row.unit,
                        unitPrice: row.unitPrice,
                        amount: row.amount || row.quantity * row.unitPrice,
                    }))
                );
                alert(`นำเข้า CSV สำเร็จ ${importedRows.length} รายการ`);
            } catch (error) {
                console.error("PR CSV import error:", error);
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

    const handleDownloadCsvSample = () => {
        downloadDocumentItemsCsvTemplate("pr-items-sample.csv");
    };

    const itemsTotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const vatRate = vatMode === "none" ? 0 : DEFAULT_PR_VAT_RATE;
    const vatAmount = vatMode === "exclusive"
        ? (itemsTotal * DEFAULT_PR_VAT_RATE) / 100
        : vatMode === "inclusive"
            ? (itemsTotal * DEFAULT_PR_VAT_RATE) / (100 + DEFAULT_PR_VAT_RATE)
            : 0;
    const subTotal = vatMode === "inclusive" ? itemsTotal - vatAmount : itemsTotal;
    const totalAmount = vatMode === "exclusive" ? itemsTotal + vatAmount : itemsTotal;

    const persistRequisition = async (targetStatus: "draft" | "pending_need_approval") => {
        if (!currentProject) {
            alert("กรุณาเลือกโครงการก่อนสร้างใบขอซื้อ/ขอจ้าง");
            return;
        }

        if (!user) {
            alert("ไม่พบข้อมูลผู้ใช้งาน");
            return;
        }

        if (!title.trim()) {
            alert("กรุณาระบุหัวข้อคำขอ");
            return;
        }

        if (!reason.trim()) {
            alert("กรุณาระบุเหตุผลความต้องการ");
            return;
        }

        if (!prNumber.trim()) {
            alert("กรุณาระบุเลขที่ PR");
            return;
        }

        const sanitizedItems = items
            .map((item) => {
                const category = item.category?.trim() || "";
                const notes = item.notes?.trim() || "";

                return {
                    id: item.id || Date.now().toString(),
                    description: (item.description || "").trim(),
                    quantity: Number(item.quantity) || 0,
                    unit: (item.unit || "").trim(),
                    unitPrice: Number(item.unitPrice) || 0,
                    amount: Number(item.amount) || 0,
                    ...(category ? { category } : {}),
                    ...(notes ? { notes } : {}),
                };
            })
            .filter((item) => item.description || item.amount > 0 || item.unitPrice > 0);

        if (sanitizedItems.length === 0) {
            alert("กรุณาระบุอย่างน้อย 1 รายการ");
            return;
        }

        setSaving(true);

        const createdBy = requisition?.createdBy || userProfile?.uid || user.uid;
        const requestedByUid = requisition?.requestedByUid || userProfile?.uid || user.uid;
        const requestedByName =
            requisition?.requestedByName ||
            userProfile?.displayName ||
            userProfile?.email ||
            user.email ||
            "ไม่ระบุ";

        try {
            const payload = {
                prNumber: prNumber.trim(),
                projectId: currentProject.id,
                requestType,
                fulfillmentType,
                title: title.trim(),
                requiredDate: requiredDate || "",
                reason: reason.trim(),
                urgency,
                items: sanitizedItems,
                subTotal,
                vatRate,
                vatMode,
                vatAmount,
                totalAmount,
                status: targetStatus,
                createdBy,
                requestedByUid,
                requestedByName,
                approvalTrail:
                    targetStatus === "pending_need_approval"
                        ? buildPendingNeedApprovalTrail()
                        : requisition?.approvalTrail || [],
                updatedAt: serverTimestamp(),
            };

            let savedId = requisitionId || requisition?.id || "";

            if (mode === "edit" && savedId) {
                await updateDoc(doc(db, "purchase_requisitions", savedId), payload);
            } else {
                const docRef = await addDoc(collection(db, "purchase_requisitions"), {
                    ...payload,
                    createdAt: serverTimestamp(),
                });
                savedId = docRef.id;
            }

            if (targetStatus === "pending_need_approval") {
                try {
                    const notificationPayload = {
                        ...payload,
                        id: savedId,
                        updatedAt: undefined,
                    };

                    const response = await fetch("/api/line/notify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "PR",
                            data: notificationPayload,
                            projectName: currentProject.name,
                        }),
                    });

                    let responseBody: { success?: boolean; message?: string } | null = null;
                    try {
                        responseBody = await response.json();
                    } catch {
                        responseBody = null;
                    }

                    if (!response.ok || responseBody?.success === false) {
                        const errorMessage = responseBody?.message || "ไม่สามารถส่งแจ้งเตือน LINE ได้";
                        console.error("PR LINE notification failed:", errorMessage, responseBody);
                        alert(`สร้าง PR สำเร็จ แต่ส่งแจ้งเตือนอนุมัติไม่สำเร็จ: ${errorMessage}`);
                    }
                } catch (error) {
                    console.error("PR LINE notification failed:", error);
                    alert("สร้าง PR สำเร็จ แต่เกิดข้อผิดพลาดระหว่างส่งแจ้งเตือนอนุมัติ");
                }
            }

            setSuccess(true);
            setTimeout(() => {
                const nextHref = redirectAfterSaveBasePath
                    ? `${redirectAfterSaveBasePath}/${savedId}`
                    : redirectAfterSaveHref || `/pr/${savedId}`;
                router.push(nextHref);
            }, 800);
        } catch (error) {
            console.error("Error saving PR:", error);
            alert("บันทึกข้อมูลไม่สำเร็จ โปรดตรวจสอบ Console");
            setSaving(false);
        }
    };

    const resolvedProjectFallbackHref = projectFallbackHref || "/dashboard";
    const resolvedBackHref = backHref || (mode === "edit" && requisitionId ? `/pr/${requisitionId}` : "/pr");

    if (!currentProject && mode === "create") {
        return (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-lg text-center flex flex-col items-center">
                <FileText className="w-12 h-12 text-yellow-500 mb-3" />
                <h3 className="font-bold text-lg">ยังไม่ได้เลือกโครงการ</h3>
                <p className="mb-4">คุณต้องเลือกโครงการจากเมนูด้านบนก่อนสร้างใบขอซื้อ/ขอจ้าง</p>
                <Link href={resolvedProjectFallbackHref} className="bg-yellow-500 text-white px-4 py-2 rounded shadow hover:bg-yellow-600 transition">
                    กลับไปที่หน้าหลัก
                </Link>
            </div>
        );
    }

    const pageTitle = mode === "edit" ? "แก้ไขใบขอซื้อ/ขอจ้าง (PR)" : "สร้างใบขอซื้อ/ขอจ้าง (PR)";
    const submitLabel = mode === "edit" ? "ส่งขออนุมัติใหม่" : "ส่งขออนุมัติ";
    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start space-x-4">
                    <Link href={resolvedBackHref} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors shrink-0">
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="min-w-0">
                        <h1 className="text-xl md:text-2xl font-bold text-slate-900">{pageTitle}</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            โครงการ: <span className="font-semibold text-indigo-600">{currentProject?.name}</span>
                            {currentProject?.code ? ` (${currentProject.code})` : ""}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                        onClick={() => void persistRequisition("draft")}
                        disabled={saving || success}
                        className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                        <Save size={16} className="mr-2" />
                        บันทึกฉบับร่าง
                    </button>
                    <button
                        onClick={() => void persistRequisition("pending_need_approval")}
                        disabled={saving || success}
                        className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                    >
                        {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}
                        {success ? "สำเร็จ!" : submitLabel}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">เลขที่ PR <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={prNumber}
                                onChange={(e) => setPrNumber(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                placeholder="PR403-202603-001"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">วันที่ต้องการใช้ / ต้องการเริ่มงาน</label>
                            <input
                                type="date"
                                value={requiredDate}
                                onChange={(e) => setRequiredDate(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-3">ประเภทคำขอ</label>
                            <div className="flex gap-4">
                                <label className={`flex items-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-all ${requestType === "material" ? "border-indigo-600 bg-indigo-50/50" : "border-slate-200 hover:border-slate-300"}`}>
                                    <input
                                        type="radio"
                                        name="requestType"
                                        checked={requestType === "material"}
                                        onChange={() => setRequestType("material")}
                                    />
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">ขอซื้อวัสดุ</p>
                                        <p className="text-xs text-slate-500">เหมาะกับการออก PO ภายหลัง</p>
                                    </div>
                                </label>
                                <label className={`flex items-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-all ${requestType === "service" ? "border-emerald-600 bg-emerald-50/50" : "border-slate-200 hover:border-slate-300"}`}>
                                    <input
                                        type="radio"
                                        name="requestType"
                                        checked={requestType === "service"}
                                        onChange={() => setRequestType("service")}
                                    />
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">ขอจ้าง / ขอบริการ</p>
                                        <p className="text-xs text-slate-500">เหมาะกับการออก WC ภายหลัง</p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-3">เอกสารปลายทางที่คาดว่าจะใช้</label>
                            <div className="flex gap-4">
                                <label className={`flex items-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-all ${fulfillmentType === "po" ? "border-blue-600 bg-blue-50/50" : "border-slate-200 hover:border-slate-300"}`}>
                                    <input
                                        type="radio"
                                        name="fulfillmentType"
                                        checked={fulfillmentType === "po"}
                                        onChange={() => setFulfillmentType("po")}
                                    />
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">ออก PO</p>
                                        <p className="text-xs text-slate-500">ใช้กับการซื้อสินค้า/วัสดุ</p>
                                    </div>
                                </label>
                                <label className={`flex items-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-all ${fulfillmentType === "wc" ? "border-emerald-600 bg-emerald-50/50" : "border-slate-200 hover:border-slate-300"}`}>
                                    <input
                                        type="radio"
                                        name="fulfillmentType"
                                        checked={fulfillmentType === "wc"}
                                        onChange={() => setFulfillmentType("wc")}
                                    />
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">ออก WC</p>
                                        <p className="text-xs text-slate-500">ใช้กับงานจ้าง/ค่าแรง</p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">หัวข้อคำขอ <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                placeholder="เช่น ขอซื้อวัสดุงานผนังชั้น 2 / ขอจ้างงานเดินท่อประปา"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">ความเร่งด่วน</label>
                            <select
                                value={urgency}
                                onChange={(e) => setUrgency(e.target.value as PurchaseRequisitionUrgency)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            >
                                <option value="low">ต่ำ</option>
                                <option value="normal">ปกติ</option>
                                <option value="high">สูง</option>
                                <option value="urgent">เร่งด่วน</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">ภาษีโดยประมาณ</label>
                            <select
                                value={vatMode}
                                onChange={(e) => setVatMode(e.target.value as PurchaseRequisitionVatMode)}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            >
                                <option value="none">ไม่มี VAT</option>
                                <option value="exclusive">VAT 7% (ราคาไม่รวม VAT)</option>
                                <option value="inclusive">VAT 7% (ราคารวม VAT)</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">เหตุผลความต้องการ <span className="text-red-500">*</span></label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={4}
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                placeholder="อธิบายว่าทำไมจึงต้องซื้อ/จ้าง และผลกระทบหากไม่ดำเนินการ"
                            />
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    <div>
                        <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-end mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">รายการที่ขอซื้อ / ขอจ้าง</h3>
                        </div>

                        <div className="border border-slate-200 rounded-lg">
                            <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">ลำดับ</th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-2/5">รายละเอียด</th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">จำนวน</th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">หน่วย</th>
                                        <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">ราคาโดยประมาณ/หน่วย</th>
                                        <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">รวมโดยประมาณ</th>
                                        <th scope="col" className="px-4 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100">
                                    {items.map((item, index) => (
                                        <tr key={item.id} className="group">
                                            <td className="px-4 py-3 text-sm text-slate-400 font-medium">{index + 1}</td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={item.description}
                                                    onChange={(e) => handleItemChange(item.id, "description", e.target.value)}
                                                    placeholder="เช่น เหล็กกล่อง 2x2 / งานเดินสายไฟชั้น 2"
                                                    className="w-full text-sm border-0 bg-transparent focus:ring-0 text-slate-900 placeholder-slate-300"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(item.id, "quantity", Number(e.target.value))}
                                                    className="w-20 text-sm border border-slate-200 rounded py-1 px-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    list="pr-unit-list"
                                                    value={item.unit}
                                                    onChange={(e) => handleItemChange(item.id, "unit", e.target.value)}
                                                    className="w-20 text-sm border border-slate-200 rounded py-1 px-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <input
                                                    type="number"
                                                    value={item.unitPrice}
                                                    onChange={(e) => handleItemChange(item.id, "unitPrice", Number(e.target.value))}
                                                    className="w-28 text-sm text-right border border-slate-200 rounded py-1 px-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                                                {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    ✕
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                            {availableUnits.length > 0 && (
                                <datalist id="pr-unit-list">
                                    {availableUnits.map((unit) => (
                                        <option key={unit} value={unit} />
                                    ))}
                                </datalist>
                            )}
                            <div className="bg-slate-50 p-3 border-t border-slate-200 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleAddItem}
                                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 flex items-center"
                                    >
                                        <Plus size={16} className="mr-1" /> เพิ่มรายการ
                                    </button>
                                    <label className="text-sm text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 flex items-center cursor-pointer">
                                        <Upload size={16} className="mr-1" /> นำเข้า CSV
                                        <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCsv} />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleDownloadCsvSample}
                                        className="text-sm text-slate-600 hover:text-slate-900 font-medium px-2 py-1 flex items-center"
                                    >
                                        <Download size={16} className="mr-1" /> ตัวอย่าง CSV
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-6">
                        <div className="w-80 space-y-3">
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>ยอดรวมรายการ</span>
                                <span className="font-medium text-slate-900">฿ {itemsTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>ยอดรวมก่อนภาษี</span>
                                <span className="font-medium text-slate-900">฿ {subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>ภาษีมูลค่าเพิ่ม (VAT {vatRate}%)</span>
                                <span className="font-medium text-slate-900">฿ {vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-base pt-3 border-t border-slate-200">
                                <span className="font-bold text-slate-900">มูลค่ารวมโดยประมาณ</span>
                                <span className="font-bold text-indigo-700">฿ {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
