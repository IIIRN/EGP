export interface Project {
    id: string;
    name: string;
    code: string;
    location?: string;
    budget?: number;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    status: "planning" | "in_progress" | "completed" | "on_hold";
    createdAt?: string;
    updatedAt?: string;
}
