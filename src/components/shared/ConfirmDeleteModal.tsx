"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

type ConfirmDeleteModalProps = {
    isOpen: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    loading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

export default function ConfirmDeleteModal({
    isOpen,
    title = "Confirm Delete",
    message,
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    loading = false,
    onConfirm,
    onCancel,
}: ConfirmDeleteModalProps) {
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !loading) {
                onCancel();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, loading, onCancel]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
                type="button"
                aria-label="Close modal backdrop"
                className="absolute inset-0 bg-slate-900/50"
                onClick={loading ? undefined : onCancel}
            />

            <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200">
                <div className="p-5 border-b border-slate-200">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600">
                            <TriangleAlert size={18} />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                            <p className="mt-1 text-sm text-slate-600">{message}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 p-4 bg-slate-50 rounded-b-xl">
                    <button
                        type="button"
                        disabled={loading}
                        onClick={onCancel}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        disabled={loading}
                        onClick={onConfirm}
                        className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                    >
                        {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

