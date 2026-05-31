import { loadServerEnv } from "@/lib/load-server-env"
import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start"

loadServerEnv()

const getRequiredEnv = (name: keyof NodeJS.ProcessEnv) => {
    const value = process.env[name]?.trim()
    if (!value) {
        throw new Error(`Missing required auth server environment variable: ${name}`)
    }
    return value
}

export const authServer = convexBetterAuthReactStart({
    basePath: "/api/auth",
    convexUrl: getRequiredEnv("VITE_CONVEX_URL"),
    convexSiteUrl: getRequiredEnv("VITE_CONVEX_SITE_URL")
})
