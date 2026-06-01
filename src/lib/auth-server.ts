import { loadServerEnv } from "@/lib/load-server-env"
import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start"
import { ConvexError } from "convex/values"

loadServerEnv()

const getRequiredEnv = (name: keyof NodeJS.ProcessEnv) => {
    const value = process.env[name]?.trim()
    if (!value) {
        throw new Error(`Missing required auth server environment variable: ${name}`)
    }
    return value
}

const isAuthError = (error: unknown) => {
    const message =
        (error instanceof ConvexError && typeof error.data === "string" && error.data) ||
        (error instanceof Error && error.message) ||
        ""

    return /auth|unauth/i.test(message)
}

export const authServer = convexBetterAuthReactStart({
    basePath: "/api/auth",
    convexUrl: getRequiredEnv("VITE_CONVEX_URL"),
    convexSiteUrl: getRequiredEnv("VITE_CONVEX_SITE_URL"),
    jwtCache: {
        enabled: true,
        isAuthError
    }
})
