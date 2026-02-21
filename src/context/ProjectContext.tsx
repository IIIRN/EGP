"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Project } from "@/types/project";
import { useAuth } from "./AuthContext";

interface ProjectContextType {
    projects: Project[];
    allProjects: Project[];
    currentProject: Project | null;
    setCurrentProject: (project: Project | null) => void;
    loading: boolean;
}

const ProjectContext = createContext<ProjectContextType>({
    projects: [],
    allProjects: [],
    currentProject: null,
    setCurrentProject: () => { },
    loading: true,
});

export const useProject = () => useContext(ProjectContext);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [allProjects, setAllProjects] = useState<Project[]>([]);
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setProjects([]);
            setAllProjects([]);
            setCurrentProject(null);
            setLoading(false);
            return;
        }

        // In a real app, you might filter by user's authorized projects. 
        // Here we load all projects and order them.
        const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let projectData: Project[] = [];
            snapshot.forEach((doc) => {
                projectData.push({ id: doc.id, ...doc.data() } as Project);
            });

            setAllProjects(projectData);

            // Hide completed projects for the active selector
            const activeProjects = projectData.filter(p => p.status !== "completed");

            setProjects(activeProjects);

            // Auto-select the first project if no project is currently selected
            if (activeProjects.length > 0) {
                setCurrentProject((prev) => {
                    if (!prev) return activeProjects[0];
                    const exists = activeProjects.find(p => p.id === prev.id);
                    return exists || activeProjects[0];
                });
            } else {
                setCurrentProject(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    return (
        <ProjectContext.Provider value={{ projects, allProjects, currentProject, setCurrentProject, loading }}>
            {children}
        </ProjectContext.Provider>
    );
}
