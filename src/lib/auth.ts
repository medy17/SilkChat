import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { tanstackStartCookies } from "better-auth/tanstack-start"

import { db } from "@/database/db"
import * as schema from "@/database/schema"
import { loadServerEnv } from "@/lib/load-server-env"
import { getUserCreditPlan } from "@/lib/user-subscription"
import { jwt } from "better-auth/plugins/jwt"

loadServerEnv()

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

export const auth = betterAuth({
    secret: betterAuthSecret,
    trustedOrigins: [
        baseURL,
        normalizeOrigin(getEnv("VERCEL_URL")),
        "http://localhost:3000",
        "https://localhost:3000"
    ].filter(isDefined),
    baseURL,

    database: drizzleAdapter(db, {
        provider: "pg",
        usePlural: true,
        schema
    }),
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
        tanstackStartCookies(),
        jwt({
            jwt: {
                audience: "intern3",
                expirationTime: "6h",
                definePayload: async (session) => ({
                    ...session.user,
                    creditPlan: await getUserCreditPlan(session.user.id)
                })
            },
            jwks: {
                disablePrivateKeyEncryption: true,
                keyPairConfig: {
                    alg: "RS256",
                    modulusLength: 2048,
                    extractable: true
                }
            }
        })
    ]
})
