import { v } from "convex/values"
import { getMessageSpeechText } from "../src/lib/speech-text"
import { internalMutation, internalQuery } from "./_generated/server"
import { MESSAGE_SPEECH_MODEL } from "./lib/models/microsoft"
import { MESSAGE_SPEECH } from "./lib/speech_config"
import { assertAccountNotDeleting } from "./lib/account_deletion_status"
import { internal } from "./_generated/api"
import type { SpeechConfig } from "./lib/models/types"
import { splitSpeechText } from "../src/lib/speech-text-chunks"

const creditKey = (leaseId: string) => `speech:${leaseId}`

export function speechCostMicrousd(
    text: string,
    speech: SpeechConfig = MESSAGE_SPEECH_MODEL.speech
) {
    const bytesPricing = speech.inputUsdPer1MUtf8Bytes !== undefined
    const units = splitSpeechText(text, speech.maxInputCharacters).reduce(
        (sum, chunk) =>
            sum +
            (bytesPricing ? new TextEncoder().encode(chunk).length : Array.from(chunk).length),
        0
    )
    const price = speech.inputUsdPer1MUtf8Bytes ?? speech.inputUsdPer1MCharacters
    return Math.ceil(units * price)
}

export function submittedSpeechCostMicrousd(
    submittedCharacters: number,
    submittedUtf8Bytes: number,
    speech: SpeechConfig = MESSAGE_SPEECH_MODEL.speech
) {
    const units =
        speech.inputUsdPer1MUtf8Bytes !== undefined ? submittedUtf8Bytes : submittedCharacters
    const price = speech.inputUsdPer1MUtf8Bytes ?? speech.inputUsdPer1MCharacters
    return Math.ceil(Math.max(0, units) * price)
}

export const getSource = internalQuery({
    args: { userId: v.string(), messageId: v.string(), threadId: v.id("threads") },
    handler: async (ctx, args) => {
        const thread = await ctx.db.get(args.threadId)
        if (!thread || thread.authorId !== args.userId) return null
        const message = await ctx.db
            .query("messages")
            .withIndex("byMessageId", (q) => q.eq("messageId", args.messageId))
            .filter((q) => q.eq(q.field("threadId"), args.threadId))
            .first()
        if (message?.role !== "assistant") return null
        return getMessageSpeechText(message.parts)
    }
})

// Reuse the existing rate-limit table for a short, recoverable generation lease.
export const acquire = internalMutation({
    args: { userId: v.string() },
    handler: async (ctx, { userId }) => {
        await assertAccountNotDeleting(ctx, userId)
        const key = `speech:${userId}`
        const previous = await ctx.db
            .query("rateLimit")
            .withIndex("key", (q) => q.eq("key", key))
            .first()
        const now = Date.now()
        if (previous?.count === 2 && now - previous.lastRequest < MESSAGE_SPEECH.timeoutMs + 30000)
            return null
        if (previous) await ctx.db.delete(previous._id)
        const leaseId = await ctx.db.insert("rateLimit", { key, count: 1, lastRequest: now })
        return { leaseId, acquiredAt: now }
    }
})

export const consume = internalMutation({
    args: {
        userId: v.string(),
        leaseId: v.id("rateLimit"),
        acquiredAt: v.number(),
        threadId: v.id("threads"),
        messageId: v.string(),
        text: v.string(),
        cached: v.boolean()
    },
    handler: async (ctx, args): Promise<{ allowed: boolean; reason?: string }> => {
        await assertAccountNotDeleting(ctx, args.userId)
        const lease = await ctx.db.get(args.leaseId)
        if (
            !lease ||
            lease.key !== `speech:${args.userId}` ||
            lease.lastRequest !== args.acquiredAt ||
            lease.count !== 1 ||
            Date.now() - args.acquiredAt > 60000
        )
            return { allowed: false, reason: "expired" } as const
        if (!args.cached) {
            const reservation = await ctx.runMutation(internal.credits.reserveCreditForMessage, {
                userId: args.userId,
                threadId: args.threadId,
                messageId: args.messageId,
                messageKey: creditKey(args.leaseId),
                modelId: MESSAGE_SPEECH_MODEL.id,
                providerSource: "internal",
                feature: "speech",
                counted: true,
                reservedMicrousd: speechCostMicrousd(args.text),
                pricingSource: "openrouter_estimate"
            })
            if (!reservation.allowed) return reservation
            // One-shot recovery for a lost Worker callback, not an asset cleanup cron.
            await ctx.scheduler.runAfter(
                MESSAGE_SPEECH.timeoutMs + 30000,
                internal.credits.releaseReservedCreditForMessage,
                {
                    userId: args.userId,
                    messageKey: creditKey(args.leaseId)
                }
            )
        }
        await ctx.db.patch(lease._id, { count: 2 })
        return { allowed: true } as const
    }
})

export const release = internalMutation({
    args: {
        userId: v.string(),
        acquiredAt: v.number(),
        leaseId: v.optional(v.id("rateLimit")),
        complete: v.optional(v.boolean()),
        submittedCharacters: v.optional(v.number()),
        submittedUtf8Bytes: v.optional(v.number())
    },
    handler: async (
        ctx,
        { userId, acquiredAt, leaseId, complete, submittedCharacters = 0, submittedUtf8Bytes = 0 }
    ): Promise<void> => {
        if (leaseId) {
            const args = { userId, messageKey: creditKey(leaseId) }
            const settledMicrousd = submittedSpeechCostMicrousd(
                submittedCharacters,
                submittedUtf8Bytes
            )
            if (complete || settledMicrousd > 0)
                await ctx.runMutation(internal.credits.commitReservedCreditForMessage, {
                    ...args,
                    ...(complete ? {} : { settledMicrousd })
                })
            else await ctx.runMutation(internal.credits.releaseReservedCreditForMessage, args)
        }
        const previous = await ctx.db
            .query("rateLimit")
            .withIndex("key", (q) => q.eq("key", `speech:${userId}`))
            .first()
        if (previous?.lastRequest === acquiredAt && (!leaseId || previous._id === leaseId))
            await ctx.db.delete(previous._id)
    }
})
