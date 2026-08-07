import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { internalMutation, internalQuery, query } from "./_generated/server"
import { assertAccountNotDeleting } from "./lib/account_deletion_status"
import { getUserIdentity } from "./lib/identity"

export const ACCOUNT_EXPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000
export const ACCOUNT_EXPORT_STALE_JOB_MS = 30 * 60 * 1000
export const ACCOUNT_EXPORT_EMAIL_RETRY_BASE_MS = 5 * 60 * 1000
export const ACCOUNT_EXPORT_EMAIL_MAX_RETRIES = 3

export type AccountExportReservation =
    | { accepted: false; nextRequestAt: number }
    | { accepted: true; jobId: Id<"accountExportJobs">; nextRequestAt: number }

export const getAccountExportEmailRetryDelayMs = (failedAttempt: number) =>
    ACCOUNT_EXPORT_EMAIL_RETRY_BASE_MS * 2 ** failedAttempt

const getNextAccountExportRequestAt = (
    job: { status: string; createdAt: number; updatedAt: number },
    now: number
) => {
    if (job.status === "uploaded" || job.status === "delivered") {
        return job.createdAt + ACCOUNT_EXPORT_COOLDOWN_MS
    }
    if (job.status === "failed") {
        return job.createdAt + ACCOUNT_EXPORT_COOLDOWN_MS
    }
    if (job.status === "reserved" || job.status === "building") {
        const staleAt = job.updatedAt + ACCOUNT_EXPORT_STALE_JOB_MS
        return staleAt > now ? staleAt : now
    }
    return now
}

export const getAccountExportConfiguration = () => {
    const missing: string[] = []
    const required = [
        "RESEND_API_KEY",
        "R2_BUCKET",
        "R2_FORCE_PATH_STYLE",
        "R2_ENDPOINT",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_PUBLIC_BASE_URL",
        "ENCRYPTION_KEY",
        "TURNSTILE_SITE_KEY",
        "TURNSTILE_SECRET_KEY"
    ] as const

    for (const name of required) {
        if (!process.env[name]?.trim()) missing.push(name)
    }
    if ((process.env.EMAIL_PROVIDER || "resend") !== "resend") {
        missing.push("EMAIL_PROVIDER=resend")
    }
    return { configured: missing.length === 0, missing }
}

export const getAccountExportAvailability = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return { configured: false }
        const configuration = getAccountExportConfiguration()
        return {
            configured: configuration.configured,
            siteKey: configuration.configured ? process.env.TURNSTILE_SITE_KEY : undefined
        }
    }
})

export const getMyLatestAccountExport = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return null
        const job = await ctx.db
            .query("accountExportJobs")
            .withIndex("byUserCreatedAt", (q) => q.eq("userId", user.id))
            .order("desc")
            .first()
        if (!job) return null
        const now = Date.now()
        return {
            status: job.status,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            deliveredAt: job.deliveredAt,
            nextRequestAt: getNextAccountExportRequestAt(job, now),
            error: job.error
        }
    }
})

export const reserveAccountExport = internalMutation({
    args: {
        userId: v.string(),
        authId: v.string(),
        email: v.string(),
        keyHash: v.string(),
        encryptedPassword: v.string(),
        consentSensitiveDataLinksAccepted: v.boolean(),
        consentOneTimePasswordAccepted: v.boolean()
    },
    handler: async (ctx, args): Promise<AccountExportReservation> => {
        const { userId, email: rawEmail, keyHash } = args
        await assertAccountNotDeleting(ctx, userId)
        if (!args.consentSensitiveDataLinksAccepted || !args.consentOneTimePasswordAccepted) {
            throw new Error("Both export acknowledgements are required")
        }
        const email = rawEmail.trim()
        if (!email) throw new Error("Your account does not have a delivery email address")
        if (!/^[a-f0-9]{64}$/.test(keyHash)) throw new Error("Invalid export key fingerprint")

        const now = Date.now()
        const latest = await ctx.db
            .query("accountExportJobs")
            .withIndex("byUserCreatedAt", (q) => q.eq("userId", userId))
            .order("desc")
            .first()
        const nextRequestAt = latest ? getNextAccountExportRequestAt(latest, now) : now
        if (nextRequestAt > now) {
            return {
                accepted: false as const,
                nextRequestAt
            }
        }

        const jobId = await ctx.db.insert("accountExportJobs", {
            userId,
            email,
            keyHash,
            consentSensitiveDataLinksAccepted: true,
            consentOneTimePasswordAccepted: true,
            consentAcceptedAt: now,
            status: "reserved",
            createdAt: now,
            updatedAt: now
        })
        await ctx.scheduler.runAfter(0, internal.account_exports_node.buildAccountExport, {
            jobId,
            userId,
            authId: args.authId,
            encryptedPassword: args.encryptedPassword
        })
        return {
            accepted: true as const,
            jobId,
            nextRequestAt: now + ACCOUNT_EXPORT_COOLDOWN_MS
        }
    }
})

export const claimAccountExportBuild = internalMutation({
    args: { jobId: v.id("accountExportJobs"), userId: v.string() },
    handler: async (ctx, { jobId, userId }) => {
        await assertAccountNotDeleting(ctx, userId)
        const job = await ctx.db.get(jobId)
        if (!job || job.userId !== userId || job.status !== "reserved") return null
        const objectKey = `account-exports/${userId}/${jobId}.zip`
        await ctx.db.patch(jobId, { status: "building", objectKey, updatedAt: Date.now() })
        return { objectKey, email: job.email }
    }
})

export const completeAccountExportBuild = internalMutation({
    args: {
        jobId: v.id("accountExportJobs"),
        userId: v.string(),
        objectKey: v.string(),
        downloadUrl: v.string(),
        sizeBytes: v.number()
    },
    handler: async (ctx, args) => {
        const job = await ctx.db.get(args.jobId)
        if (
            !job ||
            job.userId !== args.userId ||
            job.status !== "building" ||
            job.objectKey !== args.objectKey
        )
            return false

        await ctx.db.patch(args.jobId, {
            status: "uploaded",
            downloadUrl: args.downloadUrl,
            sizeBytes: args.sizeBytes,
            updatedAt: Date.now()
        })
        await ctx.scheduler.runAfter(0, internal.account_exports_node.deliverAccountExportEmail, {
            jobId: args.jobId,
            attempt: 0
        })
        return true
    }
})

export const listAccountExportThreads = internalQuery({
    args: {
        userId: v.string(),
        paginationOpts: paginationOptsValidator
    },
    handler: async (ctx, { userId, paginationOpts }) =>
        await ctx.db
            .query("threads")
            .withIndex("byAuthorUpdatedAt", (q) => q.eq("authorId", userId))
            .order("desc")
            .paginate(paginationOpts)
})

export const getAccountExportThreadData = internalQuery({
    args: {
        userId: v.string(),
        threadId: v.id("threads")
    },
    handler: async (ctx, { userId, threadId }) => {
        const thread = await ctx.db.get(threadId)
        if (!thread || thread.authorId !== userId) return null

        const [messages, personaSnapshot] = await Promise.all([
            ctx.db
                .query("messages")
                .withIndex("byThreadId", (q) => q.eq("threadId", threadId))
                .collect(),
            ctx.db
                .query("threadPersonaSnapshots")
                .withIndex("byThreadId", (q) => q.eq("threadId", threadId))
                .first()
        ])
        return { messages, personaSnapshot }
    }
})

export const getAccountExportCollections = internalQuery({
    args: { userId: v.string() },
    handler: async (ctx, { userId }) => {
        const [personas, projects] = await Promise.all([
            ctx.db
                .query("userPersonas")
                .withIndex("byAuthorUpdatedAt", (q) => q.eq("authorId", userId))
                .order("desc")
                .collect(),
            ctx.db
                .query("projects")
                .withIndex("byAuthor", (q) => q.eq("authorId", userId))
                .order("desc")
                .collect()
        ])
        return { personas, projects }
    }
})

export const failAccountExport = internalMutation({
    args: {
        jobId: v.id("accountExportJobs"),
        error: v.string(),
        deliveryAttempts: v.optional(v.number())
    },
    handler: async (ctx, { jobId, error, deliveryAttempts }) => {
        const job = await ctx.db.get(jobId)
        if (!job || job.status === "delivered") return
        await ctx.db.patch(jobId, {
            status: "failed",
            error: error.slice(0, 500),
            ...(deliveryAttempts !== undefined ? { deliveryAttempts } : {}),
            updatedAt: Date.now()
        })
    }
})

export const getAccountExportForDelivery = internalMutation({
    args: { jobId: v.id("accountExportJobs") },
    handler: async (ctx, { jobId }) => {
        const job = await ctx.db.get(jobId)
        if (!job || job.status !== "uploaded" || !job.downloadUrl) return null
        return { ...job, downloadUrl: job.downloadUrl }
    }
})

export const markAccountExportDelivered = internalMutation({
    args: {
        jobId: v.id("accountExportJobs"),
        providerMessageId: v.optional(v.string()),
        deliveryAttempts: v.number()
    },
    handler: async (ctx, { jobId, providerMessageId, deliveryAttempts }) => {
        const job = await ctx.db.get(jobId)
        if (!job || job.status !== "uploaded") return false
        const now = Date.now()
        await ctx.db.patch(jobId, {
            status: "delivered",
            deliveredAt: now,
            emailProviderMessageId: providerMessageId,
            deliveryAttempts,
            updatedAt: now
        })
        return true
    }
})
