import { v } from "convex/values"
import { internal } from "./_generated/api"
import { type MutationCtx, internalAction, internalMutation } from "./_generated/server"
import { betterAuthComponent, getAppUserId } from "./auth"
import {
    type FreemiusLicenseSnapshot,
    fetchFreemiusUserState,
    getFreemiusPlanForUser
} from "./lib/freemius"
import { type BillingPlan, getEffectiveBillingPlan } from "./lib/lemon_squeezy"

const licenseSnapshot = v.object({
    fsLicenseId: v.string(),
    fsPlanId: v.string(),
    fsPricingId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    isCancelled: v.boolean(),
    isSandbox: v.boolean()
})

const resolveUserId = async (ctx: MutationCtx, fsUserId: string, email: string | undefined) => {
    const binding = await ctx.db
        .query("freemiusCustomers")
        .withIndex("byFsUserId", (q) => q.eq("fsUserId", fsUserId))
        .first()
    if (binding) return binding.userId

    // Checkout locks the email to the signed-in account, so the first sync binds
    // by email. The binding then sticks even if either email changes later.
    if (!email) return undefined
    const authUser = await ctx.runQuery(betterAuthComponent.adapter.findOne, {
        model: "user",
        where: [{ field: "email", value: email }]
    })
    if (!authUser) return undefined

    const userId = getAppUserId(authUser)
    const now = Date.now()
    await ctx.db.insert("freemiusCustomers", {
        fsUserId,
        userId,
        email,
        createdAt: now,
        updatedAt: now
    })
    return userId
}

const syncCreditAccountPlan = async (ctx: MutationCtx, userId: string, now: number) => {
    const [lemonSqueezySubscriptions, freemiusPlan, account] = await Promise.all([
        ctx.db
            .query("lemonSqueezySubscriptions")
            .withIndex("byUser", (q) => q.eq("userId", userId))
            .collect(),
        getFreemiusPlanForUser(ctx, userId, now),
        ctx.db
            .query("prototypeCreditAccounts")
            .withIndex("byUser", (q) => q.eq("userId", userId))
            .first()
    ])
    // Lemon Squeezy keeps billing older subscriptions until 2027-03-31.
    const plan: BillingPlan =
        freemiusPlan === "pro" || getEffectiveBillingPlan(lemonSqueezySubscriptions) === "pro"
            ? "pro"
            : "free"

    if (account) {
        if (account.plan !== plan) {
            await ctx.db.patch(account._id, { plan, updatedAt: now })
        }
    } else {
        await ctx.db.insert("prototypeCreditAccounts", {
            userId,
            enabled: true,
            plan,
            creditPeriodAnchorAt: now,
            updatedAt: now
        })
    }

    return plan
}

// Replaces everything stored for one Freemius user with the state just read from
// the API. Safe to run any number of times, in any order.
export const applyFreemiusUserState = internalMutation({
    args: {
        fsUserId: v.string(),
        email: v.optional(v.string()),
        licenses: v.array(licenseSnapshot)
    },
    handler: async (ctx, { fsUserId, email, licenses }) => {
        const now = Date.now()
        const userId = await resolveUserId(ctx, fsUserId, email)
        const stored = await ctx.db
            .query("freemiusLicenses")
            .withIndex("byFsUserId", (q) => q.eq("fsUserId", fsUserId))
            .collect()
        const storedByLicenseId = new Map(stored.map((row) => [row.fsLicenseId, row]))
        const currentIds = new Set(licenses.map((license) => license.fsLicenseId))

        for (const license of licenses) {
            const next = { ...license, fsUserId, userId, syncedAt: now }
            const existing = storedByLicenseId.get(license.fsLicenseId)
            if (existing) {
                await ctx.db.replace(existing._id, next)
            } else {
                await ctx.db.insert("freemiusLicenses", next)
            }
        }
        // Licenses Freemius no longer returns were deleted on their side.
        for (const row of stored) {
            if (!currentIds.has(row.fsLicenseId)) {
                await ctx.db.delete(row._id)
            }
        }

        if (!userId) {
            return { status: "unbound" as const, licenses: licenses.length }
        }

        const plan = await syncCreditAccountPlan(ctx, userId, now)
        return { status: "synced" as const, userId, plan, licenses: licenses.length }
    }
})

// The single sync path: webhooks call it, and so will the post-checkout redirect.
export const syncFreemiusUser = internalAction({
    args: { fsUserId: v.string() },
    handler: async (
        ctx,
        { fsUserId }
    ): Promise<
        | { status: "unbound"; licenses: number }
        | { status: "synced"; userId: string; plan: "free" | "pro"; licenses: number }
    > => {
        const state = await fetchFreemiusUserState(fsUserId)
        const licenses: FreemiusLicenseSnapshot[] = state.licenses
        return await ctx.runMutation(internal.freemius.applyFreemiusUserState, {
            fsUserId,
            email: state.email,
            licenses
        })
    }
})
