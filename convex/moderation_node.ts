"use node"

import { ConvexError, v } from "convex/values"
import type { RenderedEmail } from "../src/lib/email"
import { internal } from "./_generated/api"
import { action, internalAction } from "./_generated/server"
import { canImpersonate } from "./lib/impersonation"
import { cancelLemonSqueezySubscription } from "./lib/lemon_squeezy"
import {
    DEFAULT_STRIKE_EXPIRY_DAYS,
    MODERATION_EMAIL_MAX_RETRIES,
    MODERATION_STRIKE_LIMIT,
    type ModerationAction,
    addDays,
    formatModerationEmailDate,
    getModerationCategory,
    getPolicyReference
} from "./lib/moderation"
import { ModerationActionValidator } from "./schema/moderation"

const RETRY_BASE_MS = 5 * 60 * 1000

type ModerationEmailInput = {
    action: ModerationAction
    name?: string
    caseId: string
    violation: string
    policyReference?: string
    contentAction?: string
    strikeNumber?: number
    strikeLimit?: number
    expiresAt?: number
    endsAt?: number
}

const renderModerationEmail = async (input: ModerationEmailInput): Promise<RenderedEmail> => {
    const { buildModerationBanEmail, buildModerationStrikeEmail, buildModerationWarningEmail } =
        await import("../src/lib/email")
    const content = {
        name: input.name,
        caseId: input.caseId,
        violation: input.violation,
        policyReference: input.policyReference,
        contentAction: input.contentAction
    }
    if (input.action === "warning") return await buildModerationWarningEmail(content)
    if (input.action === "strike") {
        return await buildModerationStrikeEmail({
            ...content,
            strikeNumber: input.strikeNumber ?? 1,
            strikeLimit: input.strikeLimit ?? MODERATION_STRIKE_LIMIT,
            expiresAt:
                input.expiresAt !== undefined
                    ? formatModerationEmailDate(input.expiresAt)
                    : undefined
        })
    }
    // A shortened ban has an end date too, and must not read as permanent.
    return await buildModerationBanEmail({
        ...content,
        endsAt: input.endsAt !== undefined ? formatModerationEmailDate(input.endsAt) : undefined
    })
}

const errorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback

export const deliverModerationCase = internalAction({
    args: { caseId: v.id("moderationCases") },
    handler: async (ctx, { caseId }) => {
        const moderationCase = await ctx.runQuery(
            internal.moderation.getModerationCaseForDeliveryInternal,
            { caseId }
        )
        if (!moderationCase) return
        const attempts = (moderationCase.emailAttempts ?? 0) + 1
        const retryOrFail = async (
            failure: string,
            subscriptionCancellation?: "failed" | undefined
        ) => {
            const terminal = attempts > MODERATION_EMAIL_MAX_RETRIES
            await ctx.runMutation(internal.moderation.recordModerationDeliveryInternal, {
                caseId,
                attempts,
                emailError: failure,
                ...(terminal ? { emailStatus: "failed" as const, subscriptionCancellation } : {})
            })
            if (!terminal) {
                await ctx.scheduler.runAfter(
                    RETRY_BASE_MS * 2 ** (attempts - 1),
                    internal.moderation_node.deliverModerationCase,
                    { caseId }
                )
            }
        }

        // The suspension and ban emails say the subscription is already cancelled, so they
        // only go out once that is true.
        if (moderationCase.subscriptionCancellation === "pending") {
            try {
                if (
                    moderationCase.subscriptionIds.length > 0 &&
                    !process.env.LEMONSQUEEZY_API_KEY?.trim()
                ) {
                    throw new Error("LEMONSQUEEZY_API_KEY is not configured")
                }
                for (const subscriptionId of moderationCase.subscriptionIds) {
                    await cancelLemonSqueezySubscription(subscriptionId)
                }
                await ctx.runMutation(internal.moderation.recordModerationDeliveryInternal, {
                    caseId,
                    attempts: attempts - 1,
                    subscriptionCancellation: "done"
                })
            } catch (error) {
                await retryOrFail(
                    `Subscription cancellation failed: ${errorMessage(error, "unknown error")}`,
                    "failed"
                )
                return
            }
        }

        try {
            const { sendEmail } = await import("../src/lib/email")
            await sendEmail({
                to: moderationCase.recipientEmail,
                ...(await renderModerationEmail({
                    ...moderationCase,
                    name: moderationCase.recipientName
                })),
                idempotencyKey: `moderation/${moderationCase.caseId}`
            })
            await ctx.runMutation(internal.moderation.recordModerationDeliveryInternal, {
                caseId,
                attempts,
                emailStatus: "sent"
            })
        } catch (error) {
            await retryOrFail(errorMessage(error, "Email delivery failed"))
        }
    }
})

export const deliverModerationUpdate = internalAction({
    args: { updateId: v.id("moderationCaseUpdates") },
    handler: async (ctx, { updateId }) => {
        const update = await ctx.runQuery(
            internal.moderation.getModerationUpdateForDeliveryInternal,
            { updateId }
        )
        if (!update) return
        const attempts = (update.emailAttempts ?? 0) + 1
        try {
            const { buildModerationUpdateEmail, sendEmail } = await import("../src/lib/email")
            await sendEmail({
                to: update.recipientEmail,
                ...(await buildModerationUpdateEmail({
                    kind: update.kind,
                    action: update.action,
                    viaAppeal: update.viaAppeal,
                    restoresAccess: update.restoresAccess,
                    newEnd:
                        update.newEnd !== undefined
                            ? formatModerationEmailDate(update.newEnd)
                            : undefined,
                    name: update.recipientName,
                    caseId: update.caseId,
                    violation: update.violation,
                    note: update.note
                })),
                idempotencyKey: `moderation/${update.caseId}/${updateId}`
            })
            await ctx.runMutation(internal.moderation.recordModerationUpdateDeliveryInternal, {
                updateId,
                attempts,
                emailStatus: "sent"
            })
        } catch (error) {
            const terminal = attempts > MODERATION_EMAIL_MAX_RETRIES
            await ctx.runMutation(internal.moderation.recordModerationUpdateDeliveryInternal, {
                updateId,
                attempts,
                emailError: errorMessage(error, "Email delivery failed"),
                ...(terminal ? { emailStatus: "failed" as const } : {})
            })
            if (!terminal) {
                await ctx.scheduler.runAfter(
                    RETRY_BASE_MS * 2 ** (attempts - 1),
                    internal.moderation_node.deliverModerationUpdate,
                    { updateId }
                )
            }
        }
    }
})

// Renders the exact email an action would send, with a placeholder case ID.
export const previewModerationEmail = action({
    args: {
        authUserId: v.string(),
        action: ModerationActionValidator,
        category: v.string(),
        violation: v.string(),
        contentAction: v.optional(v.string()),
        strikeExpiryDays: v.optional(v.union(v.number(), v.null())),
        suspensionDays: v.optional(v.number())
    },
    handler: async (ctx, args): Promise<RenderedEmail> => {
        const operator = await ctx.auth.getUserIdentity()
        if (!operator || !canImpersonate(operator.subject)) {
            throw new ConvexError("Moderator access required")
        }
        if (!getModerationCategory(args.category)) throw new ConvexError("Choose a violation type")
        const context = await ctx.runQuery(
            internal.moderation.getModerationPreviewContextInternal,
            { authUserId: args.authUserId }
        )
        if (!context) throw new ConvexError("User not found")
        const now = Date.now()
        const strikeExpiryDays =
            args.strikeExpiryDays === undefined ? DEFAULT_STRIKE_EXPIRY_DAYS : args.strikeExpiryDays
        return await renderModerationEmail({
            action: args.action,
            name: context.name,
            caseId: "SC-PREVIEW",
            violation: args.violation.trim() || "(What we found)",
            policyReference: getPolicyReference(args.category),
            contentAction: args.contentAction?.trim() || undefined,
            strikeNumber: context.nextStrikeNumber,
            strikeLimit: MODERATION_STRIKE_LIMIT,
            expiresAt: strikeExpiryDays === null ? undefined : addDays(now, strikeExpiryDays),
            endsAt: args.suspensionDays ? addDays(now, args.suspensionDays) : undefined
        })
    }
})
