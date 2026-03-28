import { createHash } from "node:crypto";

function getPrintSecret() {
    return process.env.APPS_SCRIPT_EMAIL_SECRET || "egp-local-vo-print-secret";
}

export function createVoPrintToken(voId: string) {
    return createHash("sha256")
        .update(`${voId}:${getPrintSecret()}`)
        .digest("hex");
}

export function isValidVoPrintToken(voId: string, token: string) {
    return Boolean(token) && createVoPrintToken(voId) === token;
}
