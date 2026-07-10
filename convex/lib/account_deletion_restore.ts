import type { MutationCtx } from "../_generated/server"
import {
    buildSuppressedCreditAccountSeed,
    chooseCanonicalSuppression,
    fingerprintAccountIdentity
} from "./account_deletion"
import { getAnchoredMonthlyCreditPeriodBounds, getCreditPeriodKeyFromBounds } from "./credits"

type RestoreDeletedAccountCreditsArgs = {
    userId: string
    email: string
    googleSub?: string
}

const getFingerprintPepper = () =>
    process.env.IDENTITY_FINGERPRINT_PEPPER?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    "silkchat-local-account-deletion-pepper"

const getCreditAccount = async (ctx: MutationCtx, userId: string) => {
    return await ctx.db
        .query("prototypeCreditAccounts")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .first()
}

const getSubscriptionLink = async (ctx: MutationCtx, subscriptionId: string) => {
    return await ctx.db
        .query("billingSubscriptionLinks")
        .withIndex("bySubscriptionId", (q) => q.eq("lemonSqueezySubscriptionId", subscriptionId))
        .first()
}

const getSubscription = async (ctx: MutationCtx, subscriptionId: string) => {
    return await ctx.db
        .query("lemonSqueezySubscriptions")
        .withIndex("bySubscriptionId", (q) => q.eq("lemonSqueezySubscriptionId", subscriptionId))
        .first()
}

const getMatchingSuppressions = async ({
    ctx,
    emailHash,
    googleSubHash
}: {
    ctx: MutationCtx
    emailHash: string
    googleSubHash?: string
}) => {
    const emailMatches = await ctx.db
        .query("identitySuppressions")
        .withIndex("byEmailHash", (q) => q.eq("emailHash", emailHash))
        .collect()
    const googleMatches = googleSubHash
        ? await ctx.db
              .query("identitySuppressions")
              .withIndex("byGoogleSubHash", (q) => q.eq("googleSubHash", googleSubHash))
              .collect()
        : []

    return [...googleMatches, ...emailMatches].filter(
        (match, index, all) =>
            !match.supersededBy && all.findIndex((other) => other._id === match._id) === index
    )
}

export const restoreDeletedAccountCreditsForIdentity = async (
    ctx: MutationCtx,
    { userId, email, googleSub }: RestoreDeletedAccountCreditsArgs
) => {
    const existingAccount = await getCreditAccount(ctx, userId)
    if (existingAccount?.carriedForPeriodKey) {
        return { restored: false as const, reason: "already_seeded" as const }
    }

    const fingerprint = await fingerprintAccountIdentity({
        pepper: getFingerprintPepper(),
        email,
        googleSub
    })
    const matches = await getMatchingSuppressions({
        ctx,
        emailHash: fingerprint.emailHash,
        googleSubHash: fingerprint.googleSubHash
    })
    const canonical = chooseCanonicalSuppression({
        googleSubHash: fingerprint.googleSubHash,
        matches: matches.map((match) => ({
            _id: String(match._id),
            googleSubHash: match.googleSubHash,
            emailHash: match.emailHash,
            freePeriodKey: match.freePeriodKey,
            freeConsumedBasicUnits: match.freeConsumedBasicUnits,
            proEntitlementEndsAt: match.proEntitlementEndsAt,
            refundCount: match.refundCount,
            firstDeletedAt: match.firstDeletedAt,
            lastDeletedAt: match.lastDeletedAt
        }))
    })
    const suppression = canonical
        ? matches.find((match) => String(match._id) === canonical._id)
        : null

    if (!suppression) {
        return { restored: false as const, reason: "no_suppression" as const }
    }

    const now = Date.now()
    const currentFreePeriodKey = getCreditPeriodKeyFromBounds(
        getAnchoredMonthlyCreditPeriodBounds({
            timestamp: now,
            anchorTimestamp: suppression.freeAnchorAt
        })
    )
    const seed = buildSuppressedCreditAccountSeed({
        userId,
        now,
        suppression,
        currentFreePeriodKey
    })
    const existingCarryBasic =
        existingAccount?.carriedForPeriodKey === seed.carriedForPeriodKey
            ? (existingAccount?.carriedBasicUnits ?? 0)
            : 0
    const existingCarryPro =
        existingAccount?.carriedForPeriodKey === seed.carriedForPeriodKey
            ? (existingAccount?.carriedProUnits ?? 0)
            : 0
    const existingCarryUsageMicrousd =
        existingAccount?.carriedForPeriodKey === seed.carriedForPeriodKey
            ? (existingAccount?.carriedUsageMicrousd ?? 0)
            : 0
    const nextAccount = {
        userId,
        enabled: existingAccount?.enabled ?? seed.enabled,
        plan: existingAccount?.plan === "pro" ? existingAccount.plan : seed.plan,
        monthlyBasicCredits: existingAccount?.monthlyBasicCredits,
        monthlyProCredits: existingAccount?.monthlyProCredits,
        creditPeriodAnchorAt: seed.creditPeriodAnchorAt,
        carriedForPeriodKey: seed.carriedForPeriodKey ?? existingAccount?.carriedForPeriodKey,
        carriedBasicUnits:
            seed.carriedForPeriodKey || existingAccount?.carriedForPeriodKey
                ? Math.max(existingCarryBasic, seed.carriedBasicUnits ?? 0)
                : undefined,
        carriedProUnits:
            seed.carriedForPeriodKey || existingAccount?.carriedForPeriodKey
                ? Math.max(existingCarryPro, seed.carriedProUnits ?? 0)
                : undefined,
        carriedUsageMicrousd:
            seed.carriedForPeriodKey || existingAccount?.carriedForPeriodKey
                ? Math.max(existingCarryUsageMicrousd, seed.carriedUsageMicrousd ?? 0)
                : undefined,
        updatedAt: now
    }

    if (existingAccount?._id) {
        await ctx.db.patch(existingAccount._id, nextAccount)
    } else {
        await ctx.db.insert("prototypeCreditAccounts", nextAccount)
    }

    await ctx.db.patch(suppression._id, {
        relinkedToUserId: userId,
        lastDeletedAt: Math.max(suppression.lastDeletedAt, now)
    })

    if (suppression.lemonSqueezySubscriptionId) {
        const link = await getSubscriptionLink(ctx, suppression.lemonSqueezySubscriptionId)
        if (link?._id) {
            await ctx.db.patch(link._id, {
                liveUserId: userId,
                suppressionId: suppression._id,
                updatedAt: now
            })
        }

        if (seed.plan === "pro" && link?.lastEventId) {
            const subscription = await getSubscription(ctx, suppression.lemonSqueezySubscriptionId)
            const nextSubscription = {
                userId,
                lemonSqueezySubscriptionId: suppression.lemonSqueezySubscriptionId,
                lemonSqueezyCustomerId:
                    link.lemonSqueezyCustomerId ?? suppression.lemonSqueezyCustomerId,
                status: link.status,
                plan: link.plan,
                renewsAt: link.renewsAt,
                endsAt: link.endsAt,
                trialEndsAt: link.trialEndsAt,
                updatedAt: now,
                lastEventId: link.lastEventId
            }

            if (subscription?._id) {
                await ctx.db.patch(subscription._id, nextSubscription)
            } else {
                await ctx.db.insert("lemonSqueezySubscriptions", nextSubscription)
            }
        }
    }

    return {
        restored: true as const,
        suppressionId: suppression._id,
        carriedForPeriodKey: nextAccount.carriedForPeriodKey,
        carriedBasicUnits: nextAccount.carriedBasicUnits ?? 0,
        carriedProUnits: nextAccount.carriedProUnits ?? 0,
        carriedUsageMicrousd: nextAccount.carriedUsageMicrousd ?? 0,
        plan: nextAccount.plan
    }
}
