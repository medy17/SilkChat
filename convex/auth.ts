import { createClient } from "@convex-dev/better-auth"
import type { ComponentApi as BetterAuthComponentApi } from "@convex-dev/better-auth/_generated/component.js"
import { convex } from "@convex-dev/better-auth/plugins"
import { betterAuth } from "better-auth"
import { components, internal } from "./_generated/api.js"
import type { DataModel } from "./_generated/dataModel.js"
import { internalAction, mutation, query } from "./_generated/server"
import authConfig from "./auth.config"
import { recordAuthenticatedActivity, removeAccountActivity } from "./lib/account_activity"
import { restoreDeletedAccountCreditsForIdentity } from "./lib/account_deletion_restore"
import { buildAuthBaseURLConfig, hasLoopbackAuthHost } from "./lib/auth_origins"
import { getUserIdentity } from "./lib/identity"

const RECIPE_VISUAL_RATE_LIMIT = 30
const RECIPE_VISUAL_RATE_WINDOW_MS = 10 * 60 * 1000

const betterAuthComponent = (
    components as typeof components & {
        betterAuth: BetterAuthComponentApi<"betterAuth">
    }
).betterAuth

const normalizeOrigin = (value?: string) => {
    if (!value) return undefined
    const trimmedValue = value.trim()
    if (!trimmedValue) return undefined
    return trimmedValue.startsWith("http://") || trimmedValue.startsWith("https://")
        ? trimmedValue
        : `https://${trimmedValue}`
}

const isDefined = <T>(value: T | undefined): value is T => value !== undefined

const getEnv = (name: keyof NodeJS.ProcessEnv) => {
    const value = process.env[name]
    return value?.trim() || undefined
}

const canonicalBaseURL = getEnv("VITE_BETTER_AUTH_URL") || "http://localhost:3000"
const authBaseURLConfig = buildAuthBaseURLConfig(
    canonicalBaseURL,
    getEnv("BETTER_AUTH_ADDITIONAL_HOSTS")
)
const betterAuthSecret = getEnv("BETTER_AUTH_SECRET")
const googleClientId = getEnv("GOOGLE_CLIENT_ID")
const googleClientSecret = getEnv("GOOGLE_CLIENT_SECRET")
const convexSiteUrl = getEnv("VITE_CONVEX_SITE_URL")
const staticJwks = getEnv("JWKS")
const isLocalAuthRuntime =
    hasLoopbackAuthHost(authBaseURLConfig.allowedHosts) ||
    convexSiteUrl?.includes("localhost") ||
    convexSiteUrl?.includes("127.0.0.1")

const getAppUserId = (user: { _id: string; userId?: string | null }) =>
    typeof user.userId === "string" && user.userId.trim().length > 0 ? user.userId : user._id

type AuthUserLookup = {
    _id: string
    userId?: string | null
    email?: string | null
}

const getAuthUserById = async (
    ctx: {
        runQuery: (query: unknown, args: unknown) => Promise<AuthUserLookup | null>
    },
    authId: string
) =>
    await ctx.runQuery(betterAuthComponent.adapter.findOne, {
        model: "user",
        where: [{ field: "_id", value: authId }]
    })

export const authComponent: ReturnType<typeof createClient<DataModel>> = createClient(
    betterAuthComponent,
    {
        triggers: {
            user: {
                onCreate: async (ctx, user) => {
                    await recordAuthenticatedActivity(ctx, user._id)
                    await restoreDeletedAccountCreditsForIdentity(ctx, {
                        userId: getAppUserId(user),
                        email: user.email
                    })
                },
                onUpdate: async (ctx, user) => {
                    await recordAuthenticatedActivity(ctx, user._id)
                    await restoreDeletedAccountCreditsForIdentity(ctx, {
                        userId: getAppUserId(user),
                        email: user.email
                    })
                },
                onDelete: async (ctx, user) => {
                    await removeAccountActivity(ctx, user._id)
                }
            },
            session: {
                onCreate: async (ctx, session) => {
                    await recordAuthenticatedActivity(ctx, session.userId)
                },
                onUpdate: async (ctx, session) => {
                    await recordAuthenticatedActivity(ctx, session.userId)
                }
            },
            account: {
                onCreate: async (ctx, account) => {
                    if (account.providerId !== "google") return

                    const user = await getAuthUserById(
                        ctx as unknown as Parameters<typeof getAuthUserById>[0],
                        account.userId
                    )
                    if (!user?.email) return

                    await restoreDeletedAccountCreditsForIdentity(ctx, {
                        userId: getAppUserId(user),
                        email: user.email,
                        googleSub: account.accountId
                    })
                },
                onUpdate: async (ctx, account) => {
                    if (account.providerId !== "google") return

                    const user = await getAuthUserById(
                        ctx as unknown as Parameters<typeof getAuthUserById>[0],
                        account.userId
                    )
                    if (!user?.email) return

                    await restoreDeletedAccountCreditsForIdentity(ctx, {
                        userId: getAppUserId(user),
                        email: user.email,
                        googleSub: account.accountId
                    })
                }
            }
        },
        authFunctions: {
            onCreate: internal.auth.onAuthModelCreate,
            onUpdate: internal.auth.onAuthModelUpdate,
            onDelete: internal.auth.onAuthModelDelete
        }
    }
)

export const {
    onCreate: onAuthModelCreate,
    onUpdate: onAuthModelUpdate,
    onDelete: onAuthModelDelete
} = authComponent.triggersApi()

export const createAuth = (ctx: Parameters<typeof authComponent.adapter>[0]) =>
    betterAuth({
        secret: betterAuthSecret,
        baseURL: authBaseURLConfig.baseURL,
        basePath: "/api/auth",
        rateLimit: {
            enabled: !isLocalAuthRuntime
        },
        advanced: {
            trustedProxyHeaders: true,
            ipAddress: {
                ipAddressHeaders: [
                    "x-forwarded-for",
                    "x-real-ip",
                    "cf-connecting-ip",
                    "true-client-ip"
                ]
            }
        },
        trustedOrigins: [
            canonicalBaseURL,
            convexSiteUrl,
            normalizeOrigin(getEnv("VERCEL_URL")),
            "http://localhost:3000",
            "https://localhost:3000"
        ].filter(isDefined),
        database: authComponent.adapter(ctx),
        socialProviders:
            googleClientId && googleClientSecret
                ? {
                      google: {
                          clientId: googleClientId,
                          clientSecret: googleClientSecret
                      }
                  }
                : {},
        plugins: [
            convex({
                authConfig,
                jwks: staticJwks,
                options: {
                    basePath: "/api/auth"
                }
            })
        ]
    })

export const getCurrentUser = query({
    args: {},
    handler: async (ctx) => {
        const user = await authComponent.safeGetAuthUser(
            ctx as Parameters<typeof authComponent.safeGetAuthUser>[0]
        )
        if (!user) {
            return null
        }

        return {
            ...user,
            id:
                typeof user.userId === "string" && user.userId.trim().length > 0
                    ? user.userId
                    : user._id,
            authId: user._id
        }
    }
})

export const consumeRecipeVisualSearchQuota = mutation({
    args: {},
    handler: async (ctx) => {
        const identity = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in identity) {
            return { allowed: false, retryAfterSeconds: 0, unauthorized: true }
        }

        const now = Date.now()
        const key = `recipe-visuals:${identity.id}`
        const existing = await ctx.db
            .query("rateLimit")
            .withIndex("key", (q) => q.eq("key", key))
            .first()

        if (!existing || now - existing.lastRequest >= RECIPE_VISUAL_RATE_WINDOW_MS) {
            if (existing) {
                await ctx.db.patch(existing._id, { count: 1, lastRequest: now })
            } else {
                await ctx.db.insert("rateLimit", { key, count: 1, lastRequest: now })
            }
            return { allowed: true, retryAfterSeconds: 0, unauthorized: false }
        }

        if (existing.count >= RECIPE_VISUAL_RATE_LIMIT) {
            return {
                allowed: false,
                retryAfterSeconds: Math.max(
                    1,
                    Math.ceil((RECIPE_VISUAL_RATE_WINDOW_MS - (now - existing.lastRequest)) / 1000)
                ),
                unauthorized: false
            }
        }

        await ctx.db.patch(existing._id, { count: existing.count + 1 })
        return { allowed: true, retryAfterSeconds: 0, unauthorized: false }
    }
})

export const rotateKeys = internalAction({
    args: {},
    handler: async (ctx) => {
        const auth = createAuth(ctx as unknown as Parameters<typeof createAuth>[0])
        return await auth.api.rotateKeys()
    }
})
