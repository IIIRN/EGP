import { adminDb } from "@/lib/firebaseAdmin";
import { isValidVoPrintToken } from "@/lib/voPrintToken";
import { Project } from "@/types/project";
import { VariationOrder } from "@/types/vo";
import { CompanySettings, SignatureOption, VariationOrderDocument } from "@/components/vo/VariationOrderDocument";

export const dynamic = "force-dynamic";

function formatCreatedAt(value: unknown) {
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
}

function resolvePrimarySignature(companySettings: CompanySettings) {
    if (companySettings.signatures && companySettings.signatures.length > 0) {
        return companySettings.signatures[0] ?? null;
    }

    if (companySettings.signatureUrl) {
        return {
            name: "( ................................................ )",
            position: "ผู้อนุมัติ",
            signatureUrl: companySettings.signatureUrl,
        } satisfies SignatureOption;
    }

    return null;
}

export default async function VOPrintPage(props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ token?: string }>;
}) {
    const params = await props.params;
    const searchParams = await props.searchParams;
    const voId = params.id;
    const token = String(searchParams.token || "");

    if (!isValidVoPrintToken(voId, token)) {
        return <div className="p-10 text-center text-sm text-red-600">Unauthorized print request</div>;
    }

    const voSnapshot = await adminDb.collection("variation_orders").doc(voId).get();
    if (!voSnapshot.exists) {
        return <div className="p-10 text-center text-sm text-slate-500">ไม่พบเอกสาร VO</div>;
    }

    const vo = { id: voSnapshot.id, ...voSnapshot.data() } as VariationOrder;
    const projectSnapshot = await adminDb.collection("projects").doc(String(vo.projectId || "")).get();
    const project = (projectSnapshot.exists
        ? ({ id: projectSnapshot.id, ...projectSnapshot.data() } as Project)
        : null);

    const settingsSnapshot = await adminDb.collection("system_settings").doc("global_config").get();
    const companySettings = ({
        name: "บริษัท พาวเวอร์เทค เอนจิเนียริ่ง จำกัด",
        address: "9/10 ถ.มิตรสาร ต.ประตูชัย อ.พระนครศรีอยุธยา จ.พระนครศรีอยุธยา 13000",
        phone: "083-995-5629, 083-995-4495",
        email: "Powertec.civil@gmail.com",
        logoUrl: "",
        signatureUrl: "",
        signatures: [],
        ...(settingsSnapshot.exists ? (settingsSnapshot.data()?.companySettings as Partial<CompanySettings> | undefined) : undefined),
    }) satisfies CompanySettings;

    const projectContactName = project?.contactName?.trim() || "ผู้ติดต่อโครงการ";
    const primarySignature = resolvePrimarySignature(companySettings);

    return (
        <div className="min-h-screen bg-[#f3f4f6] print:bg-white">
            <style>{`
                @page {
                    size: A4 portrait;
                    margin: 0;
                }
                body {
                    background: #f3f4f6;
                }
                @media print {
                    body {
                        background: #ffffff;
                    }
                }
            `}</style>

            <div className="mx-auto w-full max-w-[210mm]">
                <VariationOrderDocument
                    vo={vo}
                    companySettings={companySettings}
                    projectName={project?.name || "-"}
                    projectContactName={projectContactName}
                    createdAtLabel={formatCreatedAt(vo.createdAt)}
                    primarySignature={primarySignature}
                    layoutVariant="attachment"
                />
            </div>
        </div>
    );
}
