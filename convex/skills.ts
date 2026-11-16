import { type Infer, ConvexError, v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import {
    type MutationCtx,
    type QueryCtx,
    internalMutation,
    internalQuery,
    mutation,
    query
} from "./_generated/server"
import { assertAccountNotDeleting } from "./lib/account_deletion_status"
import { getUserIdentity } from "./lib/identity"
import { MAX_INSTALLED_SKILLS, getSkillFileKey } from "./lib/skill_bundle"
import { readThreadSkills } from "./lib/thread_skills"
import { SkillFile, SkillSource } from "./schema/skill"

const THREAD_SKILL_BATCH = 1000
const FILE_DELETE_BATCH = 100

const requireUserId = async (ctx: QueryCtx | MutationCtx) => {
    const user = await getUserIdentity(ctx.auth, { allowAnons: false })
    if ("error" in user) throw new ConvexError("Unauthorized")
    return user.id
}

const requireOwnSkill = async (ctx: QueryCtx | MutationCtx, skillId: Id<"skills">) => {
    const userId = await requireUserId(ctx)
    const skill = await ctx.db.get(skillId)
    if (!skill || skill.userId !== userId) throw new ConvexError("Skill not found")
    return skill
}

const isSameSource = (a: Infer<typeof SkillSource>, b: Infer<typeof SkillSource>) => {
    if (a.kind === "upload" || b.kind === "upload") return a.kind === b.kind
    return a.repo.toLowerCase() === b.repo.toLowerCase() && a.path === b.path
}

const scheduleFileDeletion = async (ctx: MutationCtx, version: Doc<"skillVersions">) => {
    const keys = version.files.map((file) =>
        getSkillFileKey(version.userId, version.slug, version.hash, file.path)
    )
    for (let start = 0; start < keys.length; start += FILE_DELETE_BATCH) {
        await ctx.scheduler.runAfter(0, internal.skills_install.deleteStoredFiles, {
            keys: keys.slice(start, start + FILE_DELETE_BATCH)
        })
    }
}

// An old version goes once it is neither the skill's current one nor any chat's.
const deleteVersionIfUnused = async (ctx: MutationCtx, versionId: Id<"skillVersions">) => {
    const version = await ctx.db.get(versionId)
    if (!version) return
    const skill = await ctx.db
        .query("skills")
        .withIndex("byUserSlug", (q) => q.eq("userId", version.userId).eq("slug", version.slug))
        .first()
    if (skill?.currentVersionId === versionId) return
    const reference = await ctx.db
        .query("threadSkills")
        .withIndex("byVersion", (q) => q.eq("versionId", versionId))
        .first()
    if (reference) return
    await ctx.db.delete(versionId)
    await scheduleFileDeletion(ctx, version)
}

export const listMySkills = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return []
        const skills = await ctx.db
            .query("skills")
            .withIndex("byUserSlug", (q) => q.eq("userId", user.id))
            .collect()
        const rows = await Promise.all(
            skills.map(async (skill) => {
                const version = await ctx.db.get(skill.currentVersionId)
                if (!version) return null
                return {
                    _id: skill._id,
                    slug: skill.slug,
                    enabled: skill.enabled,
                    createdAt: skill.createdAt,
                    updatedAt: skill.updatedAt,
                    description: version.description,
                    files: version.files,
                    runsCode: version.runsCode,
                    source: version.source
                }
            })
        )
        return rows
            .filter((row): row is NonNullable<typeof row> => row !== null)
            .sort((a, b) => a.createdAt - b.createdAt)
    }
})

// Fetched when a skill's instructions are opened, so the list stays light.
export const getMySkillInstructions = query({
    args: { skillId: v.id("skills") },
    handler: async (ctx, { skillId }) => {
        const skill = await requireOwnSkill(ctx, skillId)
        return (await ctx.db.get(skill.currentVersionId))?.instructions ?? ""
    }
})

/** The skills a chat started with, for the flyout once the chat is under way. */
export const listThreadSkills = query({
    args: { threadId: v.id("threads") },
    handler: async (ctx, { threadId }) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return []
        const thread = await ctx.db.get(threadId)
        if (!thread || thread.authorId !== user.id) return []
        return (await readThreadSkills(ctx, threadId)).map((skill) => skill.slug)
    }
})

export const setMySkillEnabled = mutation({
    args: { skillId: v.id("skills"), enabled: v.boolean() },
    handler: async (ctx, { skillId, enabled }) => {
        const skill = await requireOwnSkill(ctx, skillId)
        await ctx.db.patch(skill._id, { enabled, updatedAt: Date.now() })
    }
})

// Removal is total: every stored version goes, and chats that had the skill lose it.
export const removeMySkill = mutation({
    args: { skillId: v.id("skills") },
    handler: async (ctx, { skillId }) => {
        const skill = await requireOwnSkill(ctx, skillId)
        await ctx.db.delete(skill._id)
        const versions = await ctx.db
            .query("skillVersions")
            .withIndex("byUserSlugHash", (q) => q.eq("userId", skill.userId).eq("slug", skill.slug))
            .collect()
        for (const version of versions) {
            await ctx.db.delete(version._id)
            await scheduleFileDeletion(ctx, version)
        }
        // Chats stop seeing the skill as soon as its versions are gone. Their links are tidied
        // up afterwards, since a long-used skill can have thousands.
        await ctx.scheduler.runAfter(0, internal.skills.purgeThreadSkillLinks, {
            userId: skill.userId,
            versionIds: versions.map((version) => version._id)
        })
    }
})

export const purgeThreadSkillLinks = internalMutation({
    args: { userId: v.string(), versionIds: v.array(v.id("skillVersions")) },
    handler: async (ctx, { userId, versionIds }) => {
        let remaining = THREAD_SKILL_BATCH
        for (const versionId of versionIds) {
            const links = await ctx.db
                .query("threadSkills")
                .withIndex("byVersion", (q) => q.eq("versionId", versionId))
                .take(remaining)
            for (const link of links) await ctx.db.delete(link._id)
            remaining -= links.length
            if (remaining <= 0) {
                await ctx.scheduler.runAfter(0, internal.skills.purgeThreadSkillLinks, {
                    userId,
                    versionIds
                })
                return
            }
        }
    }
})

export const getInstallState = internalQuery({
    args: { userId: v.string(), slug: v.string(), hash: v.string(), source: SkillSource },
    handler: async (ctx, { userId, slug, hash, source }) => {
        const library = await ctx.db
            .query("skills")
            .withIndex("byUserSlug", (q) => q.eq("userId", userId))
            .collect()
        const skill = library.find((candidate) => candidate.slug === slug)
        const current = skill ? await ctx.db.get(skill.currentVersionId) : null
        const stored = await ctx.db
            .query("skillVersions")
            .withIndex("byUserSlugHash", (q) =>
                q.eq("userId", userId).eq("slug", slug).eq("hash", hash)
            )
            .first()
        return {
            installed: Boolean(skill),
            sameSource: current ? isSameSource(current.source, source) : true,
            upToDate: current?.hash === hash,
            versionStored: Boolean(stored),
            libraryFull: !skill && library.length >= MAX_INSTALLED_SKILLS
        }
    }
})

// Called once a version's files are in storage. Adds the version, points the skill at it,
// and drops the one it replaces unless a chat still reads it.
export const commitInstall = internalMutation({
    args: {
        userId: v.string(),
        slug: v.string(),
        hash: v.string(),
        description: v.string(),
        instructions: v.string(),
        instructionTokens: v.number(),
        files: v.array(SkillFile),
        runsCode: v.boolean(),
        sizeBytes: v.number(),
        source: SkillSource
    },
    handler: async (ctx, { userId, slug, hash, ...details }) => {
        await assertAccountNotDeleting(ctx, userId)
        const now = Date.now()
        const stored = await ctx.db
            .query("skillVersions")
            .withIndex("byUserSlugHash", (q) =>
                q.eq("userId", userId).eq("slug", slug).eq("hash", hash)
            )
            .first()
        const versionId =
            stored?._id ??
            (await ctx.db.insert("skillVersions", {
                userId,
                slug,
                hash,
                ...details,
                createdAt: now
            }))

        const skill = await ctx.db
            .query("skills")
            .withIndex("byUserSlug", (q) => q.eq("userId", userId).eq("slug", slug))
            .first()
        // The install checked these before uploading. Another install may have finished since.
        if (skill) {
            const current = await ctx.db.get(skill.currentVersionId)
            if (current && !isSameSource(current.source, details.source)) {
                throw new ConvexError(
                    `You already have a skill named "${slug}" from somewhere else. Remove it first.`
                )
            }
        } else {
            const library = await ctx.db
                .query("skills")
                .withIndex("byUserSlug", (q) => q.eq("userId", userId))
                .collect()
            if (library.length >= MAX_INSTALLED_SKILLS) {
                throw new ConvexError("Your skill library is full. Remove one first.")
            }
        }
        if (!skill) {
            await ctx.db.insert("skills", {
                userId,
                slug,
                currentVersionId: versionId,
                enabled: true,
                createdAt: now,
                updatedAt: now
            })
            return
        }
        if (skill.currentVersionId === versionId) return
        const replaced = skill.currentVersionId
        await ctx.db.patch(skill._id, { currentVersionId: versionId, updatedAt: now })
        await deleteVersionIfUnused(ctx, replaced)
    }
})

// Thread deletion leaves its skill links behind on purpose. This walks them, drops the ones
// whose chat is gone, and frees any old version nothing reads any more.
export const sweepThreadSkills = internalMutation({
    args: { cursor: v.optional(v.string()) },
    handler: async (ctx, { cursor }) => {
        const page = await ctx.db
            .query("threadSkills")
            .paginate({ cursor: cursor ?? null, numItems: 500 })
        const freed = new Set<Id<"skillVersions">>()
        for (const link of page.page) {
            if (await ctx.db.get(link.threadId)) continue
            await ctx.db.delete(link._id)
            freed.add(link.versionId)
        }
        for (const versionId of freed) await deleteVersionIfUnused(ctx, versionId)
        if (!page.isDone) {
            await ctx.scheduler.runAfter(0, internal.skills.sweepThreadSkills, {
                cursor: page.continueCursor
            })
        }
    }
})
