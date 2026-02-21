"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Project } from "@/types/project";
import { useAuth } from "./AuthContext";

interface ProjectContextType {
    projects: Project[];
    currentProject: Project | null;
    setCurrentProject: (project: Project | null) => void;
    loading: boolean;
}

const ProjectContext = createContext<ProjectContextType>({
    projects: [],
    currentProject: null,
    setCurrentProject: () => { },
    loading: true,
});

export const useProject = () => useContext(ProjectContext);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setProjects([]);
            setCurrentProject(null);
            setLoading(false);
            return;
        }

        // In a real app, you might filter by user's authorized projects. 
        // Here we load all projects and order them.
        const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const projectData: Project[] = [];
            snapshot.forEach((doc) => {
                projectData.push({ id: doc.id, ...doc.data() } as Project);
            });

            setProjects(projectData);

            // Auto-select the first project if no project is currently selected
            if (projectData.length > 0) {
                setCurrentProject((prev) => {
                    if (!prev) return projectData[0];
                    const exists = projectData.find(p => p.id === prev.id);
                    return exists || projectData[0];
                });
            } else {
                setCurrentProject(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    return (
        <ProjectContext.Provider value={{ projects, currentProject, setCurrentProject, loading }}>
            {children}
        </ProjectContext.Provider>
    );
}
