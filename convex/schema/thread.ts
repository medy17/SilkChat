import { OpeningToolSelection } from "./tool_selection"
import { v } from "convex/values"
import { AIMessage } from "./message"
import { VerbosityLevel } from "./settings"

// Auto verbosity is decided once from the opening request and reused for the thread.
export const OpeningVerbosity = v.object({
    level: VerbosityLevel,
    status: v.union(v.literal("complete"), v.literal("failed"))
})

export const RoleplayPortraits = v.array(
    v.object({
        characterId: v.string(),
        storageKey: v.string(),
        generatedImageId: v.optional(v.string())
    })
)

export const Thread = v.object({
    authorId: v.string(),
    title: v.string(),
    openingToolSelection: v.optional(OpeningToolSelection),
    openingVerbosity: v.optional(OpeningVerbosity),
    createdAt: v.number(),
    updatedAt: v.number(),
    streamStartedAt: v.optional(v.number()),
    isLive: v.optional(v.boolean()),
    currentStreamId: v.optional(v.string()),
    lastStreamId: v.optional(v.string()),
    currentStreamOwnerClientId: v.optional(v.string()),
    pinned: v.optional(v.boolean()),
    projectId: v.optional(v.id("projects")),
    isBranched: v.optional(v.boolean()),
    branchedFromThreadId: v.optional(v.id("threads")),
    branchedFromMessageId: v.optional(v.string()),
    personaSource: v.optional(v.union(v.literal("builtin"), v.literal("user"))),
    personaSourceId: v.optional(v.string()),
    personaName: v.optional(v.string()),
    personaAvatarKind: v.optional(v.union(v.literal("builtin"), v.literal("r2"))),
    personaAvatarValue: v.optional(v.string()),
    personaAvatarMimeType: v.optional(v.string()),
    // Supporting-character portraits for roleplay scenes, keyed by markup character ID.
    roleplayPortraits: v.optional(RoleplayPortraits)
})

export const SharedThread = v.object({
    originalThreadId: v.id("threads"),
    authorId: v.string(),
    title: v.string(),
    shareQuestion: v.optional(v.string()),
    sharerName: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    messages: v.array(AIMessage),
    includeAttachments: v.boolean(),
    roleplayPortraits: v.optional(RoleplayPortraits)
})
