import { createClient } from "@convex-dev/better-auth"
import type { ComponentApi as BetterAuthComponentApi } from "@convex-dev/better-auth/_generated/component.js"
import { convex } from "@convex-dev/better-auth/plugins"
import { betterAuth } from "better-auth"
import { components } from "./_generated/api.js"
import { internalAction, query } from "./_generated/server"
import authConfig from "./auth.config"

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

const baseURL = getEnv("VITE_BETTER_AUTH_URL") || "http://localhost:3000"
const betterAuthSecret = getEnv("BETTER_AUTH_SECRET")
const googleClientId = getEnv("GOOGLE_CLIENT_ID")
const googleClientSecret = getEnv("GOOGLE_CLIENT_SECRET")
const convexSiteUrl = getEnv("VITE_CONVEX_SITE_URL")
const staticJwks = getEnv("JWKS")
const isLocalAuthRuntime =
    baseURL.includes("localhost") ||
    baseURL.includes("127.0.0.1") ||
    convexSiteUrl?.includes("localhost") ||
    convexSiteUrl?.includes("127.0.0.1")

export const authComponent = createClient(betterAuthComponent)

export const createAuth = (ctx: Parameters<typeof authComponent.adapter>[0]) =>
    betterAuth({
        secret: betterAuthSecret,
        baseURL,
        basePath: "/api/auth",
        rateLimit: {
            enabled: !isLocalAuthRuntime
        },
        advanced: {
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
            baseURL,
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

export const rotateKeys = internalAction({
    args: {},
    handler: async (ctx) => {
        const auth = createAuth(ctx as unknown as Parameters<typeof createAuth>[0])
        return await auth.api.rotateKeys()
    }
})
