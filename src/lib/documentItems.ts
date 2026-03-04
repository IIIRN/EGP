export const PROCESSING_FEE_LABEL = "ค่าดำเนินการ";

export type CsvDocumentItem = {
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
};

type MinimalItem = {
    description?: string;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
    amount?: number;
};

function normalizeText(value?: string) {
    return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function toNumber(value?: string | number) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (!value) return 0;
    const normalized = value.replace(/,/g, "").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];

        if (char === "\"") {
            const nextChar = line[i + 1];
            if (inQuotes && nextChar === "\"") {
                current += "\"";
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    result.push(current.trim());
    return result;
}

function normalizeHeader(value: string) {
    return value.toLowerCase().replace(/[\s_\-\/]/g, "");
}

export function parseDocumentItemsCsv(text: string): CsvDocumentItem[] {
    const cleaned = text.replace(/^\uFEFF/, "");
    const lines = cleaned
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (lines.length === 0) return [];

    const rows = lines.map(parseCsvLine);
    const headerRow = rows[0].map(normalizeHeader);

    const descriptionHeaders = ["description", "detail", "item", "รายการ", "รายละเอียด", "รายละเอียดงาน"];
    const quantityHeaders = ["quantity", "qty", "จำนวน"];
    const unitHeaders = ["unit", "หน่วย"];
    const unitPriceHeaders = ["unitprice", "price", "ราคา", "ราคาต่อหน่วย", "priceperunit"];
    const amountHeaders = ["amount", "total", "รวม", "รวมเป็นเงิน"];

    const descriptionIndex = headerRow.findIndex((h) => descriptionHeaders.includes(h));
    const quantityIndex = headerRow.findIndex((h) => quantityHeaders.includes(h));
    const unitIndex = headerRow.findIndex((h) => unitHeaders.includes(h));
    const unitPriceIndex = headerRow.findIndex((h) => unitPriceHeaders.includes(h));
    const amountIndex = headerRow.findIndex((h) => amountHeaders.includes(h));

    const hasHeader = descriptionIndex >= 0 || quantityIndex >= 0 || unitPriceIndex >= 0 || amountIndex >= 0;
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const resolvedDescriptionIndex = descriptionIndex >= 0 ? descriptionIndex : 0;
    const resolvedQuantityIndex = quantityIndex >= 0 ? quantityIndex : 1;
    const resolvedUnitIndex = unitIndex >= 0 ? unitIndex : 2;
    const resolvedUnitPriceIndex = unitPriceIndex >= 0 ? unitPriceIndex : 3;

    const parsedRows = dataRows
        .map((columns) => {
            const description = (columns[resolvedDescriptionIndex] || "").trim();
            const quantity = toNumber(columns[resolvedQuantityIndex]) || 1;
            const unit = (columns[resolvedUnitIndex] || "").trim();
            const unitPrice = toNumber(columns[resolvedUnitPriceIndex]);
            const amountFromFile = amountIndex >= 0 ? toNumber(columns[amountIndex]) : 0;
            const amount = amountFromFile > 0 ? amountFromFile : quantity * unitPrice;

            return {
                description,
                quantity,
                unit,
                unitPrice,
                amount,
            };
        })
        .filter((row) => row.description || row.amount > 0 || row.unitPrice > 0);

    return parsedRows;
}

export function splitProcessingFeeItem<T extends MinimalItem>(items: T[]) {
    if (!items.length) return { items, processingFee: 0 };

    const lastItem = items[items.length - 1];
    if (normalizeText(lastItem.description) !== normalizeText(PROCESSING_FEE_LABEL)) {
        return { items, processingFee: 0 };
    }

    const processingFee = toNumber(lastItem.amount ?? lastItem.unitPrice);
    return {
        items: items.slice(0, -1),
        processingFee,
    };
}


