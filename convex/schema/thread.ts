import { v } from "convex/values"
import { AIMessage } from "./message"

export const Thread = v.object({
    authorId: v.string(),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    streamStartedAt: v.optional(v.number()),
    isLive: v.optional(v.boolean()),
    currentStreamId: v.optional(v.string()),
    pinned: v.optional(v.boolean()),
    projectId: v.optional(v.id("projects")),
    personaSource: v.optional(v.union(v.literal("builtin"), v.literal("user"))),
    personaSourceId: v.optional(v.string()),
    personaName: v.optional(v.string()),
    personaAvatarKind: v.optional(v.union(v.literal("builtin"), v.literal("r2"))),
    personaAvatarValue: v.optional(v.string()),
    personaAvatarMimeType: v.optional(v.string())
})

export const SharedThread = v.object({
    originalThreadId: v.id("threads"),
    authorId: v.string(),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    messages: v.array(AIMessage),
    includeAttachments: v.boolean()
})
