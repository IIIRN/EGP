"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Plus, Search, Loader2, UserCircle, Pencil, UserCheck, UserX, Upload, Download, Trash2 } from "lucide-react";
import { collection, query, onSnapshot, orderBy, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserProfile, UserRole } from "@/types/auth";
import { useAuth } from "@/context/AuthContext";
import { downloadCsv, normalizeHeader, parseBooleanStatus, parseCsvRows } from "@/lib/csvUtils";
import ConfirmDeleteModal from "@/components/shared/ConfirmDeleteModal";
import PaginationControls from "@/components/shared/PaginationControls";

const allowedRoles: UserRole[] = ["admin", "procurement", "pm", "engineer"];
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

type DeleteDialogState = {
    isOpen: boolean;
    ids: string[];
    title: string;
    message: string;
};

function normalizeRole(value: string): UserRole {
    const role = (value || "").trim().toLowerCase();
    return allowedRoles.includes(role as UserRole) ? (role as UserRole) : "engineer";
}

export default function UsersPage() {
    const { userProfile } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
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
        const q = query(collection(db, "users"), orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const userData: UserProfile[] = [];
            snapshot.forEach((docSnap) => {
                userData.push({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
            });
            setUsers(userData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const filteredUsers = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return users;

        return users.filter((user) =>
            (user.displayName || "").toLowerCase().includes(term) ||
            (user.email || "").toLowerCase().includes(term)
        );
    }, [users, searchTerm]);

    const isAdmin = userProfile?.role === "admin" || !userProfile;

    const filteredIdSet = useMemo(() => {
        return new Set(filteredUsers.map((user) => user.uid));
    }, [filteredUsers]);

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));

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

    const paginatedUsers = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredUsers.slice(start, start + pageSize);
    }, [currentPage, filteredUsers, pageSize]);

    const currentPageIds = useMemo(() => paginatedUsers.map((user) => user.uid), [paginatedUsers]);
    const allCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id));
    const someCurrentPageSelected = currentPageIds.some((id) => selectedIds.has(id));

    useEffect(() => {
        if (!headerCheckboxRef.current) return;
        headerCheckboxRef.current.indeterminate = someCurrentPageSelected && !allCurrentPageSelected;
    }, [allCurrentPageSelected, someCurrentPageSelected]);

    const translatedRole = (role: string) => {
        switch (role) {
            case "admin": return "Administrator";
            case "procurement": return "Procurement";
            case "pm": return "Project Manager";
            case "engineer": return "Engineer";
            default: return "Staff";
        }
    };

    const roleColor = (role: string) => {
        switch (role) {
            case "admin": return "bg-purple-100 text-purple-800";
            case "pm": return "bg-blue-100 text-blue-800";
            case "procurement": return "bg-green-100 text-green-800";
            default: return "bg-slate-100 text-slate-800";
        }
    };

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
        const rows = users
            .slice()
            .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || "", "th"))
            .map((user) => ([
                user.uid,
                user.email || "",
                user.displayName || "",
                user.role,
                user.isActive,
                user.phoneNumber || "",
                user.lineUserId || "",
                user.lineProfilePic || "",
            ]));

        const date = new Date().toISOString().slice(0, 10);
        downloadCsv(
            `users_${date}.csv`,
            ["uid", "email", "display_name", "role", "is_active", "phone_number", "line_user_id", "line_profile_pic"],
            rows
        );
    };

    const handleImportCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!isAdmin) {
            alert("Only admins can import user data");
            return;
        }

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

            const uidIndex = findIndex(["uid"]);
            const emailIndex = findIndex(["email"]);
            const displayNameIndex = findIndex(["displayname", "name"]);
            const roleIndex = findIndex(["role"]);
            const activeIndex = findIndex(["isactive", "active", "status"]);
            const phoneIndex = findIndex(["phonenumber", "phone"]);
            const lineUserIdIndex = findIndex(["lineuserid", "lineid"]);
            const linePicIndex = findIndex(["lineprofilepic", "linepic"]);

            if (uidIndex < 0 && emailIndex < 0) {
                alert("CSV must include uid or email column");
                return;
            }

            const existingByUid = new Map<string, UserProfile>();
            const existingByEmail = new Map<string, UserProfile>();
            for (const item of users) {
                existingByUid.set(item.uid, item);
                if (item.email) existingByEmail.set(item.email.toLowerCase(), item);
            }

            let inserted = 0;
            let updated = 0;
            let skipped = 0;

            for (const row of dataRows) {
                const rawUid = uidIndex >= 0 ? (row[uidIndex] || "").trim() : "";
                const rawEmail = emailIndex >= 0 ? (row[emailIndex] || "").trim() : "";

                const existing =
                    (rawUid ? existingByUid.get(rawUid) : undefined) ||
                    (rawEmail ? existingByEmail.get(rawEmail.toLowerCase()) : undefined);

                const targetUid = rawUid || existing?.uid || "";
                if (!targetUid) {
                    skipped += 1;
                    continue;
                }

                const payload = {
                    email: rawEmail || existing?.email || null,
                    displayName: displayNameIndex >= 0 ? ((row[displayNameIndex] || "").trim() || existing?.displayName || null) : (existing?.displayName || null),
                    role: roleIndex >= 0 ? normalizeRole(row[roleIndex] || "") : normalizeRole(existing?.role || "engineer"),
                    isActive: activeIndex >= 0 ? parseBooleanStatus(row[activeIndex] || "") : (existing?.isActive ?? true),
                    phoneNumber: phoneIndex >= 0 ? ((row[phoneIndex] || "").trim() || existing?.phoneNumber || null) : (existing?.phoneNumber || null),
                    lineUserId: lineUserIdIndex >= 0 ? ((row[lineUserIdIndex] || "").trim() || existing?.lineUserId || null) : (existing?.lineUserId || null),
                    lineProfilePic: linePicIndex >= 0 ? ((row[linePicIndex] || "").trim() || existing?.lineProfilePic || null) : (existing?.lineProfilePic || null),
                    updatedAt: new Date().toISOString(),
                };

                if (existing) {
                    await setDoc(doc(db, "users", targetUid), payload, { merge: true });
                    updated += 1;
                } else {
                    await setDoc(doc(db, "users", targetUid), {
                        ...payload,
                        createdAt: new Date().toISOString(),
                    });
                    inserted += 1;
                }
            }

            alert(`CSV import success\nInserted: ${inserted}\nUpdated: ${updated}\nSkipped: ${skipped}`);
        } catch (error) {
            console.error("CSV import users error:", error);
            alert("CSV import failed");
        } finally {
            setImporting(false);
            event.target.value = "";
        }
    };

    const requestDeleteSingle = (user: UserProfile) => {
        if (!isAdmin) {
            alert("Only admins can delete users");
            return;
        }

        setDeleteDialog({
            isOpen: true,
            ids: [user.uid],
            title: "Delete user",
            message: `Delete user \"${user.displayName || user.email || user.uid}\"?`,
        });
    };

    const requestDeleteSelected = () => {
        if (!isAdmin) {
            alert("Only admins can delete users");
            return;
        }

        if (selectedIds.size === 0) return;
        setDeleteDialog({
            isOpen: true,
            ids: Array.from(selectedIds),
            title: "Delete selected users",
            message: `Delete ${selectedIds.size} selected users? This action cannot be undone.`,
        });
    };

    const closeDeleteDialog = () => {
        if (deletingIds.size > 0) return;
        setDeleteDialog({ isOpen: false, ids: [], title: "", message: "" });
    };

    const deleteUserByUid = async (uid: string) => {
        const res = await fetch(`/api/users/${encodeURIComponent(uid)}`, { method: "DELETE" });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.error || "Delete user failed");
        }
    };

    const confirmDelete = async () => {
        if (deleteDialog.ids.length === 0) return;
        if (!isAdmin) {
            alert("Only admins can delete users");
            return;
        }

        const idsToDelete = deleteDialog.ids;
        setDeletingIds(new Set(idsToDelete));
        try {
            await Promise.all(idsToDelete.map((uid) => deleteUserByUid(uid)));
            setSelectedIds((prev) => {
                const next = new Set(prev);
                for (const id of idsToDelete) {
                    next.delete(id);
                }
                return next;
            });
            setDeleteDialog({ isOpen: false, ids: [], title: "", message: "" });
        } catch (error) {
            console.error("Delete users error:", error);
            alert("Delete user data failed");
        } finally {
            setDeletingIds(new Set());
        }
    };

    const columnCount = 5;

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Users</h1>
                        <p className="text-sm text-slate-500 mt-1">Manage user accounts and access roles.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCsv} />
                        <button
                            type="button"
                            disabled={importing || !isAdmin}
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                            title={isAdmin ? "Import CSV" : "Admin only"}
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
                            disabled={!isAdmin || selectedIds.size === 0 || deletingIds.size > 0}
                            onClick={requestDeleteSelected}
                            className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                            title={isAdmin ? "Delete selected" : "Admin only"}
                        >
                            {deletingIds.size > 1 ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Trash2 size={16} className="mr-2" />}
                            Delete Selected ({selectedIds.size})
                        </button>
                        {isAdmin ? (
                            <Link
                                href="/users/create"
                                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
                            >
                                <Plus className="mr-2 h-5 w-5" />
                                Add User
                            </Link>
                        ) : (
                            <span
                                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm opacity-50 cursor-not-allowed"
                                title="Admin only"
                            >
                                <Plus className="mr-2 h-5 w-5" />
                                Add User
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50">
                        <div className="relative max-w-sm w-full">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by name or email"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>
                        <div className="text-sm text-slate-500">Total {filteredUsers.length} items</div>
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
                                            disabled={!isAdmin}
                                            onChange={(event) => toggleCurrentPageSelection(event.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                            aria-label="Select all rows on this page"
                                        />
                                    </th>
                                    <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Name / Email
                                    </th>
                                    <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Role
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
                                        <td colSpan={columnCount} className="px-6 py-12 text-center text-slate-500">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
                                            Loading data...
                                        </td>
                                    </tr>
                                ) : filteredUsers.length > 0 ? (
                                    paginatedUsers.map((user) => {
                                        const isRowSelected = selectedIds.has(user.uid);
                                        const isRowDeleting = deletingIds.has(user.uid);

                                        return (
                                            <tr key={user.uid} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-4 align-top">
                                                    <input
                                                        type="checkbox"
                                                        checked={isRowSelected}
                                                        disabled={!isAdmin}
                                                        onChange={(event) => toggleSingleSelection(user.uid, event.target.checked)}
                                                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                                        aria-label={`Select user ${user.displayName || user.uid}`}
                                                    />
                                                </td>
                                                <td className="px-4 md:px-6 py-4">
                                                    <div className="flex items-center">
                                                        <div className="flex-shrink-0 h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                                                            <UserCircle className="h-6 w-6" />
                                                        </div>
                                                        <div className="ml-3">
                                                            <div className="text-sm font-medium text-slate-900">{user.displayName || "No display name"}</div>
                                                            <div className="text-sm text-slate-500">{user.email || "-"}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-md ${roleColor(user.role)}`}>
                                                        {translatedRole(user.role)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {user.isActive ? (
                                                        <span className="inline-flex items-center text-sm text-green-600 font-medium">
                                                            <UserCheck className="w-4 h-4 mr-1" />
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center text-sm text-red-600 font-medium">
                                                            <UserX className="w-4 h-4 mr-1" />
                                                            Inactive
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    {isAdmin ? (
                                                        <div className="inline-flex items-center gap-2">
                                                            <Link
                                                                href={`/users/${user.uid}`}
                                                                title="Edit"
                                                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </Link>
                                                            <button
                                                                type="button"
                                                                title="Delete"
                                                                disabled={deletingIds.size > 0}
                                                                onClick={() => requestDeleteSingle(user)}
                                                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
                                                            >
                                                                {isRowDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">Admin only</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={columnCount} className="px-6 py-12 text-center text-slate-500">
                                            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                            No users found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="border-t border-slate-200 bg-slate-50/40">
                        <PaginationControls
                            page={currentPage}
                            pageSize={pageSize}
                            totalItems={filteredUsers.length}
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
