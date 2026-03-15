export type DocumentSeries = "PO" | "WC" | "VO" | "PR" | "PC";

type BuildDocumentPrefixParams = {
    series: DocumentSeries;
    projectCode: string;
    typeCode?: string;
    date?: Date;
};

type BuildDocumentNumberParams = BuildDocumentPrefixParams & {
    sequence: number;
};

export function normalizeProjectCode(code: string | null | undefined, fallback = "") {
    const normalized = (code || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");

    return normalized || fallback;
}

export function buildDocumentPrefix({
    series,
    projectCode,
    typeCode,
    date = new Date(),
}: BuildDocumentPrefixParams) {
    const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
    const typeSuffix = typeCode ? `-${typeCode}` : "";

    return `${series}${projectCode}-${yearMonth}${typeSuffix}`;
}

export function buildDocumentNumber({
    sequence,
    ...prefixParams
}: BuildDocumentNumberParams) {
    const separator = prefixParams.typeCode ? "" : "-";
    return `${buildDocumentPrefix(prefixParams)}${separator}${String(sequence).padStart(3, "0")}`;
}

export function parseDocumentSequence(documentNumber: string, prefix: string) {
    if (!documentNumber.startsWith(prefix)) {
        return null;
    }

    const parsed = Number.parseInt(documentNumber.slice(prefix.length).replace(/^-/, ""), 10);
    return Number.isFinite(parsed) ? parsed : null;
}
