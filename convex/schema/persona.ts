import { v } from "convex/values"

export const PersonaAvatarKind = v.union(v.literal("builtin"), v.literal("r2"))
export const PersonaSource = v.union(v.literal("builtin"), v.literal("user"))

export const PersonaKnowledgeDoc = v.object({
    key: v.string(),
    fileName: v.string(),
    mimeType: v.union(v.literal("text/markdown"), v.literal("text/plain")),
    sizeBytes: v.number(),
    tokenCount: v.number()
})

export const UserPersona = v.object({
    authorId: v.string(),
    name: v.string(),
    shortName: v.optional(v.string()),
    description: v.string(),
    instructions: v.string(),
    conversationStarters: v.array(v.string()),
    defaultModelId: v.string(),
    avatarKey: v.optional(v.string()),
    avatarMimeType: v.optional(
        v.union(
            v.literal("image/avif"),
            v.literal("image/webp"),
            v.literal("image/jpeg"),
            v.literal("image/png")
        )
    ),
    avatarSizeBytes: v.optional(v.number()),
    knowledgeDocs: v.array(PersonaKnowledgeDoc),
    promptTokenEstimate: v.number(),
    createdAt: v.number(),
    updatedAt: v.number()
})

export const ThreadPersonaSnapshot = v.object({
    threadId: v.id("threads"),
    source: PersonaSource,
    sourceId: v.string(),
    name: v.string(),
    shortName: v.optional(v.string()),
    description: v.string(),
    instructions: v.string(),
    defaultModelId: v.string(),
    conversationStarters: v.array(v.string()),
    avatarKind: v.optional(PersonaAvatarKind),
    avatarValue: v.optional(v.string()),
    avatarMimeType: v.optional(v.string()),
    knowledgeDocs: v.array(
        v.object({
            fileName: v.string(),
            tokenCount: v.number()
        })
    ),
    compiledPrompt: v.string(),
    promptTokenEstimate: v.number(),
    createdAt: v.number()
})
