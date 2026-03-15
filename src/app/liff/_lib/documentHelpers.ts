import type { UserRole } from "@/types/auth";

type FirestoreTimestampLike = {
    toDate?: () => Date;
    seconds?: number;
};

export function getTimestampMillis(value: unknown) {
    if (!value || typeof value !== "object") return 0;

    const timestamp = value as FirestoreTimestampLike;
    if (typeof timestamp.toDate === "function") {
        return timestamp.toDate().getTime();
    }
    if (typeof timestamp.seconds === "number") {
        return timestamp.seconds * 1000;
    }

    return 0;
}

export function formatDateThai(value: unknown, format: "short" | "long" = "short") {
    if (!value || typeof value !== "object") return "-";

    const timestamp = value as FirestoreTimestampLike;
    let date: Date | null = null;

    if (typeof timestamp.toDate === "function") {
        date = timestamp.toDate();
    } else if (typeof timestamp.seconds === "number") {
        date = new Date(timestamp.seconds * 1000);
    }

    if (!date) return "-";

    return date.toLocaleDateString(
        "th-TH",
        format === "long"
            ? { year: "numeric", month: "long", day: "numeric" }
            : { day: "2-digit", month: "2-digit", year: "2-digit" }
    );
}

export function formatMoney(value: number | undefined) {
    return `฿ ${Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

export function canSeeAllProjectDocuments(role?: UserRole) {
    return role === "admin" || role === "pm" || role === "procurement";
}
