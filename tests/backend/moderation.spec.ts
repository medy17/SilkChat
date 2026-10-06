import { convexTest } from "convex-test"
import { serializeSignedCookie } from "better-call"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import schema from "../../convex/schema"
import { api, components } from "../../convex/_generated/api"
import authSchema from "../../node_modules/@convex-dev/better-auth/dist/component/schema.js"
import { readRestrictionRedirect } from "../../convex/lib/moderation"

const sendEmail = vi.fn(
    async (_options: { to: string; subject: string; idempotencyKey?: string }) => ({})
)

vi.mock("../../src/lib/email", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../src/lib/email")>()),
    sendEmail: (options: { to: string; subject: string; idempotencyKey?: string }) =>
        sendEmail(options)
}))

const modules = import.meta.glob("../../convex/**/*.ts")
const authModules = import.meta.glob(
    "../../node_modules/@convex-dev/better-auth/dist/component/**/*.js"
)
const origin = "http://localhost:3000"
const secret = "moderation-test-secret-at-least-thirty-two-characters"
let createAuth: typeof import("../../convex/auth").createAuth

beforeAll(async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", secret)
    vi.stubEnv("VITE_BETTER_AUTH_URL", origin)
    vi.stubEnv("VITE_CONVEX_SITE_URL", "https://test.convex.site")
    vi.stubEnv("JWKS", "")
    createAuth = (await import("../../convex/auth")).createAuth
})

// Scheduled deliveries only run when a test drains them, never in the background of a
// later test.
beforeEach(() => {
    sendEmail.mockClear()
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
})

async function setup() {
    vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site")
    const t = convexTest(schema, modules)
    t.registerComponent("betterAuth", authSchema, authModules)
    const createUser = async (email: string) => {
        const user = await t.mutation(components.betterAuth.adapter.create, {
            input: {
                model: "user",
                data: {
                    name: email,
                    email,
                    emailVerified: true,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                }
            }
        })
        const token = crypto.randomUUID()
        const session = await t.mutation(components.betterAuth.adapter.create, {
            input: {
                model: "session",
                data: {
                    userId: user._id,
                    token,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    expiresAt: Date.now() + 86_400_000
                }
            }
        })
        const cookie = (
            await serializeSignedCookie("better-auth.session_token", token, secret)
        ).split(";")[0]
        const id = user._id as string
        return {
            id,
            sessionId: session._id as string,
            cookie,
            as: t.withIdentity({ subject: id, sessionId: session._id }),
            sessions: async () =>
                (
                    await t.query(components.betterAuth.adapter.findMany, {
                        model: "session",
                        where: [{ field: "userId", value: id }],
                        paginationOpts: { numItems: 10, cursor: null }
                    })
                ).page
        }
    }
    const operator = await createUser("operator@example.com")
    const customer = await createUser("customer@example.com")
    vi.stubEnv("AUTH_IMPERSONATION_USER_IDS", operator.id)
    const authRequest = async (cookie: string, path: string, body: unknown) =>
        await t.run(async (ctx) => {
            const response = await createAuth(ctx).handler(
                new Request(`${origin}/api/auth${path}`, {
                    method: "POST",
                    headers: { origin, "content-type": "application/json", cookie },
                    body: JSON.stringify(body)
                })
            )
            return { status: response.status, body: await response.json() }
        })
    const getAuthUser = async (id: string) =>
        await t.query(components.betterAuth.adapter.findOne, {
            model: "user",
            where: [{ field: "_id", value: id }]
        })
    return { t, operator, customer, createUser, authRequest, getAuthUser }
}

// The sign-in page reads redirect params after TanStack Router has JSON-parsed each one.
const asSearchValue = (value: string): unknown => {
    try {
        return JSON.parse(value)
    } catch {
        return value
    }
}

const banArgs = (authUserId: string) => ({
    authUserId,
    action: "ban" as const,
    category: "harassment",
    violation: "Repeated harassment of other users."
})

describe("moderation enforcement", () => {
    it("lets only operators act, and never on operator accounts", async () => {
        const { operator, customer } = await setup()
        await expect(
            customer.as.mutation(api.moderation.issueModerationAction, banArgs(operator.id))
        ).rejects.toThrow("Moderator access required")
        await expect(
            operator.as.mutation(api.moderation.issueModerationAction, banArgs(operator.id))
        ).rejects.toThrow("Operator accounts can't be moderated")
        await expect(
            customer.as.query(api.moderation.getUserModeration, { authUserId: customer.id })
        ).rejects.toThrow("Moderator access required")
    })

    it("bans sign the user out, refuse new sessions with the case notice, and block re-sign-up until lifted", async () => {
        const { t, operator, createUser, authRequest, getAuthUser } = await setup()
        const customer = await createUser("jane.doe@gmail.com")
        const { caseId } = await operator.as.mutation(
            api.moderation.issueModerationAction,
            banArgs(customer.id)
        )

        expect(await getAuthUser(customer.id)).toMatchObject({ banned: true, banExpires: null })
        expect(await customer.sessions()).toHaveLength(0)

        // Impersonation creates a session for the target, so it runs the same sign-in gate.
        const refused = await authRequest(operator.cookie, "/admin/impersonate-user", {
            userId: customer.id
        })
        expect(refused.status).toBe(403)
        // A refused OAuth session redirects with ?error=<code>&error_description=<message>.
        expect(
            readRestrictionRedirect(refused.body.code, asSearchValue(refused.body.message))
        ).toEqual({ caseId })

        // A Gmail alias is the same identity, as for account deletion.
        const signUpWithAlias = () =>
            t.run(async (ctx) =>
                (await createAuth(ctx).$context).internalAdapter.createUser({
                    email: "janedoe+again@gmail.com",
                    name: "Ban evader",
                    emailVerified: true
                })
            )
        const signUpRefusal = await signUpWithAlias().catch((error: Error) => error)
        expect(signUpRefusal).toMatchObject({ body: { code: "BANNED_USER" } })
        // Better Auth drops the code for refused sign-ups and redirects with
        // ?error=<message, spaces replaced with underscores>.
        expect(
            readRestrictionRedirect(
                asSearchValue((signUpRefusal as Error).message.split(" ").join("_")),
                undefined
            )
        ).toEqual({ caseId })

        const [banCase] = (await operator.as.query(api.moderation.getUserModeration, {
            authUserId: customer.id
        }))!.cases
        await operator.as.mutation(api.moderation.resolveModerationCase, {
            caseId: banCase.id,
            resolution: "lifted"
        })
        expect(await getAuthUser(customer.id)).toMatchObject({ banned: false })
        await expect(signUpWithAlias()).resolves.toMatchObject({
            email: "janedoe+again@gmail.com"
        })
    })

    it("refuses a second suspension while one is active", async () => {
        const { operator, customer, getAuthUser } = await setup()
        const suspend = () =>
            operator.as.mutation(api.moderation.issueModerationAction, {
                ...banArgs(customer.id),
                action: "suspension",
                suspensionDays: 7
            })
        await suspend()
        expect((await getAuthUser(customer.id))?.banExpires).toBeGreaterThan(Date.now())
        await expect(suspend()).rejects.toThrow("already suspended")
    })
})

describe("strikes and appeals", () => {
    it("numbers strikes, hides operator fields from the user, and drops overturned strikes from standing", async () => {
        const { t, operator, customer } = await setup()
        const strike = () =>
            operator.as.mutation(api.moderation.issueModerationAction, {
                authUserId: customer.id,
                action: "strike",
                category: "scraping",
                violation: "Automated bulk extraction.",
                internalNote: "Seen in request logs"
            })
        await strike()
        await strike()

        const safety = (await customer.as.query(api.moderation.getMySafety, {}))!
        expect(safety.standing).toMatchObject({ status: "strikes", activeStrikes: 2 })
        expect(safety.cases.map((item) => item.strikeNumber)).toEqual([2, 1])
        expect(safety.cases[0]).not.toHaveProperty("internalNote")
        expect(safety.cases[0]).not.toHaveProperty("recipientEmail")
        expect(safety.cases[0].policyAnchor).toBe("section-5-1")

        const firstStrike = safety.cases[1]
        await customer.as.mutation(api.moderation.submitModerationAppeal, {
            caseId: firstStrike.id,
            message: "This was a browser extension, not me."
        })
        await expect(
            customer.as.mutation(api.moderation.submitModerationAppeal, {
                caseId: firstStrike.id,
                message: "Again"
            })
        ).rejects.toThrow("can no longer be appealed")

        const [pending] = await operator.as.query(api.moderation.listPendingAppeals, {})
        await operator.as.mutation(api.moderation.decideModerationAppeal, {
            appealId: pending.appealId,
            decision: "overturned",
            decisionNote: "Confirmed it was an extension."
        })

        const after = (await customer.as.query(api.moderation.getMySafety, {}))!
        expect(after.standing.activeStrikes).toBe(1)
        expect(after.cases[1]).toMatchObject({
            state: "overturned",
            appeal: { status: "overturned" },
            updates: [
                {
                    kind: "overturned",
                    viaAppeal: true,
                    note: "Confirmed it was an extension."
                }
            ]
        })
        expect(after.cases[1].updates[0]).not.toHaveProperty("emailStatus")
        expect(
            await t.run(async (ctx) =>
                (await ctx.db.query("moderationAppeals").collect()).map((appeal) => appeal.status)
            )
        ).toEqual(["overturned"])
    })

    it("refuses appeals filed from an operator's impersonated session", async () => {
        const { t, operator, customer } = await setup()
        await operator.as.mutation(api.moderation.issueModerationAction, {
            authUserId: customer.id,
            action: "warning",
            category: "other",
            violation: "Spam."
        })
        const impersonated = await t.mutation(components.betterAuth.adapter.create, {
            input: {
                model: "session",
                data: {
                    userId: customer.id,
                    token: crypto.randomUUID(),
                    impersonatedBy: operator.id,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    expiresAt: Date.now() + 3_600_000
                }
            }
        })
        const [warning] = (await customer.as.query(api.moderation.getMySafety, {}))!.cases
        await expect(
            t
                .withIdentity({ subject: customer.id, sessionId: impersonated._id })
                .mutation(api.moderation.submitModerationAppeal, {
                    caseId: warning.id,
                    message: "Filed by the operator"
                })
        ).rejects.toThrow("viewing as this user")
    })
})

describe("moderation email delivery", () => {
    const deliver = async (t: Awaited<ReturnType<typeof setup>>["t"]) =>
        await t.finishAllScheduledFunctions(vi.runAllTimers)
    const caseRow = (t: Awaited<ReturnType<typeof setup>>["t"]) =>
        t.run(async (ctx) => (await ctx.db.query("moderationCases").collect())[0])

    it("sends with the moderation/<caseId> idempotency key", async () => {
        vi.stubEnv("EMAIL_PROVIDER", "local-only-mock")
        const { t, operator, customer } = await setup()
        const { caseId } = await operator.as.mutation(
            api.moderation.issueModerationAction,
            banArgs(customer.id)
        )
        await deliver(t)

        expect(sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                to: "customer@example.com",
                subject: "Your SilkChat account has been banned",
                idempotencyKey: `moderation/${caseId}`
            })
        )
        expect(await caseRow(t)).toMatchObject({
            emailStatus: "sent",
            subscriptionCancellation: "done"
        })
    })

    it("describes a ban shortened before its email went out as ending, not permanent", async () => {
        const { t, operator, customer } = await setup()
        await operator.as.mutation(api.moderation.issueModerationAction, banArgs(customer.id))
        const [ban] = (await operator.as.query(api.moderation.getUserModeration, {
            authUserId: customer.id
        }))!.cases
        await operator.as.mutation(api.moderation.changeModerationCaseEnd, {
            caseId: ban.id,
            days: 30
        })
        await deliver(t)

        const banEmail = sendEmail.mock.calls
            .map(([options]) => options as typeof options & { text: string })
            .find((options) => options.idempotencyKey === `moderation/${ban.caseId}`)
        expect(banEmail?.subject).toBe("Your SilkChat account has been suspended")
        expect(banEmail?.text).not.toContain("Permanent")
    })

    it("holds a ban email until the subscription is cancelled, then fails visibly", async () => {
        vi.stubEnv("LEMONSQUEEZY_API_KEY", "")
        const { t, operator, customer } = await setup()
        await t.run(async (ctx) => {
            await ctx.db.insert("lemonSqueezySubscriptions", {
                userId: customer.id,
                lemonSqueezySubscriptionId: "sub_1",
                status: "active",
                plan: "pro",
                updatedAt: Date.now(),
                lastEventId: "evt_1"
            })
        })
        await operator.as.mutation(api.moderation.issueModerationAction, banArgs(customer.id))
        await deliver(t)

        expect(sendEmail).not.toHaveBeenCalled()
        expect(await caseRow(t)).toMatchObject({
            emailStatus: "failed",
            subscriptionCancellation: "failed",
            emailError: expect.stringContaining("LEMONSQUEEZY_API_KEY")
        })
    })
})

describe("priority escalations", () => {
    const strike = (operator: Awaited<ReturnType<typeof setup>>["operator"], authUserId: string) =>
        operator.as.mutation(api.moderation.issueModerationAction, {
            authUserId,
            action: "strike",
            category: "scraping",
            violation: "Automated bulk extraction."
        })
    const openEscalations = (operator: Awaited<ReturnType<typeof setup>>["operator"]) =>
        operator.as.query(api.moderation.listModerationEscalations, {})

    it("raises an account once at the strike limit without restricting it, and resolves on suspension", async () => {
        const { operator, customer, getAuthUser } = await setup()
        await strike(operator, customer.id)
        await strike(operator, customer.id)
        expect(await openEscalations(operator)).toEqual([])

        const { caseId } = await strike(operator, customer.id)
        await strike(operator, customer.id)
        expect(await openEscalations(operator)).toMatchObject([
            {
                authUserId: customer.id,
                reason: "strike_limit",
                caseId,
                standing: { status: "strikes", activeStrikes: 4 }
            }
        ])
        expect((await getAuthUser(customer.id))?.banned).toBeFalsy()
        await expect(
            customer.as.query(api.moderation.listModerationEscalations, {})
        ).rejects.toThrow("Moderator access required")

        await operator.as.mutation(api.moderation.issueModerationAction, {
            ...banArgs(customer.id),
            action: "suspension",
            suspensionDays: 7
        })
        expect(await openEscalations(operator)).toEqual([])
    })

    it("resolves when an overturn drops the account under the limit, and can be dismissed", async () => {
        const { operator, customer, createUser } = await setup()
        for (let index = 0; index < 3; index += 1) await strike(operator, customer.id)
        const cases = (await operator.as.query(api.moderation.getUserModeration, {
            authUserId: customer.id
        }))!.cases
        await operator.as.mutation(api.moderation.resolveModerationCase, {
            caseId: cases[0].id,
            resolution: "overturned"
        })
        expect(await openEscalations(operator)).toEqual([])

        const other = await createUser("other@example.com")
        for (let index = 0; index < 3; index += 1) await strike(operator, other.id)
        const [escalation] = await openEscalations(operator)
        await operator.as.mutation(api.moderation.dismissModerationEscalation, {
            escalationId: escalation.escalationId
        })
        expect(await openEscalations(operator)).toEqual([])
    })
})

describe("case updates", () => {
    const DAY = 24 * 60 * 60 * 1000
    const issue = (
        operator: Awaited<ReturnType<typeof setup>>["operator"],
        authUserId: string,
        extra: {
            action?: "warning" | "strike" | "suspension" | "ban"
            suspensionDays?: number
        } = {}
    ) =>
        operator.as.mutation(api.moderation.issueModerationAction, {
            ...banArgs(authUserId),
            ...extra
        })
    const casesFor = async (
        operator: Awaited<ReturnType<typeof setup>>["operator"],
        authUserId: string
    ) => (await operator.as.query(api.moderation.getUserModeration, { authUserId }))!.cases

    it("records shortened or extended, and a shortened ban no longer blocks sign-up", async () => {
        const { operator, customer, getAuthUser } = await setup()
        await issue(operator, customer.id, { action: "suspension", suspensionDays: 30 })
        const [suspension] = await casesFor(operator, customer.id)
        await operator.as.mutation(api.moderation.changeModerationCaseEnd, {
            caseId: suspension.id,
            days: 7
        })
        expect((await getAuthUser(customer.id))?.banExpires).toBe(Date.now() + 7 * DAY)
        await operator.as.mutation(api.moderation.changeModerationCaseEnd, {
            caseId: suspension.id,
            days: 60
        })
        expect((await casesFor(operator, customer.id))[0].updates.map((u) => u.kind)).toEqual([
            "shortened",
            "extended"
        ])

        const other = await setup()
        await issue(other.operator, other.customer.id)
        const [ban] = await casesFor(other.operator, other.customer.id)
        await other.operator.as.mutation(api.moderation.changeModerationCaseEnd, {
            caseId: ban.id,
            days: 30
        })
        expect(
            await other.t.run((ctx) => ctx.db.query("moderationIdentityBlocks").collect())
        ).toEqual([])
        expect(
            (await other.customer.as.query(api.moderation.getMySafety, {}))?.standing
        ).toMatchObject({ status: "suspended", endsAt: Date.now() + 30 * DAY })
    })

    it("emails each change once, and says access is restored only when nothing else restricts it", async () => {
        const { t, operator, customer, createUser } = await setup()
        // Customer: suspension and ban. Lifting the suspension leaves the ban in force.
        await issue(operator, customer.id, { action: "suspension", suspensionDays: 7 })
        await issue(operator, customer.id)
        const [ban, suspension] = await casesFor(operator, customer.id)
        await operator.as.mutation(api.moderation.resolveModerationCase, {
            caseId: suspension.id,
            resolution: "lifted"
        })
        await operator.as.mutation(api.moderation.resolveModerationCase, {
            caseId: ban.id,
            resolution: "overturned",
            note: "Mistaken identity."
        })

        // Another user appeals a warning and the operator upholds it.
        const warned = await createUser("warned@example.com")
        await issue(operator, warned.id, { action: "warning" })
        const [warning] = (await warned.as.query(api.moderation.getMySafety, {}))!.cases
        await warned.as.mutation(api.moderation.submitModerationAppeal, {
            caseId: warning.id,
            message: "Not me"
        })
        const [pending] = await operator.as.query(api.moderation.listPendingAppeals, {})
        await operator.as.mutation(api.moderation.decideModerationAppeal, {
            appealId: pending.appealId,
            decision: "upheld"
        })

        sendEmail.mockClear()
        await t.finishAllScheduledFunctions(vi.runAllTimers)
        const sent = sendEmail.mock.calls.map(([options]) => options)
        const updates = sent.filter((options) => options.idempotencyKey?.split("/").length === 3)
        expect(updates.map((options) => options.subject).sort()).toEqual(
            [
                "We've withdrawn a ban on your account",
                "Your suspension has ended early",
                "Your appeal was reviewed"
            ].sort()
        )
        const retracted = updates.find((options) => options.subject.startsWith("We've withdrawn"))
        expect(retracted).toMatchObject({ to: "customer@example.com" })
        expect((retracted as unknown as { text: string }).text).toContain(
            "You can sign in again now."
        )
        expect((retracted as unknown as { text: string }).text).toContain("Mistaken identity.")
    })
})
