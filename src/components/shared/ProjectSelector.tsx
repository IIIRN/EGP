"use client";

import React, { useState, useRef, useEffect } from "react";
import { useProject } from "@/context/ProjectContext";
import { BuildingIcon, ChevronDown, Check } from "lucide-react";
import { clsx } from "clsx";

export default function ProjectSelector() {
    const { projects, currentProject, setCurrentProject, loading } = useProject();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (loading) {
        return <div className="animate-pulse w-48 h-10 bg-slate-200 rounded-lg"></div>;
    }

    if (projects.length === 0) {
        return (
            <div className="flex items-center space-x-2 text-slate-500 bg-slate-100 px-4 py-2 rounded-lg border border-slate-200">
                <BuildingIcon size={18} />
                <span className="text-sm font-medium">ไม่มีโครงการ</span>
            </div>
        );
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-80 px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="bg-blue-100 p-1.5 rounded-md">
                        <BuildingIcon size={16} className="text-blue-600" />
                    </div>
                    <div className="flex flex-col items-start truncate text-left">
                        <span className="text-xs text-slate-500 font-medium tracking-wide uppercase">
                            โครงการปัจจุบัน
                        </span>
                        <span className="text-sm font-semibold text-slate-900 truncate w-32">
                            {currentProject?.name || "เลือกโครงการ"}
                        </span>
                    </div>
                </div>
                <ChevronDown size={18} className="text-slate-400" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                    <ul className="max-h-60 overflow-y-auto py-1">
                        {projects.map((project) => (
                            <li key={project.id}>
                                <button
                                    onClick={() => {
                                        setCurrentProject(project);
                                        setIsOpen(false);
                                    }}
                                    className={clsx(
                                        "w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors",
                                        currentProject?.id === project.id ? "bg-blue-50/50" : ""
                                    )}
                                >
                                    <div className="flex flex-col">
                                        <span className={clsx(
                                            "font-medium",
                                            currentProject?.id === project.id ? "text-blue-700" : "text-slate-700"
                                        )}>
                                            {project.name}
                                        </span>
                                        <span className="text-xs text-slate-500">{project.code}</span>
                                    </div>
                                    {currentProject?.id === project.id && (
                                        <Check size={16} className="text-blue-600" />
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
