import { v } from "convex/values"

export const SkillFile = v.object({
    path: v.string(),
    sizeBytes: v.number(),
    text: v.boolean()
})

export const SkillSource = v.union(
    v.object({
        kind: v.literal("github"),
        repo: v.string(),
        // The skill's folder in the repository; "" when the repository is the skill.
        path: v.string(),
        // The branch or tag the link named. Updates follow it; without one they follow the
        // repository's default branch.
        ref: v.optional(v.string()),
        commit: v.optional(v.string()),
        // Found through the store rather than typed in.
        fromStore: v.optional(v.boolean())
    }),
    v.object({ kind: v.literal("upload"), fileName: v.optional(v.string()) })
)

// One installed copy of a skill's folder. Never edited: an update adds a version, and chats
// that started on an older one keep reading it.
export const SkillVersion = v.object({
    userId: v.string(),
    slug: v.string(),
    hash: v.string(),
    description: v.string(),
    // SKILL.md without its frontmatter. The other files are in R2.
    instructions: v.string(),
    instructionTokens: v.number(),
    files: v.array(SkillFile),
    runsCode: v.boolean(),
    sizeBytes: v.number(),
    source: SkillSource,
    createdAt: v.number()
})

// A skill in someone's library. There is one per name.
export const Skill = v.object({
    userId: v.string(),
    slug: v.string(),
    currentVersionId: v.id("skillVersions"),
    // On in new chats.
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number()
})

// The skills a chat started with. Fixed for the life of the chat.
export const ThreadSkill = v.object({
    threadId: v.id("threads"),
    userId: v.string(),
    slug: v.string(),
    versionId: v.id("skillVersions")
})
