import { ConvexError, v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import { type MutationCtx, type QueryCtx, mutation, query } from "./_generated/server"
import { authComponent, betterAuthComponent, getAppUserId } from "./auth"
import {
    ensureCreditAccountRecord,
    getCreditAccount,
    getHostedUsageState,
    getUserCreditPeriod
} from "./credits"
import { assertAccountNotDeleting } from "./lib/account_deletion_status"
import { getUserIdentity } from "./lib/identity"
import { canImpersonate } from "./lib/impersonation"
import { isImpersonatedSession } from "./lib/impersonation_session"
import { microusdToUsd } from "./lib/usage_metering"
import {
    createGlobalGrantEligibility,
    getUserSignedUpAt,
    listGlobalUsageResets
} from "./lib/usage_reset_state"
import {
    USAGE_RESET_EXPIRY_MONTH_OPTIONS,
    USAGE_RESET_NOTE_MAX_LENGTH,
    WEEKLY_RESET_FRACTION,
    type UsageResetEffect,
    applyResetToBreakpoints,
    describeUsageReset,
    getUsageResetExpiresAt,
    grantTargetsUser,
    isGrantLive,
    pruneBreakpoints,
    readAccountBreakpoints,
    USAGE_RESET_USABLE_AT,
    isResetUsable
} from "./lib/usage_resets"
import { PrototypeCreditPlan } from "./schema/credits"
import { UsageResetDelivery, UsageResetWindow } from "./schema/usage_resets"

type Grant = Doc<"usageResetGrants">
type CreditAccountDoc = Doc<"prototypeCreditAccounts">

const RECENT_GLOBAL_GRANTS_LIMIT = 50
const USER_GRANTS_LIMIT = 100
// Instant resets older than this don't raise a notice for users who were away.
const NOTICE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

const requireOperator = async (ctx: QueryCtx) => {
    const operator = await authComponent.safeGetAuthUser(ctx)
    if (!operator || !canImpersonate(operator._id)) {
        throw new ConvexError("Moderator access required")
    }
    return operator
}

const toEffect = (grant: Grant): UsageResetEffect => ({
    window: grant.window,
    includesFiveHour: grant.includesFiveHour,
    fraction: grant.fraction
})

const writeAccountReset = async (
    ctx: MutationCtx,
    account: CreditAccountDoc,
    effect: UsageResetEffect,
    at: number
) => {
    const period = await getUserCreditPeriod(ctx, account.userId, account, at)
    const next = pruneBreakpoints(
        applyResetToBreakpoints(readAccountBreakpoints(account), effect, at),
        period.startsAt
    )
    await ctx.db.patch(account._id, {
        usageResetFiveHourAt: next.fiveHourAt,
        usageResetMonthlyAt: next.monthlyAt,
        usageResetWeekly: next.weekly.length > 0 ? next.weekly : undefined,
        updatedAt: at
    })
}

const getUsageSnapshot = async (
    ctx: QueryCtx | MutationCtx,
    userId: string,
    account: CreditAccountDoc | null
) => {
    const plan = account?.plan ?? "free"
    const period = await getUserCreditPeriod(ctx, userId, account)
    const usage = await getHostedUsageState(ctx, {
        userId,
        periodKey: period.periodKey,
        periodStartsAt: period.startsAt,
        plan,
        account
    })
    return { plan, period, usage }
}

const listRedeemedGrantIds = async (ctx: QueryCtx | MutationCtx, userId: string) =>
    new Set(
        (
            await ctx.db
                .query("usageResetRedemptions")
                .withIndex("byUserGrant", (q) => q.eq("userId", userId))
                .collect()
        ).map((redemption) => redemption.grantId)
    )

// Banked tickets the user can still redeem: their own and the global ones they qualify for.
const listOpenTickets = async (
    ctx: QueryCtx | MutationCtx,
    {
        userId,
        plan,
        account,
        now
    }: { userId: string; plan: "free" | "pro"; account: CreditAccountDoc | null; now: number }
) => {
    const [ownGrants, globalGrants, redeemed] = await Promise.all([
        ctx.db
            .query("usageResetGrants")
            .withIndex("byUserCreatedAt", (q) => q.eq("userId", userId))
            .collect(),
        listGlobalUsageResets(ctx, "banked"),
        listRedeemedGrantIds(ctx, userId)
    ])
    const isEligible = createGlobalGrantEligibility(ctx, {
        userId,
        plan,
        accountCreatedAt: account?._creationTime
    })
    const tickets: Grant[] = []
    for (const grant of ownGrants) {
        if (grant.delivery === "banked" && isGrantLive(grant, now) && !redeemed.has(grant._id)) {
            tickets.push(grant)
        }
    }
    for (const grant of globalGrants) {
        if (isGrantLive(grant, now) && !redeemed.has(grant._id) && (await isEligible(grant))) {
            tickets.push(grant)
        }
    }
    // Soonest to expire first, so the one about to lapse is used first.
    return tickets.sort(
        (left, right) =>
            (left.expiresAt ?? Number.POSITIVE_INFINITY) -
                (right.expiresAt ?? Number.POSITIVE_INFINITY) || left.createdAt - right.createdAt
    )
}

const toGrantView = (grant: Grant) => ({
    id: grant._id,
    scope: grant.scope,
    plan: grant.plan ?? null,
    signedUpBefore: grant.signedUpBefore ?? null,
    delivery: grant.delivery,
    window: grant.window,
    includesFiveHour: grant.includesFiveHour,
    label: describeUsageReset(grant),
    expiresAt: grant.expiresAt ?? null,
    revokedAt: grant.revokedAt ?? null,
    note: grant.note ?? null,
    createdAt: grant.createdAt
})

// --- Operator ---

export const grantUsageReset = mutation({
    args: {
        target: v.union(
            v.object({ kind: v.literal("user"), authUserId: v.string() }),
            v.object({
                kind: v.literal("global"),
                plan: v.optional(PrototypeCreditPlan),
                signedUpBefore: v.optional(v.number())
            })
        ),
        window: UsageResetWindow,
        includesFiveHour: v.boolean(),
        delivery: UsageResetDelivery,
        // Banked only; null means the ticket never expires.
        expiryMonths: v.union(v.number(), v.null()),
        note: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const operator = await requireOperator(ctx)
        const now = Date.now()
        if (
            args.delivery === "banked" &&
            args.expiryMonths !== null &&
            !(USAGE_RESET_EXPIRY_MONTH_OPTIONS as readonly number[]).includes(args.expiryMonths)
        ) {
            throw new ConvexError("Choose an expiry of 1, 3 or 6 months, or none")
        }
        const note = args.note?.trim()
        if (note && note.length > USAGE_RESET_NOTE_MAX_LENGTH) {
            throw new ConvexError("The note is too long")
        }

        let userId: string | undefined
        let account: CreditAccountDoc | null = null
        if (args.target.kind === "user") {
            const user = await ctx.runQuery(betterAuthComponent.adapter.findOne, {
                model: "user",
                where: [{ field: "_id", value: args.target.authUserId }]
            })
            if (!user) throw new ConvexError("This account no longer exists")
            userId = getAppUserId(user)
            account = await getCreditAccount(ctx, userId)
        }

        const effect: UsageResetEffect = {
            window: args.window,
            includesFiveHour: args.window !== "five_hour" && args.includesFiveHour,
            ...(args.window === "weekly" ? { fraction: WEEKLY_RESET_FRACTION } : {})
        }
        const grantId = await ctx.db.insert("usageResetGrants", {
            scope: args.target.kind,
            userId,
            ...(args.target.kind === "global"
                ? {
                      plan: args.target.plan,
                      // Only people signed up when the grant is made can qualify.
                      signedUpBefore: Math.min(args.target.signedUpBefore ?? now, now)
                  }
                : {}),
            delivery: args.delivery,
            ...effect,
            expiresAt:
                args.delivery === "banked"
                    ? getUsageResetExpiresAt(now, args.expiryMonths)
                    : undefined,
            note: note || undefined,
            createdBy: operator._id,
            createdAt: now
        })

        // Global instant resets are read from the grant itself. A user with no credit
        // account has no usage, so there is nothing to write.
        if (args.delivery === "instant" && account) {
            await writeAccountReset(ctx, account, effect, now)
        }

        return { grantId }
    }
})

export const revokeUsageReset = mutation({
    args: { grantId: v.id("usageResetGrants") },
    handler: async (ctx, { grantId }) => {
        await requireOperator(ctx)
        const grant = await ctx.db.get(grantId)
        if (!grant) throw new ConvexError("This reset no longer exists")
        if (grant.delivery !== "banked") {
            throw new ConvexError("Instant resets are already applied")
        }
        if (grant.revokedAt !== undefined) return
        // A per-user Banked Reset that was used has nothing left to revoke. Revoking a global
        // one only takes it back from people who haven't used it.
        if (grant.scope === "user" && grant.userId) {
            const userId = grant.userId
            const redeemed = await ctx.db
                .query("usageResetRedemptions")
                .withIndex("byUserGrant", (q) => q.eq("userId", userId).eq("grantId", grantId))
                .first()
            if (redeemed) throw new ConvexError("This Banked Reset was already used")
        }
        await ctx.db.patch(grantId, { revokedAt: Date.now() })
    }
})

export const getUserUsageResets = query({
    args: { authUserId: v.string() },
    handler: async (ctx, { authUserId }) => {
        await requireOperator(ctx)
        const user = await ctx.runQuery(betterAuthComponent.adapter.findOne, {
            model: "user",
            where: [{ field: "_id", value: authUserId }]
        })
        if (!user) return null
        const userId = getAppUserId(user)
        const account = await getCreditAccount(ctx, userId)
        const { plan, usage } = await getUsageSnapshot(ctx, userId, account)
        const [grants, redeemed, tickets] = await Promise.all([
            ctx.db
                .query("usageResetGrants")
                .withIndex("byUserCreatedAt", (q) => q.eq("userId", userId))
                .order("desc")
                .take(USER_GRANTS_LIMIT),
            listRedeemedGrantIds(ctx, userId),
            listOpenTickets(ctx, { userId, plan, account, now: Date.now() })
        ])

        return {
            plan,
            usage: {
                fiveHourUsedUsd: microusdToUsd(usage.fiveHourUsedMicrousd),
                fiveHourLimitUsd: microusdToUsd(usage.limits.fiveHourMicrousd),
                monthlyUsedUsd: microusdToUsd(usage.monthlyUsedMicrousd),
                monthlyLimitUsd: microusdToUsd(usage.limits.monthlyMicrousd)
            },
            openTicketCount: tickets.length,
            grants: grants.map((grant) => ({
                ...toGrantView(grant),
                redeemed: redeemed.has(grant._id)
            }))
        }
    }
})

export const listRecentGlobalUsageResets = query({
    args: {},
    handler: async (ctx) => {
        await requireOperator(ctx)
        const grants = await ctx.db
            .query("usageResetGrants")
            .withIndex("byScopeCreatedAt", (q) => q.eq("scope", "global"))
            .order("desc")
            .take(RECENT_GLOBAL_GRANTS_LIMIT)
        return grants.map(toGrantView)
    }
})

// --- User ---

// Just the count, for the usage card's button. Unlike the full list it doesn't scan usage
// to work out which Banked Resets would help right now.
export const getMyUsageResetTicketCount = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return null

        const account = await getCreditAccount(ctx, user.id)
        const tickets = await listOpenTickets(ctx, {
            userId: user.id,
            plan: account?.plan ?? "free",
            account,
            now: Date.now()
        })
        return tickets.length
    }
})

export const getMyUsageResetTickets = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return null

        const account = await getCreditAccount(ctx, user.id)
        const { plan, usage } = await getUsageSnapshot(ctx, user.id, account)
        const tickets = await listOpenTickets(ctx, {
            userId: user.id,
            plan,
            account,
            now: Date.now()
        })

        return tickets.map((grant) => ({
            id: grant._id,
            window: grant.window,
            includesFiveHour: grant.includesFiveHour,
            label: describeUsageReset(grant),
            expiresAt: grant.expiresAt ?? null,
            createdAt: grant.createdAt,
            canRedeem: isResetUsable(grant, plan, usage),
            usableAtPercent: Math.round(USAGE_RESET_USABLE_AT[plan] * 100)
        }))
    }
})

export const redeemUsageReset = mutation({
    args: { grantId: v.id("usageResetGrants") },
    handler: async (ctx, { grantId }) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new ConvexError("Sign in to use a reset")
        // The dialog disables this while viewing as the user. This is the backstop.
        if (await isImpersonatedSession(ctx, user.sessionId)) {
            throw new ConvexError("Banked Resets can't be used while viewing as this user")
        }
        await assertAccountNotDeleting(ctx, user.id)

        const now = Date.now()
        const grant = await ctx.db.get(grantId)
        if (!grant || grant.delivery !== "banked" || !isGrantLive(grant, now)) {
            throw new ConvexError("This reset is no longer available")
        }
        const existing = await ctx.db
            .query("usageResetRedemptions")
            .withIndex("byUserGrant", (q) => q.eq("userId", user.id).eq("grantId", grantId))
            .first()
        if (existing) throw new ConvexError("You've already used this reset")

        const account = await getCreditAccount(ctx, user.id)
        const plan = account?.plan ?? "free"
        const signedUpAt =
            grant.scope === "global" && grant.signedUpBefore !== undefined
                ? account && account._creationTime <= grant.signedUpBefore
                    ? account._creationTime
                    : await getUserSignedUpAt(ctx, user.id)
                : null
        if (!grantTargetsUser(grant, { userId: user.id, plan, signedUpAt })) {
            throw new ConvexError("This reset is no longer available")
        }

        const { usage } = await getUsageSnapshot(ctx, user.id, account)
        if (!account || !isResetUsable(grant, plan, usage)) {
            throw new ConvexError(
                `This Banked Reset is usable once you've used ${Math.round(USAGE_RESET_USABLE_AT[plan] * 100)}% of your limit`
            )
        }

        await ctx.db.insert("usageResetRedemptions", { grantId, userId: user.id, redeemedAt: now })
        await writeAccountReset(ctx, account, toEffect(grant), now)
        return { label: describeUsageReset(grant) }
    }
})

// The newest instant reset the user hasn't been told about.
export const getMyUsageResetNotice = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return null

        const now = Date.now()
        const account = await getCreditAccount(ctx, user.id)
        // No credit account means no usage ever, so a reset changed nothing for them.
        if (!account) return null
        const since = Math.max((account?.usageResetNoticeSeenAt ?? 0) + 1, now - NOTICE_WINDOW_MS)
        const [ownGrants, globalGrants] = await Promise.all([
            ctx.db
                .query("usageResetGrants")
                .withIndex("byUserCreatedAt", (q) =>
                    q.eq("userId", user.id).gte("createdAt", since)
                )
                .collect(),
            listGlobalUsageResets(ctx, "instant", since)
        ])
        const isEligible = createGlobalGrantEligibility(ctx, {
            userId: user.id,
            plan: account?.plan ?? "free",
            accountCreatedAt: account?._creationTime
        })
        const candidates = [
            ...ownGrants.filter((grant) => grant.delivery === "instant"),
            ...globalGrants
        ].sort((left, right) => right.createdAt - left.createdAt)
        for (const grant of candidates) {
            if (grant.createdAt > now) continue
            if (grant.scope === "global" && !(await isEligible(grant))) continue
            return {
                id: grant._id as Id<"usageResetGrants">,
                window: grant.window,
                includesFiveHour: grant.includesFiveHour,
                createdAt: grant.createdAt
            }
        }
        return null
    }
})

export const dismissMyUsageResetNotice = mutation({
    args: { seenAt: v.number() },
    handler: async (ctx, { seenAt }) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return
        // An operator viewing as this user shouldn't use up the user's notice.
        if (await isImpersonatedSession(ctx, user.sessionId)) return
        await assertAccountNotDeleting(ctx, user.id)

        await ensureCreditAccountRecord(ctx, user.id)
        const account = await getCreditAccount(ctx, user.id)
        if (!account) return
        const nextSeenAt = Math.min(
            Math.max(account.usageResetNoticeSeenAt ?? 0, seenAt),
            Date.now()
        )
        if (nextSeenAt === account.usageResetNoticeSeenAt) return
        await ctx.db.patch(account._id, { usageResetNoticeSeenAt: nextSeenAt })
    }
})
