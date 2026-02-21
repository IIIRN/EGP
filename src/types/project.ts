export interface Project {
    id: string;
    name: string;
    projectNo?: string;
    code: string;
    location?: string;
    budget?: number;
    status: "planning" | "in_progress" | "completed" | "on_hold";
    createdAt?: string;
    updatedAt?: string;
}
