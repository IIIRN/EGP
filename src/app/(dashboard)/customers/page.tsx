"use client";

import { Building2, ContactRound, Download, Loader2, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Customer } from "@/types/customer";
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

function maxOnNumber(values: string[]) {
    let maxNumber = 0;
    for (const value of values) {
        const match = /^ON(\d+)$/i.exec((value || "").trim());
        if (match) {
            maxNumber = Math.max(maxNumber, Number(match[1]));
        }
    }
    return maxNumber;
}

function formatOnNumber(value: number) {
    return `ON${String(value).padStart(3, "0")}`;
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
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
        const q = query(collection(db, "customers"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const customerData: Customer[] = [];
            snapshot.forEach((docSnap) => {
                customerData.push({ id: docSnap.id, isActive: true, ...docSnap.data() } as Customer);
            });

            customerData.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            });

            setCustomers(customerData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const filteredCustomers = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return customers;

        return customers.filter((customer) => (
            (customer.idCus || "").toLowerCase().includes(term) ||
            (customer.customerName || "").toLowerCase().includes(term) ||
            (customer.contactPhone || "").toLowerCase().includes(term) ||
            (customer.officeAddress || "").toLowerCase().includes(term) ||
            (customer.taxId || "").toLowerCase().includes(term) ||
            (customer.address || "").toLowerCase().includes(term)
        ));
    }, [customers, searchTerm]);

    const filteredIdSet = useMemo(() => {
        return new Set(filteredCustomers.map((customer) => customer.id).filter((id): id is string => Boolean(id)));
    }, [filteredCustomers]);

    const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));

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

    const paginatedCustomers = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredCustomers.slice(start, start + pageSize);
    }, [currentPage, filteredCustomers, pageSize]);

    const currentPageIds = useMemo(() => {
        return paginatedCustomers.map((customer) => customer.id).filter((id): id is string => Boolean(id));
    }, [paginatedCustomers]);

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

    const handleExportCsv = () => {
        const rows = customers
            .slice()
            .sort((a, b) => (a.idCus || "").localeCompare(b.idCus || "", "th"))
            .map((customer) => ([
                customer.idCus || "",
                customer.customerName || "",
                customer.contactPhone || "",
                customer.officeAddress || customer.address || "",
                customer.taxId || "",
                customer.isActive ?? true,
            ]));

        const date = new Date().toISOString().slice(0, 10);
        downloadCsv(
            `customers_${date}.csv`,
            ["id_cus", "customer_name", "contact_phone", "office_address", "tax_id", "is_active"],
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

            const findIndex = (candidates: string[]) => headers.findIndex((header) => candidates.some((key) => header.includes(key)));
            const idIndex = findIndex(["idcus", "idcustomer"]);
            const nameIndex = findIndex(["customername", "name"]);
            const contactPhoneIndex = findIndex(["contactphone", "phone"]);
            const officeAddressIndex = findIndex(["officeaddress", "office"]);
            const addressIndex = findIndex(["address"]);
            const taxIdIndex = findIndex(["taxid"]);
            const activeIndex = findIndex(["isactive", "active", "status"]);

            if (nameIndex < 0) {
                alert("CSV must include customer name column (for example: customer_name)");
                return;
            }

            const existingByIdCus = new Map<string, Customer>();
            for (const item of customers) {
                existingByIdCus.set((item.idCus || "").trim().toLowerCase(), item);
            }

            const usedIdSet = new Set<string>(customers.map((item) => (item.idCus || "").trim().toLowerCase()));
            let runningMax = maxOnNumber(customers.map((item) => item.idCus || ""));
            const nextAutoId = () => {
                do {
                    runningMax += 1;
                } while (usedIdSet.has(formatOnNumber(runningMax).toLowerCase()));
                return formatOnNumber(runningMax);
            };

            let inserted = 0;
            let updated = 0;
            let skipped = 0;

            for (const row of dataRows) {
                const rawName = (row[nameIndex] || "").trim();
                const rawId = idIndex >= 0 ? (row[idIndex] || "").trim() : "";

                if (!rawName) {
                    skipped += 1;
                    continue;
                }

                const idCus = rawId || nextAutoId();
                usedIdSet.add(idCus.toLowerCase());
                const existing = existingByIdCus.get(idCus.toLowerCase());

                const nextContactPhone = contactPhoneIndex >= 0
                    ? ((row[contactPhoneIndex] || "").trim() || "-")
                    : (existing?.contactPhone || "-");

                const nextOfficeAddress = officeAddressIndex >= 0
                    ? ((row[officeAddressIndex] || "").trim() || "-")
                    : addressIndex >= 0
                        ? ((row[addressIndex] || "").trim() || "-")
                        : (existing?.officeAddress || existing?.address || "-");
                const nextTaxId = taxIdIndex >= 0
                    ? ((row[taxIdIndex] || "").trim() || "-")
                    : (existing?.taxId || "-");
                const nextIsActive = activeIndex >= 0
                    ? parseBooleanStatus(row[activeIndex] || "")
                    : (existing?.isActive ?? true);

                const payload = {
                    idCus,
                    customerName: rawName,
                    contactPhone: nextContactPhone,
                    officeAddress: nextOfficeAddress,
                    address: nextOfficeAddress,
                    taxId: nextTaxId,
                    isActive: nextIsActive,
                    updatedAt: new Date().toISOString(),
                };

                if (existing?.id) {
                    await updateDoc(doc(db, "customers", existing.id), payload);
                    updated += 1;
                } else {
                    await addDoc(collection(db, "customers"), {
                        ...payload,
                        createdAt: new Date().toISOString(),
                    });
                    inserted += 1;
                }
            }

            alert(`CSV import success\nInserted: ${inserted}\nUpdated: ${updated}\nSkipped: ${skipped}`);
        } catch (error) {
            console.error("CSV import customers error:", error);
            alert("CSV import failed");
        } finally {
            setImporting(false);
            event.target.value = "";
        }
    };

    const requestDeleteSingle = (customer: Customer) => {
        if (!customer.id) return;
        setDeleteDialog({
            isOpen: true,
            ids: [customer.id],
            title: "Delete customer",
            message: `Delete customer \"${customer.customerName || customer.idCus}\"?`,
        });
    };

    const requestDeleteSelected = () => {
        if (selectedIds.size === 0) return;
        setDeleteDialog({
            isOpen: true,
            ids: Array.from(selectedIds),
            title: "Delete selected customers",
            message: `Delete ${selectedIds.size} selected customers? This action cannot be undone.`,
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
            await Promise.all(idsToDelete.map((id) => deleteDoc(doc(db, "customers", id))));
            setSelectedIds((prev) => {
                const next = new Set(prev);
                for (const id of idsToDelete) {
                    next.delete(id);
                }
                return next;
            });
            setDeleteDialog({ isOpen: false, ids: [], title: "", message: "" });
        } catch (error) {
            console.error("Delete customers error:", error);
            alert("Delete customer data failed");
        } finally {
            setDeletingIds(new Set());
        }
    };

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customers</h1>
                        <p className="text-sm text-slate-500 mt-1">Manage customer list with tax ID and office address.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={handleImportCsv}
                        />
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
                            href="/customers/create"
                            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
                        >
                            <Plus size={18} className="mr-2" />
                            Add Customer
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
                                placeholder="Search by id, name, phone, tax id"
                                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>
                        <div className="text-sm text-slate-500">
                            Total {filteredCustomers.length} items
                        </div>
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
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Customer / ID
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Contact
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Tax ID
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                            Loading customer data...
                                        </td>
                                    </tr>
                                ) : filteredCustomers.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <ContactRound className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                                            <h3 className="text-sm font-semibold text-slate-900">No customer records found</h3>
                                            <p className="mt-1 text-sm text-slate-500">Start by adding the first customer record.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedCustomers.map((customer) => {
                                        const rowId = customer.id || "";
                                        const isRowSelected = rowId ? selectedIds.has(rowId) : false;
                                        const isRowDeleting = rowId ? deletingIds.has(rowId) : false;

                                        return (
                                            <tr key={customer.id || customer.idCus} className="hover:bg-slate-50">
                                                <td className="px-4 py-4 align-top">
                                                    {rowId ? (
                                                        <input
                                                            type="checkbox"
                                                            checked={isRowSelected}
                                                            onChange={(event) => toggleSingleSelection(rowId, event.target.checked)}
                                                            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                            aria-label={`Select customer ${customer.customerName}`}
                                                        />
                                                    ) : null}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mr-3">
                                                            <Building2 size={20} />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium text-slate-900">{customer.customerName}</div>
                                                            <div className="text-xs text-slate-500 mt-0.5">ID: {customer.idCus}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500 max-w-[520px] truncate">
                                                    <div className="text-sm text-slate-900 mt-1">Phone: {customer.contactPhone || "-"}</div>
                                                    <div className="text-sm text-slate-500 max-w-[520px] truncate">Office: {customer.officeAddress || customer.address || "-"}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                                                    {customer.taxId || "-"}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {customer.isActive ? (
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-800">
                                                            Inactive
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="inline-flex items-center gap-2">
                                                        <Link
                                                            href={`/customers/${customer.id}`}
                                                            title="Edit"
                                                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                                                        >
                                                            <Pencil size={14} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            title="Delete"
                                                            disabled={!rowId || deletingIds.size > 0}
                                                            onClick={() => requestDeleteSingle(customer)}
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
                            totalItems={filteredCustomers.length}
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
