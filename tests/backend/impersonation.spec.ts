import { convexTest } from "convex-test"
import { serializeSignedCookie } from "better-call"
import { createLocalJWKSet, decodeJwt, jwtVerify } from "jose"
import { beforeAll, describe, expect, it, vi } from "vitest"
import schema from "../../convex/schema"
import { components, api } from "../../convex/_generated/api"
import authSchema from "../../node_modules/@convex-dev/better-auth/dist/component/schema.js"
import { getUserIdentity } from "../../convex/lib/identity"

const modules = import.meta.glob("../../convex/**/*.ts")
// Exercise the shipped JS component that cloud deployments actually execute.
const authModules = import.meta.glob(
    "../../node_modules/@convex-dev/better-auth/dist/component/**/*.js"
)
const origin = "http://localhost:3000"
const secret = "impersonation-test-secret-at-least-thirty-two-characters"
let createAuth: typeof import("../../convex/auth").createAuth

beforeAll(async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", secret)
    vi.stubEnv("VITE_BETTER_AUTH_URL", origin)
    vi.stubEnv("VITE_CONVEX_SITE_URL", "https://test.convex.site")
    vi.stubEnv("JWKS", "")
    createAuth = (await import("../../convex/auth")).createAuth
})

async function setup() {
    vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site")
    const t = convexTest(schema, modules)
    t.registerComponent("betterAuth", authSchema, authModules)
    const createUser = async (email: string, extra = {}) => {
        const user = await t.mutation(components.betterAuth.adapter.create, {
            input: {
                model: "user",
                data: {
                    name: email,
                    email,
                    emailVerified: true,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    ...extra
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
        return { id: user._id as string, sessionId: session._id as string, cookie }
    }
    const owner = await createUser("owner@example.com")
    const customer = await createUser("customer@example.com", { userId: "legacy-app-user-id" })
    vi.stubEnv("AUTH_IMPERSONATION_USER_IDS", owner.id)
    const jar = new Map<string, string>()
    const setCookie = (cookie: string) => {
        const pair = cookie.split(";")[0]
        const split = pair.indexOf("=")
        jar.set(pair.slice(0, split), pair.slice(split + 1))
    }
    setCookie(owner.cookie)
    const request = async (path: string, body?: unknown) => {
        const result = await t.run(async (ctx) => {
            const response = await createAuth(ctx).handler(
                new Request(`${origin}/api/auth${path}`, {
                    method: body === undefined ? "GET" : "POST",
                    headers: {
                        origin,
                        "content-type": "application/json",
                        cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; ")
                    },
                    ...(body === undefined ? {} : { body: JSON.stringify(body) })
                })
            )
            return {
                status: response.status,
                body: await response.text(),
                cookies: response.headers.getSetCookie()
            }
        })
        for (const cookie of result.cookies) setCookie(cookie)
        return new Response(result.body, { status: result.status })
    }
    return { t, owner, customer, request, setCookie, jar, createUser }
}

describe("impersonation with the patched Convex auth component", () => {
    it("accepts legacy sessions, switches the session and Convex identity, and restores the owner", async () => {
        const { t, owner, customer, request, jar } = await setup()
        const activityId = await t.run((ctx) =>
            ctx.db.insert("accountActivities", {
                authUserId: customer.id,
                lastActiveAt: 1700000000000,
                inactivityNoticeState: "pending"
            })
        )
        const original = await request("/get-session")
        expect(original.status).toBe(200)
        expect((await original.json()).user.id).toBe(owner.id)
        const oldToken = (await (await request("/convex/token")).json()).token
        expect(decodeJwt(oldToken).sub).toBe(owner.id)

        const response = await request("/admin/impersonate-user", { userId: customer.id })
        expect(response.status).toBe(200)
        const impersonation = await response.json()
        expect(impersonation.session.impersonatedBy).toBe(owner.id)
        expect(impersonation.user.id).toBe(customer.id)
        expect(await t.run(async (ctx) => (await ctx.db.get(activityId))?.lastActiveAt)).toBe(
            1700000000000
        )
        expect(jar.get("better-auth.convex_jwt")).toBe("")
        const token = (await (await request("/convex/token")).json()).token
        const identity = decodeJwt(token)
        const jwks = await (await request("/convex/jwks")).json()
        await expect(
            jwtVerify(token, createLocalJWKSet(jwks), {
                issuer: "https://test.convex.site",
                audience: "convex"
            })
        ).resolves.toHaveProperty("payload.sub", customer.id)
        expect(identity.sub).toBe(customer.id)
        expect(identity.sessionId).toBe(impersonation.session.id)
        expect(
            await t
                .withIdentity({ ...identity, subject: identity.sub! })
                .run((ctx) => getUserIdentity(ctx.auth, { allowAnons: false }))
        ).toMatchObject({ id: "legacy-app-user-id", authId: customer.id })
        const user = await t
            .withIdentity({ ...identity, subject: identity.sub! })
            .query(api.auth.getCurrentUser, {})
        expect(user).toMatchObject({
            authId: customer.id,
            id: "legacy-app-user-id",
            canImpersonate: false
        })
        expect((await request("/admin/list-users")).status).toBe(403)

        const returned = await request("/admin/stop-impersonating", {})
        expect(returned.status).toBe(200)
        expect((await returned.json()).user.id).toBe(owner.id)
        expect(jar.get("better-auth.convex_jwt")).toBe("")
        const restored = decodeJwt((await (await request("/convex/token")).json()).token)
        expect(restored.sub).toBe(owner.id)
        expect(
            await t.query(components.betterAuth.adapter.findOne, {
                model: "session",
                where: [{ field: "_id", value: impersonation.session.id }]
            })
        ).toBeNull()
        expect(
            (
                await request(
                    "/admin/list-users?searchField=email&searchValue=customer&searchOperator=contains&limit=20"
                )
            ).status
        ).toBe(403)
    })

    it("denies non-allowlisted users, nested impersonation, and unrelated admin operations", async () => {
        const { owner, customer, request, setCookie, createUser } = await setup()
        expect(
            (await request("/admin/set-role", { userId: customer.id, role: "admin" })).status
        ).toBe(403)
        expect((await request("/admin/impersonate-user", { userId: owner.id })).status).toBe(403)
        setCookie(customer.cookie)
        expect((await request("/admin/list-users")).status).toBe(403)
        expect((await request("/admin/impersonate-user", { userId: owner.id })).status).toBe(403)
        const otherAdmin = await createUser("another-admin@example.com", { role: "admin" })
        setCookie(otherAdmin.cookie)
        expect((await request("/admin/impersonate-user", { userId: customer.id })).status).toBe(403)
        setCookie(owner.cookie)
        expect((await request("/admin/impersonate-user", { userId: customer.id })).status).toBe(200)
        expect((await request("/admin/impersonate-user", { userId: otherAdmin.id })).status).toBe(
            403
        )
        // Revoking operator access must not trap them in the customer's account.
        vi.stubEnv("AUTH_IMPERSONATION_USER_IDS", "")
        expect((await request("/admin/stop-impersonating", {})).status).toBe(200)
        expect((await request("/admin/list-users")).status).toBe(403)
    })
})

describe("exact impersonation lookup", () => {
    it("resolves email, auth ID and legacy ID to the same account with indexed activity and billing details", async () => {
        const { t, owner, customer } = await setup()
        await t.run(async (ctx) => {
            await ctx.db.insert("accountActivities", {
                authUserId: customer.id,
                lastActiveAt: 1700000000000,
                inactivityNoticeState: "pending"
            })
            await ctx.db.insert("prototypeCreditAccounts", {
                userId: "legacy-app-user-id",
                enabled: true,
                plan: "pro",
                updatedAt: 1
            })
            await ctx.db.insert("lemonSqueezySubscriptions", {
                userId: "legacy-app-user-id",
                lemonSqueezySubscriptionId: "sub-current",
                status: "active",
                plan: "pro",
                updatedAt: 1,
                lastEventId: "event-current"
            })
            await ctx.db.insert("lemonSqueezySubscriptions", {
                userId: "legacy-app-user-id",
                lemonSqueezySubscriptionId: "sub-old",
                status: "expired",
                plan: "free",
                updatedAt: 2,
                lastEventId: "event-old"
            })
        })
        const operator = t.withIdentity({ subject: owner.id, sessionId: owner.sessionId })
        for (const identifier of ["  CUSTOMER@EXAMPLE.COM  ", customer.id, "legacy-app-user-id"]) {
            expect(
                await operator.query(api.auth.lookupImpersonationUser, { identifier })
            ).toMatchObject({
                id: customer.id,
                email: "customer@example.com",
                lastActiveAt: 1700000000000,
                plan: "pro",
                subscriptionStatus: "active"
            })
        }
        expect(
            await operator.query(api.auth.lookupImpersonationUser, {
                identifier: "missing@example.com"
            })
        ).toBeNull()
        // Partial input must never enumerate matching users.
        expect(
            await operator.query(api.auth.lookupImpersonationUser, {
                identifier: "customer@example.co"
            })
        ).toBeNull()
    })

    it("requires a live operator session and rejects operator targets", async () => {
        const { t, owner, customer, createUser } = await setup()
        const args = { identifier: "customer@example.com" }
        await expect(t.query(api.auth.lookupImpersonationUser, args)).rejects.toThrow(
            "Impersonation access required"
        )
        await expect(
            t
                .withIdentity({ subject: customer.id, sessionId: customer.sessionId })
                .query(api.auth.lookupImpersonationUser, args)
        ).rejects.toThrow("Impersonation access required")
        await t.mutation(components.betterAuth.adapter.updateOne, {
            input: {
                model: "session",
                where: [{ field: "_id", value: owner.sessionId }],
                update: { expiresAt: Date.now() - 1 }
            }
        })
        await expect(
            t
                .withIdentity({ subject: owner.id, sessionId: owner.sessionId })
                .query(api.auth.lookupImpersonationUser, args)
        ).rejects.toThrow("Impersonation access required")
        const freshOwner = await createUser("fresh-owner@example.com")
        vi.stubEnv("AUTH_IMPERSONATION_USER_IDS", freshOwner.id)
        const operator = t.withIdentity({ subject: freshOwner.id, sessionId: freshOwner.sessionId })
        await expect(
            operator.query(api.auth.lookupImpersonationUser, { identifier: freshOwner.id })
        ).rejects.toThrow("Cannot impersonate an operator account")
        const admin = await createUser("admin@example.com", { role: "admin" })
        await expect(
            operator.query(api.auth.lookupImpersonationUser, { identifier: admin.id })
        ).rejects.toThrow("Cannot impersonate an operator account")
        await expect(
            operator.query(api.auth.lookupImpersonationUser, { identifier: " " })
        ).rejects.toThrow("Enter an email address or user ID")
    })
})
