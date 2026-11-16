import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { MAX_SKILLS_PER_CHAT, getSkillFileKey } from "./skill_bundle"

/** One of a chat's skills, as the chat route needs it. */
export type ChatSkill = {
    versionId: Id<"skillVersions">
    slug: string
    description: string
    instructions: string
    files: Doc<"skillVersions">["files"]
    runsCode: boolean
    // Where its files are stored. Never shown to the model.
    userId: string
    hash: string
}

export const toChatSkill = (version: Doc<"skillVersions">): ChatSkill => ({
    versionId: version._id,
    slug: version.slug,
    description: version.description,
    instructions: version.instructions,
    files: version.files,
    runsCode: version.runsCode,
    userId: version.userId,
    hash: version.hash
})

export const getChatSkillFileKey = (skill: ChatSkill, path: string) =>
    getSkillFileKey(skill.userId, skill.slug, skill.hash, path)

/** The skills a chat started with. A skill removed since then is simply gone. */
export const readThreadSkills = async (ctx: QueryCtx, threadId: Id<"threads">) => {
    const rows = await ctx.db
        .query("threadSkills")
        .withIndex("byThread", (q) => q.eq("threadId", threadId))
        .collect()
    const versions = await Promise.all(rows.map((row) => ctx.db.get(row.versionId)))
    return versions
        .filter((version): version is Doc<"skillVersions"> => version !== null)
        .map(toChatSkill)
        .sort((a, b) => a.slug.localeCompare(b.slug))
}

/**
 * The skills a new chat would start with: the ones picked for it, or with no pick, the ones
 * switched on for new chats.
 */
export const resolveNewThreadSkills = async (ctx: QueryCtx, userId: string, slugs?: string[]) => {
    const library = await ctx.db
        .query("skills")
        .withIndex("byUserSlug", (q) => q.eq("userId", userId))
        .collect()
    const picked = slugs ? new Set(slugs) : null
    const chosen = library
        .filter((skill) => (picked ? picked.has(skill.slug) : skill.enabled))
        .slice(0, MAX_SKILLS_PER_CHAT)
    const versions = await Promise.all(chosen.map((skill) => ctx.db.get(skill.currentVersionId)))
    return versions
        .filter((version): version is Doc<"skillVersions"> => version !== null)
        .map(toChatSkill)
}

/** Fixes a new chat's skills. Versions that aren't the author's are dropped. */
export const snapshotThreadSkills = async (
    ctx: MutationCtx,
    {
        threadId,
        userId,
        versionIds
    }: { threadId: Id<"threads">; userId: string; versionIds: Id<"skillVersions">[] }
) => {
    const seen = new Set<string>()
    for (const versionId of versionIds.slice(0, MAX_SKILLS_PER_CHAT)) {
        const version = await ctx.db.get(versionId)
        if (!version || version.userId !== userId || seen.has(version.slug)) continue
        seen.add(version.slug)
        await ctx.db.insert("threadSkills", { threadId, userId, slug: version.slug, versionId })
    }
}
