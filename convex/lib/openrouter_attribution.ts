"use node"

const OPENROUTER_PRODUCTION_APP_URL = "https://silkchat.dev"
const OPENROUTER_PRODUCTION_APP_NAME = "SilkChat"
const OPENROUTER_LOCAL_APP_NAME = "SilkChat-Dev"
const OPENROUTER_APP_CATEGORIES = "general-chat"

const normalizeUrl = (value?: string) => {
    if (!value) return undefined

    const trimmedValue = value.trim()
    if (!trimmedValue) return undefined

    return trimmedValue.startsWith("http://") || trimmedValue.startsWith("https://")
        ? trimmedValue
        : `https://${trimmedValue}`
}

const isLocalUrl = (value: string) => {
    try {
        const { hostname } = new URL(value)
        return hostname === "localhost" || hostname === "127.0.0.1"
    } catch {
        return value.includes("localhost") || value.includes("127.0.0.1")
    }
}

const getOpenRouterAppUrl = () =>
    normalizeUrl(process.env.VITE_BETTER_AUTH_URL) ||
    (process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : OPENROUTER_PRODUCTION_APP_URL)

export const getOpenRouterAttribution = () => {
    const appUrl = getOpenRouterAppUrl()
    const isLocal = isLocalUrl(appUrl)

    return {
        appName: isLocal ? OPENROUTER_LOCAL_APP_NAME : OPENROUTER_PRODUCTION_APP_NAME,
        appUrl,
        headers: {
            "X-OpenRouter-Categories": OPENROUTER_APP_CATEGORIES
        }
    }
}
