import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { createVoPrintToken } from "@/lib/voPrintToken";
import { Project } from "@/types/project";
import { VariationOrder } from "@/types/vo";
import type { CompanySettings, SignatureOption } from "@/components/vo/VariationOrderDocument";

export const runtime = "nodejs";
export const maxDuration = 60;

function formatDate(value: unknown) {
    try {
        if (value && typeof value === "object" && "toDate" in value) {
            const timestamp = value as { toDate?: () => Date };
            if (typeof timestamp.toDate === "function") {
                return timestamp.toDate().toLocaleDateString("th-TH");
            }
        }

        if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) {
                return date.toLocaleDateString("th-TH");
            }
        }
    } catch {
        // ignore malformed dates and use fallback
    }

    return "-";
}

function formatSignedCurrency(value: number) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function resolvePrimarySignature(companySettings: CompanySettings | null): SignatureOption | null {
    if (!companySettings) {
        return null;
    }

    if (companySettings.signatures && companySettings.signatures.length > 0) {
        return companySettings.signatures[0] ?? null;
    }

    if (companySettings.signatureUrl) {
        return {
            name: "( ................................................ )",
            position: "ผู้อนุมัติ",
            signatureUrl: companySettings.signatureUrl,
        };
    }

    return null;
}

function getLocalBrowserExecutablePath() {
    const candidates = [
        process.env.CHROME_EXECUTABLE_PATH,
        process.env.PUPPETEER_EXECUTABLE_PATH,
        process.env.EDGE_EXECUTABLE_PATH,
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ].filter((value): value is string => Boolean(value && value.trim()));

    return candidates[0] || "";
}

async function buildVoPdfAttachmentFromPrintPage(params: {
    request: Request;
    vo: VariationOrder;
}) {
    const { request, vo } = params;
    const baseUrl = request.headers.get("origin") || new URL(request.url).origin;
    const token = createVoPrintToken(vo.id);
    const printUrl = `${baseUrl}/print/vo/${encodeURIComponent(vo.id)}?token=${encodeURIComponent(token)}`;

    const isVercel = Boolean(process.env.VERCEL);
    const localExecutablePath = getLocalBrowserExecutablePath();
    const executablePath = isVercel ? await chromium.executablePath() : localExecutablePath;

    if (!executablePath) {
        throw new Error("ไม่พบ Chrome/Chromium สำหรับสร้าง PDF");
    }

    const browser = await puppeteer.launch({
        args: isVercel
            ? puppeteer.defaultArgs({ args: chromium.args, headless: "shell" })
            : puppeteer.defaultArgs(),
        executablePath,
        headless: isVercel ? "shell" : true,
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1588, height: 2246, deviceScaleFactor: 2 });
        await page.emulateMediaType("print");
        await page.goto(printUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForFunction(() => document.fonts ? document.fonts.status === "loaded" : true, { timeout: 15000 });
        await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 });

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            preferCSSPageSize: true,
            scale: 1,
            margin: {
                top: "0mm",
                right: "0mm",
                bottom: "0mm",
                left: "0mm",
            },
        });

        return {
            fileName: `${vo.voNumber || "VO"}.pdf`,
            mimeType: "application/pdf",
            contentBase64: Buffer.from(pdfBuffer).toString("base64"),
        };
    } finally {
        await browser.close();
    }
}

function buildVoPdfAttachmentPayload(params: {
    vo: VariationOrder;
    project: Project;
    companySettings: CompanySettings | null;
    issueDate: string;
}) {
    const { vo, project, companySettings, issueDate } = params;
    const primarySignature = resolvePrimarySignature(companySettings);

    return {
        fileName: `${vo.voNumber || "VO"}.pdf`,
        vo: {
            voNumber: vo.voNumber || "-",
            title: vo.title || "-",
            createdAt: issueDate,
            reason: vo.reason || "-",
            items: Array.isArray(vo.items) ? vo.items : [],
            subTotal: vo.subTotal || 0,
            vatRate: vo.vatRate || 0,
            vatAmount: vo.vatAmount || 0,
            totalAmount: vo.totalAmount || 0,
        },
        project: {
            name: project.name || "-",
            contactName: project.contactName || "-",
            contactEmail: project.contactEmail || "-",
        },
        company: {
            name: companySettings?.name || "",
            address: companySettings?.address || "",
            phone: companySettings?.phone || "",
            email: companySettings?.email || "",
            logoUrl: companySettings?.logoUrl || "",
            signatureUrl: companySettings?.signatureUrl || "",
            primarySignature: primarySignature
                ? {
                      name: primarySignature.name || "",
                      position: primarySignature.position || "",
                      signatureUrl: primarySignature.signatureUrl || "",
                  }
                : null,
        },
    };
}

export async function POST(request: Request) {
    try {
        const webhookUrl = process.env.APPS_SCRIPT_EMAIL_WEBHOOK_URL;
        const webhookSecret = process.env.APPS_SCRIPT_EMAIL_SECRET;
        const debugCc = process.env.APPS_SCRIPT_EMAIL_DEBUG_CC;

        if (!webhookUrl || !webhookSecret) {
            return NextResponse.json(
                { error: "ยังไม่ได้ตั้งค่า APPS_SCRIPT_EMAIL_WEBHOOK_URL หรือ APPS_SCRIPT_EMAIL_SECRET ใน .env.local" },
                { status: 500 }
            );
        }

        const body = await request.json();
        const voId = String(body?.voId || "").trim();
        const requestedSubject = String(body?.subject || "").trim();
        const requestedTextBody = String(body?.textBody || "").trim();
        const includeAttachment = Boolean(body?.includeAttachment);

        if (!voId) {
            return NextResponse.json({ error: "ไม่พบรหัสเอกสาร VO" }, { status: 400 });
        }

        const voSnapshot = await adminDb.collection("variation_orders").doc(voId).get();
        if (!voSnapshot.exists) {
            return NextResponse.json({ error: "ไม่พบเอกสาร VO" }, { status: 404 });
        }

        const vo = { id: voSnapshot.id, ...voSnapshot.data() } as VariationOrder;
        if (vo.status !== "approved") {
            return NextResponse.json({ error: "ส่งอีเมลได้เฉพาะเอกสาร VO ที่อนุมัติแล้ว" }, { status: 400 });
        }

        const projectId = String(vo.projectId || "").trim();
        if (!projectId) {
            return NextResponse.json({ error: "ไม่พบข้อมูลโครงการของเอกสาร VO" }, { status: 400 });
        }

        const projectSnapshot = await adminDb.collection("projects").doc(projectId).get();
        if (!projectSnapshot.exists) {
            return NextResponse.json({ error: "ไม่พบข้อมูลโครงการ" }, { status: 404 });
        }

        const project = { id: projectSnapshot.id, ...projectSnapshot.data() } as Project;
        const recipientEmail = project.contactEmail?.trim();
        const recipientName = project.contactName?.trim() || "ผู้ติดต่อโครงการ";

        if (!recipientEmail) {
            return NextResponse.json({ error: "โครงการนี้ยังไม่มีอีเมลผู้ติดต่อ" }, { status: 400 });
        }

        const projectName = project.name || "-";
        const issueDate = formatDate(vo.createdAt);
        const totalAmount = formatSignedCurrency(vo.totalAmount || 0);
        const defaultSubject = `ขออนุมัติเปลี่ยนแปลงงาน - ${vo.title || "-"} - ${vo.voNumber}`;
        const defaultText = [
            `เรียน ${recipientName}`,
            "",
            `โครงการ: ${projectName}`,
            `เลขที่เอกสาร: ${vo.voNumber}`,
            `เรื่อง: ${vo.title || "-"}`,
            `วันที่เอกสาร: ${issueDate}`,
            `ผลกระทบงบประมาณ: ${totalAmount} บาท`,
            "",
            "กรุณาตรวจสอบรายละเอียดเอกสารจากระบบ",
        ].join("\n");
        const subject = requestedSubject || defaultSubject;
        const text = requestedTextBody || defaultText;

        const html = `
            <div style="font-family:Arial,sans-serif;line-height:1.7;color:#0f172a;white-space:pre-wrap">${escapeHtml(text).replaceAll("\n", "<br />")}</div>
        `.trim();

        const settingsSnapshot = await adminDb.collection("system_settings").doc("global_config").get();
        const companySettings = (settingsSnapshot.exists ? (settingsSnapshot.data()?.companySettings as CompanySettings | undefined) : null) || null;
        const senderName = String(companySettings?.name || "EGP System").trim() || "EGP System";

        const allowAppsScriptPdfFallback = String(process.env.ALLOW_APPS_SCRIPT_PDF_FALLBACK || "").trim() === "true";

        let attachment = null;
        if (includeAttachment) {
            try {
                attachment = await buildVoPdfAttachmentFromPrintPage({
                    request,
                    vo,
                });
            } catch (pdfError) {
                console.error("VO browser PDF generation failed:", pdfError);

                if (!allowAppsScriptPdfFallback) {
                    const message = pdfError instanceof Error ? pdfError.message : "สร้าง PDF แนบไม่สำเร็จ";
                    return NextResponse.json(
                        {
                            error: `สร้าง PDF แนบไม่สำเร็จ: ${message}`,
                        },
                        { status: 500 }
                    );
                }

                console.error("Falling back to Apps Script PDF layout because ALLOW_APPS_SCRIPT_PDF_FALLBACK=true");
                attachment = buildVoPdfAttachmentPayload({
                    vo,
                    project,
                    companySettings,
                    issueDate,
                });
            }
        }

        const webhookResponse = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                secret: webhookSecret,
                to: recipientEmail,
                subject,
                textBody: text,
                htmlBody: html,
                senderName,
                replyTo: companySettings?.email ? String(companySettings.email) : "",
                includeAttachment,
                debugCc: debugCc ? String(debugCc).trim() : "",
                attachment,
                metadata: {
                    kind: "vo",
                    voId: vo.id,
                    voNumber: vo.voNumber,
                    projectId: project.id,
                    projectName,
                    recipientName,
                    attachmentSource: includeAttachment && attachment && "contentBase64" in attachment ? "browser" : includeAttachment ? "appscript-fallback" : "none",
                },
            }),
        });

        const webhookResult = await webhookResponse.json().catch(() => ({}));
        if (!webhookResponse.ok || webhookResult?.success === false) {
            const errorMessage =
                typeof webhookResult?.error === "string"
                    ? webhookResult.error
                    : typeof webhookResult?.message === "string"
                      ? webhookResult.message
                      : "Apps Script ส่งอีเมลไม่สำเร็จ";

            return NextResponse.json({ error: errorMessage }, { status: webhookResponse.status });
        }

        return NextResponse.json({
            success: true,
            recipientEmail,
            result: webhookResult,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "ส่งอีเมลไม่สำเร็จ";
        console.error("VO send email error:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
