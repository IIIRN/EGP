"use client";

import { Building2, Download, Loader2, Pencil, Plus, Search, Trash2, Upload, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, deleteDoc, onSnapshot, query, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Vendor } from "@/types/vendor";
import { downloadCsv, normalizeHeader, parseBooleanStatus, parseCsvRows } from "@/lib/csvUtils";
import ConfirmDeleteModal from "@/components/shared/ConfirmDeleteModal";
import PaginationControls from "@/components/shared/PaginationControls";

type DeleteDialogState = {
    isOpen: boolean;
    ids: string[];
    title: string;
    message: string;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function VendorsPage() {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [importing, setImporting] = useState(false);
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
    const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
        isOpen: false,
        ids: [],
        title: "",
        message: "",
    });

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const headerCheckboxRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const q = query(collection(db, "vendors"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const vendorData: Vendor[] = [];
            snapshot.forEach((docSnap) => {
                vendorData.push({ id: docSnap.id, ...docSnap.data() } as Vendor);
            });

            vendorData.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            });

            setVendors(vendorData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const filteredVendors = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return vendors;

        return vendors.filter((vendor) =>
            (vendor.name || "").toLowerCase().includes(term) ||
            (vendor.taxId || "").toLowerCase().includes(term) ||
            (vendor.contactName || "").toLowerCase().includes(term) ||
            (vendor.phone || "").toLowerCase().includes(term) ||
            (vendor.secondaryPhone || "").toLowerCase().includes(term) ||
            (vendor.email || "").toLowerCase().includes(term) ||
            (vendor.address || "").toLowerCase().includes(term)
        );
    }, [vendors, searchTerm]);

    const filteredIdSet = useMemo(() => {
        return new Set(filteredVendors.map((vendor) => vendor.id).filter((id): id is string => Boolean(id)));
    }, [filteredVendors]);

    const totalPages = Math.max(1, Math.ceil(filteredVendors.length / pageSize));

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, pageSize]);

    useEffect(() => {
        setSelectedIds((prev) => {
            let changed = false;
            const next = new Set<string>();

            for (const id of prev) {
                if (filteredIdSet.has(id)) {
                    next.add(id);
                } else {
                    changed = true;
                }
            }

            return changed ? next : prev;
        });
    }, [filteredIdSet]);

    const paginatedVendors = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredVendors.slice(start, start + pageSize);
    }, [currentPage, filteredVendors, pageSize]);

    const currentPageIds = useMemo(() => paginatedVendors.map((vendor) => vendor.id), [paginatedVendors]);

    const allCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id));
    const someCurrentPageSelected = currentPageIds.some((id) => selectedIds.has(id));

    useEffect(() => {
        if (!headerCheckboxRef.current) return;
        headerCheckboxRef.current.indeterminate = someCurrentPageSelected && !allCurrentPageSelected;
    }, [allCurrentPageSelected, someCurrentPageSelected]);

    const toggleCurrentPageSelection = (checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            for (const id of currentPageIds) {
                if (checked) {
                    next.add(id);
                } else {
                    next.delete(id);
                }
            }
            return next;
        });
    };

    const toggleSingleSelection = (id: string, checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) {
                next.add(id);
            } else {
                next.delete(id);
            }
            return next;
        });
    };

    const formatCsvText = (val: string | undefined | null) => {
        if (!val) return "";
        return `\t${val}`; // Prefix with tab to force Excel to treat it as text
    };

    const handleExportCsv = () => {
        const rows = vendors
            .slice()
            .sort((a, b) => (a.name || "").localeCompare(b.name || "", "th"))
            .map((vendor) => ([
                vendor.name || "",
                formatCsvText(vendor.taxId),
                vendor.contactName || "",
                formatCsvText(vendor.phone),
                formatCsvText(vendor.secondaryPhone),
                vendor.email || "",
                vendor.address || "",
                vendor.googleMapUrl || "",
                vendor.isActive ?? true,
                (vendor.vendorTypes || []).join("|"),
            ]));

        const date = new Date().toISOString().slice(0, 10);
        downloadCsv(
            `vendors_${date}.csv`,
            ["ชื่อร้านค้า", "เลขผู้เสียภาษี", "ชื่อผู้ติดต่อ", "เบอร์โทรศัพท์", "เบอร์ติดต่อสำรอง", "อีเมล", "ที่อยู่", "ลิงก์แผนที่", "สถานะ", "ประเภทสินค้า"],
            rows
        );
    };

    const handleImportCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImporting(true);
        try {
            const text = await file.text();
            const rows = parseCsvRows(text);
            if (rows.length < 2) {
                alert("No data found in CSV file");
                return;
            }

            const headers = rows[0].map(normalizeHeader);
            const dataRows = rows.slice(1);
            const findIndex = (candidates: string[]) => headers.findIndex((header) => candidates.some((candidate) => header.includes(candidate)));

            const nameIndex = findIndex(["name", "vendorname", "company", "ชื่อร้านค้า", "บริษัท"]);
            const taxIdIndex = findIndex(["taxid", "เลขผู้เสียภาษี"]);
            const contactNameIndex = findIndex(["contactname", "ชื่อผู้ติดต่อ"]);
            const phoneIndex = findIndex(["phone", "เบอร์โทรศัพท์", "เบอร์โทร"]);
            const secondaryPhoneIndex = findIndex(["secondaryphone", "backupphone", "altphone", "เบอร์ติดต่อสำรอง", "เบอร์สำรอง"]);
            const emailIndex = findIndex(["email", "อีเมล"]);
            const addressIndex = findIndex(["address", "ที่อยู่"]);
            const mapIndex = findIndex(["googlemapurl", "mapurl", "maps", "ลิงก์แผนที่", "แผนที่"]);
            const activeIndex = findIndex(["isactive", "active", "status", "สถานะ"]);
            const typesIndex = findIndex(["vendortypes", "types", "category", "ประเภทสินค้า", "ประเภท"]);

            if (nameIndex < 0) {
                alert("CSV must include vendor name column (for example: name)");
                return;
            }

            const existingByTaxId = new Map<string, Vendor>();
            const existingByName = new Map<string, Vendor>();

            for (const item of vendors) {
                if (item.taxId && item.taxId !== "-") {
                    existingByTaxId.set(item.taxId.trim().toLowerCase(), item);
                }
                existingByName.set((item.name || "").trim().toLowerCase(), item);
            }

            let inserted = 0;
            let updated = 0;
            let skipped = 0;

            for (const row of dataRows) {
                const rawName = (row[nameIndex] || "").trim();
                if (!rawName) {
                    skipped += 1;
                    continue;
                }

                const rawTaxId = taxIdIndex >= 0 ? (row[taxIdIndex] || "").trim() : "";

                const existing =
                    (rawTaxId ? existingByTaxId.get(rawTaxId.toLowerCase()) : undefined) ||
                    existingByName.get(rawName.toLowerCase());

                const payload = {
                    name: rawName,
                    taxId: rawTaxId || existing?.taxId || "-",
                    contactName: contactNameIndex >= 0 ? ((row[contactNameIndex] || "").trim() || existing?.contactName || "-") : (existing?.contactName || "-"),
                    phone: phoneIndex >= 0 ? ((row[phoneIndex] || "").trim() || existing?.phone || "-") : (existing?.phone || "-"),
                    secondaryPhone: secondaryPhoneIndex >= 0 ? ((row[secondaryPhoneIndex] || "").trim() || existing?.secondaryPhone || "") : (existing?.secondaryPhone || ""),
                    email: emailIndex >= 0 ? ((row[emailIndex] || "").trim() || existing?.email || "") : (existing?.email || ""),
                    address: addressIndex >= 0 ? ((row[addressIndex] || "").trim() || existing?.address || "-") : (existing?.address || "-"),
                    googleMapUrl: mapIndex >= 0 ? ((row[mapIndex] || "").trim() || existing?.googleMapUrl || "") : (existing?.googleMapUrl || ""),
                    isActive: activeIndex >= 0 ? parseBooleanStatus(row[activeIndex] || "") : (existing?.isActive ?? true),
                    vendorTypes: typesIndex >= 0
                        ? (row[typesIndex] || "").split("|").map((item) => item.trim()).filter(Boolean)
                        : (existing?.vendorTypes || []),
                    updatedAt: new Date().toISOString(),
                };

                if (existing?.id) {
                    await updateDoc(doc(db, "vendors", existing.id), payload);
                    updated += 1;
                } else {
                    await addDoc(collection(db, "vendors"), {
                        ...payload,
                        createdAt: new Date().toISOString(),
                    });
                    inserted += 1;
                }
            }

            alert(`CSV import success\nInserted: ${inserted}\nUpdated: ${updated}\nSkipped: ${skipped}`);
        } catch (error) {
            console.error("CSV import vendors error:", error);
            alert("CSV import failed");
        } finally {
            setImporting(false);
            event.target.value = "";
        }
    };

    const requestDeleteSingle = (vendor: Vendor) => {
        setDeleteDialog({
            isOpen: true,
            ids: [vendor.id],
            title: "Delete vendor",
            message: `Delete vendor \"${vendor.name}\"?`,
        });
    };

    const requestDeleteSelected = () => {
        if (selectedIds.size === 0) return;
        setDeleteDialog({
            isOpen: true,
            ids: Array.from(selectedIds),
            title: "Delete selected vendors",
            message: `Delete ${selectedIds.size} selected vendors? This action cannot be undone.`,
        });
    };

    const closeDeleteDialog = () => {
        if (deletingIds.size > 0) return;
        setDeleteDialog({ isOpen: false, ids: [], title: "", message: "" });
    };

    const confirmDelete = async () => {
        if (deleteDialog.ids.length === 0) return;

        const idsToDelete = deleteDialog.ids;
        setDeletingIds(new Set(idsToDelete));
        try {
            await Promise.all(idsToDelete.map((id) => deleteDoc(doc(db, "vendors", id))));
            setSelectedIds((prev) => {
                const next = new Set(prev);
                for (const id of idsToDelete) {
                    next.delete(id);
                }
                return next;
            });
            setDeleteDialog({ isOpen: false, ids: [], title: "", message: "" });
        } catch (error) {
            console.error("Delete vendors error:", error);
            alert("Delete vendor data failed");
        } finally {
            setDeletingIds(new Set());
        }
    };

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Vendors</h1>
                        <p className="text-sm text-slate-500 mt-1">Manage all suppliers and partners in one place.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCsv} />
                        <button
                            type="button"
                            disabled={importing}
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            {importing ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Upload size={16} className="mr-2" />}
                            Import CSV
                        </button>
                        <button
                            type="button"
                            onClick={handleExportCsv}
                            className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                        >
                            <Download size={16} className="mr-2" />
                            Export CSV
                        </button>
                        <button
                            type="button"
                            disabled={selectedIds.size === 0 || deletingIds.size > 0}
                            onClick={requestDeleteSelected}
                            className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                            {deletingIds.size > 1 ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Trash2 size={16} className="mr-2" />}
                            Delete Selected ({selectedIds.size})
                        </button>
                        <Link
                            href="/vendors/create"
                            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
                        >
                            <Plus size={18} className="mr-2" />
                            Add Vendor
                        </Link>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center bg-slate-50/50">
                        <div className="relative max-w-sm w-full">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Search by company name, tax ID, contact"
                                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>
                        <div className="text-sm text-slate-500">Total {filteredVendors.length} items</div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th scope="col" className="px-4 py-3 text-left">
                                        <input
                                            ref={headerCheckboxRef}
                                            type="checkbox"
                                            checked={allCurrentPageSelected}
                                            onChange={(event) => toggleCurrentPageSelection(event.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            aria-label="Select all rows on this page"
                                        />
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendor / Company</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tax ID</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading vendor data...</td>
                                    </tr>
                                ) : filteredVendors.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <Users className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                                            <h3 className="text-sm font-semibold text-slate-900">No vendor records found</h3>
                                            <p className="mt-1 text-sm text-slate-500">Add your first vendor or import by CSV.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedVendors.map((vendor) => {
                                        const isRowSelected = selectedIds.has(vendor.id);
                                        const isRowDeleting = deletingIds.has(vendor.id);

                                        return (
                                            <tr key={vendor.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-4 align-top">
                                                    <input
                                                        type="checkbox"
                                                        checked={isRowSelected}
                                                        onChange={(event) => toggleSingleSelection(vendor.id, event.target.checked)}
                                                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                        aria-label={`Select vendor ${vendor.name}`}
                                                    />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mr-3">
                                                            <Building2 size={20} />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium text-slate-900">{vendor.name}</div>
                                                            {vendor.googleMapUrl && (
                                                                <a href={vendor.googleMapUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">
                                                                    Open map
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-slate-900 mt-1">Phone: {vendor.phone || "-"}</div>
                                                    {vendor.secondaryPhone && <div className="text-sm text-slate-500">Backup: {vendor.secondaryPhone}</div>}
                                                    <div className="text-sm text-slate-500">Contact: {vendor.contactName || "-"}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">{vendor.taxId || "-"}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {vendor.isActive ? (
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Active</span>
                                                    ) : (
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-800">Inactive</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="inline-flex items-center gap-2">
                                                        <Link
                                                            href={`/vendors/${vendor.id}`}
                                                            title="Edit"
                                                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                                                        >
                                                            <Pencil size={14} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            title="Delete"
                                                            disabled={deletingIds.size > 0}
                                                            onClick={() => requestDeleteSingle(vendor)}
                                                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
                                                        >
                                                            {isRowDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="border-t border-slate-200 bg-slate-50/40">
                        <PaginationControls
                            page={currentPage}
                            pageSize={pageSize}
                            totalItems={filteredVendors.length}
                            pageSizeOptions={PAGE_SIZE_OPTIONS}
                            onPageChange={setCurrentPage}
                            onPageSizeChange={setPageSize}
                        />
                    </div>
                </div>
            </div>

            <ConfirmDeleteModal
                isOpen={deleteDialog.isOpen}
                title={deleteDialog.title}
                message={deleteDialog.message}
                confirmLabel="Delete"
                loading={deletingIds.size > 0}
                onCancel={closeDeleteDialog}
                onConfirm={confirmDelete}
            />
        </>
    );
}
