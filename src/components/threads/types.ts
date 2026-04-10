import type { Id } from "@/convex/_generated/dataModel"

export interface Thread {
    _id: Id<"threads">
    title: string
    createdAt: number
    updatedAt: number
    authorId: string
    pinned?: boolean
    projectId?: Id<"projects">
    personaSource?: "builtin" | "user"
    personaSourceId?: string
    personaName?: string
    personaAvatarKind?: "builtin" | "r2"
    personaAvatarValue?: string
    personaAvatarMimeType?: string
}

export interface Project {
    _id: Id<"projects">
    name: string
    description?: string
    color?: string
    icon?: string
}

export interface SidebarProject extends Project {
    threadCount: number
}
