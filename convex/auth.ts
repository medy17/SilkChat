import { createClient } from "@convex-dev/better-auth"
import type { ComponentApi as BetterAuthComponentApi } from "@convex-dev/better-auth/_generated/component.js"
import { convex } from "@convex-dev/better-auth/plugins"
import { betterAuth } from "better-auth"
import { admin } from "better-auth/plugins/admin"
import { ConvexError, v } from "convex/values"
import { components, internal } from "./_generated/api.js"
import type { DataModel } from "./_generated/dataModel.js"
import { type QueryCtx, internalAction, query } from "./_generated/server"
import authConfig from "./auth.config"
import { recordAuthenticatedActivity, removeAccountActivity } from "./lib/account_activity"
import { restoreDeletedAccountCreditsForIdentity } from "./lib/account_deletion_restore"
import { buildAuthBaseURLConfig, hasLoopbackAuthHost } from "./lib/auth_origins"
import { canImpersonate, getImpersonationUserIds, impersonationHooks } from "./lib/impersonation"
import { selectEffectiveSubscription } from "./lib/lemon_squeezy"
import { moderationGate } from "./lib/moderation_gate"

export const betterAuthComponent = (
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

export const getAppUserId = (user: { _id: string; userId?: string | null }) =>
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
                    if (user.email) {
                        await ctx.scheduler.runAfter(
                            0,
                            internal.account_activity_node.deliverWelcomeEmail,
                            {
                                authUserId: user._id,
                                email: user.email,
                                ...(user.name ? { name: user.name } : {})
                            }
                        )
                    }
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
                    if (session.impersonatedBy) return
                    await recordAuthenticatedActivity(ctx, session.userId)
                },
                onUpdate: async (ctx, session) => {
                    if (session.impersonatedBy) return
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
        hooks: impersonationHooks,
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
            // Must precede admin(): plugin hooks run in order and the first rejection wins.
            moderationGate(ctx),
            admin({ adminUserIds: getImpersonationUserIds() }),
            convex({
                authConfig,
                jwks: staticJwks,
                options: {
                    basePath: "/api/auth"
                }
            })
        ]
    })

type AuthUser = NonNullable<Awaited<ReturnType<typeof authComponent.safeGetAuthUser>>>

export const isOperatorAuthUser = (user: { _id: string; role?: string | null }) =>
    canImpersonate(user._id) || Boolean(user.role?.split(",").includes("admin"))

// Exact email uses email_name; legacy app IDs use userId. Auth IDs use db.get
// inside the component adapter. Never load or filter the full user table.
export const findAuthUserByIdentifier = async (
    ctx: QueryCtx,
    identifier: string
): Promise<AuthUser | null> => {
    const value = identifier.trim()
    if (!value || value.length > 320) throw new ConvexError("Enter an email address or user ID")

    let user: AuthUser | null = await ctx.runQuery(betterAuthComponent.adapter.findOne, {
        model: "user",
        where: [
            {
                field: value.includes("@") ? "email" : "userId",
                value: value.includes("@") ? value.toLowerCase() : value
            }
        ]
    })
    if (!user && !value.includes("@")) {
        try {
            user = await ctx.runQuery(betterAuthComponent.adapter.findOne, {
                model: "user",
                where: [{ field: "_id", value }]
            })
        } catch {
            throw new ConvexError("Could not look up that user ID. Check it and try again.")
        }
    }
    return user
}

export const getAuthUserSummary = async (ctx: QueryCtx, user: AuthUser) => {
    const appUserId = getAppUserId(user)
    const [activity, account, subscriptions] = await Promise.all([
        ctx.db
            .query("accountActivities")
            .withIndex("byAuthUserId", (q) => q.eq("authUserId", user._id))
            .unique(),
        ctx.db
            .query("prototypeCreditAccounts")
            .withIndex("byUser", (q) => q.eq("userId", appUserId))
            .first(),
        ctx.db
            .query("lemonSqueezySubscriptions")
            .withIndex("byUser", (q) => q.eq("userId", appUserId))
            .collect()
    ])
    const subscription = selectEffectiveSubscription(subscriptions)
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        image: user.image ?? null,
        lastActiveAt: activity?.lastActiveAt ?? null,
        plan: account?.plan ?? "free",
        subscriptionStatus: subscription?.status ?? null
    }
}

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
            canImpersonate: canImpersonate(user._id),
            canModerate: canImpersonate(user._id),
            id:
                typeof user.userId === "string" && user.userId.trim().length > 0
                    ? user.userId
                    : user._id,
            authId: user._id
        }
    }
})

export const lookupImpersonationUser = query({
    args: { identifier: v.string() },
    handler: async (ctx, { identifier }) => {
        const operator = await authComponent.safeGetAuthUser(ctx)
        if (!operator || !canImpersonate(operator._id)) {
            throw new ConvexError("Impersonation access required")
        }
        const user = await findAuthUserByIdentifier(ctx, identifier)
        if (!user) return null
        if (isOperatorAuthUser(user)) {
            throw new ConvexError("Cannot impersonate an operator account")
        }
        return await getAuthUserSummary(ctx, user)
    }
})

export const rotateKeys = internalAction({
    args: {},
    handler: async (ctx) => {
        const auth = createAuth(ctx as unknown as Parameters<typeof createAuth>[0])
        return await auth.api.rotateKeys()
    }
})
