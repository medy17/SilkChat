// Backs the dev dock's Moderation seed. Creates and removes fake accounts on the reserved
// seed.example domain with moderation cases for them. Rows are written directly and nothing
// is scheduled, so no email is sent.
import { ConvexError, v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import { type MutationCtx, type QueryCtx, mutation, query } from "./_generated/server"
import { authComponent, betterAuthComponent, getAppUserId } from "./auth"
import { canImpersonate } from "./lib/impersonation"
import {
    MODERATION_STRIKE_LIMIT,
    generateCaseId,
    getAccountStanding,
    getCaseState,
    getPolicyReference
} from "./lib/moderation"
import {
    MODERATION_SEED_SCENARIOS,
    type ModerationSeedScenarioId,
    type SeedScenario,
    type SeedScenarioFacts,
    getModerationSeedScenario,
    getSeedScenarioFacts,
    moderationSeedEmail
} from "./lib/seeds/moderation"
import { syncAuthRestriction } from "./moderation"

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
// How long a delivered email took to go out.
const DELIVERY_MS = 4000

// Convex reports NODE_ENV as "production" on every deployment, so dev tools share the flag
// that is set only on dev and staging.
const seedingEnabled = () => process.env.DEV_CREDIT_LAB_ENABLED === "1"

const getOperator = async (ctx: QueryCtx) => {
    const user = await authComponent.safeGetAuthUser(ctx)
    return user && canImpersonate(user._id) ? user : null
}

const requireSeedOperator = async (ctx: QueryCtx) => {
    if (!seedingEnabled()) {
        throw new ConvexError("Moderation seeding is turned off on this deployment")
    }
    const operator = await getOperator(ctx)
    if (!operator) throw new ConvexError("Moderator access required")
    return operator
}

type SeedUser = { _id: string; userId?: string | null }

const findSeedUser = async (ctx: QueryCtx, accountKey: string): Promise<SeedUser | null> =>
    await ctx.runQuery(betterAuthComponent.adapter.findOne, {
        model: "user",
        where: [{ field: "email", value: moderationSeedEmail(accountKey) }]
    })

const listCases = async (ctx: QueryCtx, authUserId: string) =>
    await ctx.db
        .query("moderationCases")
        .withIndex("byAuthUserCreatedAt", (q) => q.eq("authUserId", authUserId))
        .collect()

const listAppeals = async (ctx: QueryCtx, caseId: Id<"moderationCases">) =>
    await ctx.db
        .query("moderationAppeals")
        .withIndex("byCase", (q) => q.eq("caseId", caseId))
        .collect()

const listUpdates = async (ctx: QueryCtx, caseId: Id<"moderationCases">) =>
    await ctx.db
        .query("moderationCaseUpdates")
        .withIndex("byCaseCreatedAt", (q) => q.eq("caseId", caseId))
        .collect()

const getSeedAccountState = async (
    ctx: QueryCtx,
    account: SeedScenario["accounts"][number],
    now: number
) => {
    const user = await findSeedUser(ctx, account.key)
    if (!user) return null
    const cases = await listCases(ctx, user._id)
    const [appeals, updates, escalation] = await Promise.all([
        Promise.all(cases.map((moderationCase) => listAppeals(ctx, moderationCase._id))),
        Promise.all(cases.map((moderationCase) => listUpdates(ctx, moderationCase._id))),
        ctx.db
            .query("moderationEscalations")
            .withIndex("byAuthUserStatus", (q) => q.eq("authUserId", user._id).eq("status", "open"))
            .first()
    ])
    return {
        authUserId: user._id,
        name: account.name || null,
        email: moderationSeedEmail(account.key),
        standing: getAccountStanding(cases, now),
        cases: cases.length,
        activeCases: cases.filter(
            (moderationCase) => getCaseState(moderationCase, now) === "active"
        ).length,
        pendingAppeals: appeals.flat().filter((appeal) => appeal.status === "pending").length,
        failedDeliveries: cases.filter(
            (moderationCase, index) =>
                moderationCase.emailStatus === "failed" ||
                updates[index].some((update) => update.emailStatus === "failed")
        ).length,
        raisedForReview: Boolean(escalation)
    }
}

// What each scenario currently holds, which drifts from the seed as its cases are acted on.
export const getModerationSeedState = query({
    args: {},
    handler: async (ctx) => {
        if (!seedingEnabled()) return { available: false as const, reason: "disabled" as const }
        if (!(await getOperator(ctx))) {
            return { available: false as const, reason: "not_operator" as const }
        }
        const now = Date.now()
        const scenarios = await Promise.all(
            MODERATION_SEED_SCENARIOS.map(async (scenario: SeedScenario) => {
                const accounts = (
                    await Promise.all(
                        scenario.accounts.map((account) => getSeedAccountState(ctx, account, now))
                    )
                ).filter((account) => account !== null)
                const sum = (count: (account: (typeof accounts)[number]) => number) =>
                    accounts.reduce((total, account) => total + count(account), 0)
                const live: SeedScenarioFacts = {
                    accounts: accounts.length,
                    cases: sum((account) => account.cases),
                    activeCases: sum((account) => account.activeCases),
                    pendingAppeals: sum((account) => account.pendingAppeals),
                    failedDeliveries: sum((account) => account.failedDeliveries),
                    raisedForReview: sum((account) => (account.raisedForReview ? 1 : 0))
                }
                const seeded = getSeedScenarioFacts(scenario)
                const untouched = (Object.keys(seeded) as (keyof SeedScenarioFacts)[]).every(
                    (fact) => live[fact] === seeded[fact]
                )
                return {
                    id: scenario.id as ModerationSeedScenarioId,
                    status:
                        accounts.length === 0
                            ? ("absent" as const)
                            : untouched
                              ? ("fresh" as const)
                              : ("changed" as const),
                    accounts
                }
            })
        )
        return { available: true as const, scenarios }
    }
})

const clearScenario = async (ctx: MutationCtx, scenario: SeedScenario) => {
    for (const account of scenario.accounts) {
        const user = await findSeedUser(ctx, account.key)
        if (!user) continue
        for (const moderationCase of await listCases(ctx, user._id)) {
            const blocks = await ctx.db
                .query("moderationIdentityBlocks")
                .withIndex("byCase", (q) => q.eq("caseId", moderationCase._id))
                .collect()
            const rows = [
                ...(await listAppeals(ctx, moderationCase._id)),
                ...(await listUpdates(ctx, moderationCase._id)),
                ...blocks
            ]
            await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
            await ctx.db.delete(moderationCase._id)
        }
        for (const status of ["open", "resolved", "dismissed"] as const) {
            const escalations = await ctx.db
                .query("moderationEscalations")
                .withIndex("byAuthUserStatus", (q) =>
                    q.eq("authUserId", user._id).eq("status", status)
                )
                .collect()
            await Promise.all(escalations.map((escalation) => ctx.db.delete(escalation._id)))
        }
        // Signing in as a seed account, e.g. by viewing as it, leaves sessions behind.
        await ctx.runMutation(betterAuthComponent.adapter.deleteMany, {
            input: { model: "session", where: [{ field: "userId", value: user._id }] },
            paginationOpts: { numItems: 100, cursor: null }
        })
        await ctx.runMutation(betterAuthComponent.adapter.deleteOne, {
            input: { model: "user", where: [{ field: "_id", value: user._id }] }
        })
    }
}

const seedScenario = async (ctx: MutationCtx, scenario: SeedScenario, operatorId: string) => {
    const now = Date.now()
    const users = new Map<string, SeedUser>()
    for (const account of scenario.accounts) {
        users.set(
            account.key,
            await ctx.runMutation(betterAuthComponent.adapter.create, {
                input: {
                    model: "user",
                    data: {
                        name: account.name,
                        email: moderationSeedEmail(account.key),
                        emailVerified: true,
                        createdAt: now - 200 * DAY,
                        updatedAt: now - 200 * DAY
                    }
                }
            })
        )
    }

    for (const spec of scenario.cases) {
        const user = users.get(spec.account)
        if (!user) throw new ConvexError(`${scenario.id} has no account "${spec.account}"`)
        const name = scenario.accounts.find((account) => account.key === spec.account)?.name
        const createdAt = now - spec.ago
        const caseId = await ctx.db.insert("moderationCases", {
            caseId: generateCaseId(),
            userId: getAppUserId(user),
            authUserId: user._id,
            action: spec.action,
            category: spec.category,
            violation: spec.violation,
            policyReference: getPolicyReference(spec.category),
            contentAction: spec.contentAction,
            internalNote: spec.internalNote,
            recipientEmail: moderationSeedEmail(spec.account),
            recipientName: name || undefined,
            createdBy: operatorId,
            ...(spec.strikeNumber !== undefined
                ? { strikeNumber: spec.strikeNumber, strikeLimit: MODERATION_STRIKE_LIMIT }
                : {}),
            ...(spec.expiresAfterDays !== undefined
                ? { expiresAt: createdAt + spec.expiresAfterDays * DAY }
                : {}),
            ...(spec.endsAfterDays !== undefined
                ? { endsAt: createdAt + spec.endsAfterDays * DAY }
                : {}),
            status: spec.status ?? "active",
            ...(spec.resolvedAgo !== undefined
                ? { resolvedAt: now - spec.resolvedAgo, resolvedBy: operatorId }
                : {}),
            ...(spec.emailError
                ? { emailStatus: "failed" as const, emailAttempts: 4, emailError: spec.emailError }
                : {
                      emailStatus: "sent" as const,
                      emailAttempts: 1,
                      emailSentAt: createdAt + DELIVERY_MS
                  }),
            subscriptionCancellation: spec.subscriptionCancellation,
            // Seed accounts never sign in, so no notice is left waiting on them.
            ...(spec.action === "warning" || spec.action === "strike"
                ? { acknowledgedAt: createdAt + HOUR }
                : {}),
            createdAt,
            updatedAt: now - (spec.resolvedAgo ?? spec.ago)
        })

        if (spec.appeal) {
            await ctx.db.insert("moderationAppeals", {
                caseId,
                userId: getAppUserId(user),
                message: spec.appeal.message,
                status: spec.appeal.decision?.status ?? "pending",
                ...(spec.appeal.decision
                    ? {
                          decisionNote: spec.appeal.decision.note,
                          reviewedBy: operatorId,
                          reviewedAt: now - spec.appeal.decision.ago
                      }
                    : {}),
                createdAt: now - spec.appeal.ago
            })
        }
        for (const update of spec.updates ?? []) {
            await ctx.db.insert("moderationCaseUpdates", {
                caseId,
                kind: update.kind,
                viaAppeal: update.viaAppeal,
                note: update.note,
                restoresAccess: update.restoresAccess,
                ...(update.newEndInDays !== undefined
                    ? { newEnd: now + update.newEndInDays * DAY }
                    : {}),
                createdBy: operatorId,
                createdAt: now - update.ago,
                ...(update.emailError
                    ? {
                          emailStatus: "failed" as const,
                          emailAttempts: 4,
                          emailError: update.emailError
                      }
                    : {
                          emailStatus: "sent" as const,
                          emailAttempts: 1,
                          emailSentAt: now - update.ago + DELIVERY_MS
                      })
            })
        }
        if (spec.escalates) {
            await ctx.db.insert("moderationEscalations", {
                authUserId: user._id,
                reason: "strike_limit",
                caseId,
                status: "open",
                createdAt
            })
        }
    }

    // Suspended and banned seed accounts are refused at sign-in like real ones.
    for (const user of users.values()) await syncAuthRestriction(ctx, user._id)
}

const resolveScenarios = (scenarioIds: string[]) =>
    [...new Set(scenarioIds)].map((id) => {
        const scenario = getModerationSeedScenario(id)
        if (!scenario) throw new ConvexError(`Unknown scenario "${id}"`)
        return scenario
    })

// Seeding a scenario that is already there starts it over.
export const seedModerationScenarios = mutation({
    args: { scenarioIds: v.array(v.string()) },
    handler: async (ctx, { scenarioIds }) => {
        const operator = await requireSeedOperator(ctx)
        for (const scenario of resolveScenarios(scenarioIds)) {
            await clearScenario(ctx, scenario)
            await seedScenario(ctx, scenario, operator._id)
        }
    }
})

export const clearModerationScenarios = mutation({
    args: { scenarioIds: v.array(v.string()) },
    handler: async (ctx, { scenarioIds }) => {
        await requireSeedOperator(ctx)
        for (const scenario of resolveScenarios(scenarioIds)) await clearScenario(ctx, scenario)
    }
})
