import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { createVoPrintToken } from "@/lib/voPrintToken";
import { Project } from "@/types/project";
import { VariationOrder } from "@/types/vo";
import type { CompanySettings } from "@/components/vo/VariationOrderDocument";

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

function getEdgeExecutablePath() {
    const candidates = [
        process.env.EDGE_EXECUTABLE_PATH,
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ].filter((value): value is string => Boolean(value && value.trim()));

    return candidates[0] || "";
}

async function runEdgePrint(url: string, outputPath: string, userDataDir: string) {
    const executablePath = getEdgeExecutablePath();
    if (!executablePath) {
        throw new Error("ไม่พบ Microsoft Edge สำหรับสร้าง PDF");
    }

    await new Promise<void>((resolve, reject) => {
        const args = [
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-extensions",
            "--run-all-compositor-stages-before-draw",
            "--virtual-time-budget=8000",
            `--user-data-dir=${userDataDir}`,
            `--print-to-pdf=${outputPath}`,
            "--print-to-pdf-no-header",
            url,
        ];

        const child = spawn(executablePath, args, {
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
        });

        let stderr = "";
        const timeout = setTimeout(() => {
            child.kill();
            reject(new Error("หมดเวลารอ Edge สร้าง PDF"));
        }, 30000);

        child.stderr.on("data", (chunk) => {
            stderr += String(chunk || "");
        });

        child.on("error", (error) => {
            clearTimeout(timeout);
            reject(error);
        });

        child.on("exit", (code) => {
            clearTimeout(timeout);
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(stderr.trim() || `Edge exited with code ${code}`));
        });
    });
}

async function buildVoPdfAttachmentFromPrintPage(params: {
    request: Request;
    vo: VariationOrder;
}) {
    const { request, vo } = params;
    const baseUrl = request.headers.get("origin") || new URL(request.url).origin;
    const token = createVoPrintToken(vo.id);
    const printUrl = `${baseUrl}/print/vo/${encodeURIComponent(vo.id)}?token=${encodeURIComponent(token)}`;
    const tempDir = path.join(process.cwd(), ".tmp", "vo-pdf");
    const runId = randomUUID();
    const outputPath = path.join(tempDir, `${runId}.pdf`);
    const userDataDir = path.join(tempDir, `edge-profile-${runId}`);

    await mkdir(tempDir, { recursive: true });
    await mkdir(userDataDir, { recursive: true });

    try {
        await runEdgePrint(printUrl, outputPath, userDataDir);
        const pdfBytes = await readFile(outputPath);

        return {
            fileName: `${vo.voNumber || "VO"}.pdf`,
            mimeType: "application/pdf",
            contentBase64: Buffer.from(pdfBytes).toString("base64"),
        };
    } finally {
        await rm(outputPath, { force: true }).catch(() => undefined);
        await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
    }
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
        const defaultSubject = `แจ้งอนุมัติ VO ${vo.voNumber} - ${projectName}`;
        const defaultText = [
            `เรียน ${recipientName}`,
            "",
            "เอกสารใบสั่งเปลี่ยนแปลงงาน (VO) ได้รับการอนุมัติเรียบร้อยแล้ว",
            `โครงการ: ${projectName}`,
            `เลขที่เอกสาร: ${vo.voNumber}`,
            `เรื่อง: ${vo.title || "-"}`,
            `วันที่เอกสาร: ${issueDate}`,
            `ผลกระทบงบประมาณ: ${totalAmount} บาท`,
            "",
            "กรุณาตรวจสอบรายละเอียดเอกสารจากระบบ",
            "",
            "ขอบคุณครับ/ค่ะ",
        ].join("\n");
        const subject = requestedSubject || defaultSubject;
        const text = requestedTextBody || defaultText;

        const html = `
            <div style="font-family:Arial,sans-serif;line-height:1.7;color:#0f172a;white-space:pre-wrap">${escapeHtml(text).replaceAll("\n", "<br />")}</div>
        `.trim();

        const settingsSnapshot = await adminDb.collection("system_settings").doc("global_config").get();
        const companySettings = (settingsSnapshot.exists ? (settingsSnapshot.data()?.companySettings as CompanySettings | undefined) : null) || null;
        const senderName = String(companySettings?.name || "EGP System").trim() || "EGP System";

        const attachment = includeAttachment
            ? await buildVoPdfAttachmentFromPrintPage({
                request,
                vo,
            })
            : null;

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
