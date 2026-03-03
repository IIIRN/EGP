export function normalizeHeader(value: string) {
    return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function parseBooleanStatus(value: string) {
    const text = (value || "").trim().toLowerCase();
    if (!text) return true;

    const falseValues = ["false", "0", "no", "inactive", "disabled", "ปิด", "ปิดใช้งาน", "ไม่ใช้งาน"];
    return !falseValues.includes(text);
}

export function csvEscape(value: string | number | boolean | null | undefined) {
    const text = String(value ?? "");
    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
}

function parseCsvLine(line: string) {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === "," && !inQuotes) {
            values.push(current);
            current = "";
            continue;
        }

        current += char;
    }

    values.push(current);
    return values.map((item) => item.trim());
}

export function parseCsvRows(text: string) {
    return text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .map(parseCsvLine);
}

export function downloadCsv(
    filename: string,
    headers: string[],
    rows: Array<Array<string | number | boolean | null | undefined>>
) {
    const csvRows: string[] = [];
    csvRows.push(headers.join(","));
    for (const row of rows) {
        csvRows.push(row.map((value) => csvEscape(value)).join(","));
    }

    const csvText = "\uFEFF" + csvRows.join("\r\n");
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
