"use client";

import { useProject } from "@/context/ProjectContext";
import { Building2, Plus, Search, Loader2 } from "lucide-react";
import Link from "next/link";

export default function ProjectsPage() {
    const { projects, loading } = useProject();

    const translatedStatus = (status: string) => {
        switch (status) {
            case "planning": return "กำลังวางแผน";
            case "in_progress": return "กำลังดำเนินการ";
            case "completed": return "เสร็จสิ้น";
            case "on_hold": return "ระงับชั่วคราว";
            default: return status;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">โครงการก่อสร้าง</h1>
                    <p className="text-sm text-slate-500 mt-1">จัดการและดูข้อมูลโครงการก่อสร้างทั้งหมด</p>
                </div>
                <Link
                    href="/projects/create"
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
                >
                    <Plus size={18} className="mr-2" />
                    สร้างโครงการใหม่
                </Link>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                    <div className="relative max-w-sm w-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อโครงการ หรือรหัส..."
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    รายละเอียดโครงการ
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    รหัสโครงการ
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    งบประมาณ
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    สถานะ
                                </th>
                                <th scope="col" className="relative px-6 py-3">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                        กำลังโหลดข้อมูลโครงการ...
                                    </td>
                                </tr>
                            ) : projects.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center flex-col items-center">
                                        <Building2 className="mx-auto h-12 w-12 text-slate-300" />
                                        <h3 className="mt-2 text-sm font-semibold text-slate-900">ไม่มีโครงการ</h3>
                                        <p className="mt-1 text-sm text-slate-500">เริ่มต้นใช้งานโดยการสร้างโครงการก่อสร้างใหม่</p>
                                    </td>
                                </tr>
                            ) : (
                                projects.map((project) => (
                                    <tr key={project.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-slate-900">{project.name}</div>
                                            <div className="text-sm text-slate-500">{project.location || "ไม่ได้ระบุสถานที่"}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                                            {project.code}
                                            {project.projectNo && (
                                                <div className="text-xs text-slate-400 mt-0.5">No: {project.projectNo}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                                            {project.budget ? `฿${project.budget.toLocaleString()}` : "ไม่ได้กำหนด"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${project.status === 'planning' ? 'bg-yellow-100 text-yellow-800' :
                                                project.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                                    project.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                        'bg-slate-100 text-slate-800'
                                                }`}>
                                                {translatedStatus(project.status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <Link href={`/projects/${project.id}`} className="text-blue-600 hover:text-blue-900">แก้ไข</Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
