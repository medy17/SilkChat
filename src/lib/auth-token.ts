import { authClient } from "@/lib/auth-client"

const DEFAULT_MIN_TOKEN_LIFETIME_SECONDS = 120

const decodeBase64Url = (value: string) => {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))
    const base64 = `${normalized}${padding}`

    if (typeof atob === "function") {
        return atob(base64)
    }

    return Buffer.from(base64, "base64").toString("utf8")
}

const parseJwtPayload = (token: string): Record<string, unknown> | null => {
    const parts = token.split(".")
    if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
        return null
    }

    try {
        const parsed = JSON.parse(decodeBase64Url(parts[1]))
        return typeof parsed === "object" && parsed !== null
            ? (parsed as Record<string, unknown>)
            : null
    } catch {
        return null
    }
}

const hasRemainingLifetime = (token: string, minRemainingSeconds: number) => {
    const payload = parseJwtPayload(token)
    if (!payload) return false
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
        return true
    }
    return payload.exp - Date.now() / 1000 > minRemainingSeconds
}

export const isJwtToken = (token: string | null | undefined): token is string => {
    if (typeof token !== "string") {
        return false
    }

    return parseJwtPayload(token.trim()) !== null
}

export const resolveJwtToken = async (
    token: string | null | undefined,
    options?: { forceRefresh?: boolean; minRemainingSeconds?: number }
) => {
    const normalizedToken = token?.trim()
    const minRemainingSeconds = options?.minRemainingSeconds ?? DEFAULT_MIN_TOKEN_LIFETIME_SECONDS

    if (
        !options?.forceRefresh &&
        isJwtToken(normalizedToken) &&
        hasRemainingLifetime(normalizedToken, minRemainingSeconds)
    ) {
        return normalizedToken
    }

    const fallbackToken =
        isJwtToken(normalizedToken) && hasRemainingLifetime(normalizedToken, 0)
            ? normalizedToken
            : undefined

    try {
        const response = await authClient.convex.token({
            fetchOptions: {
                throw: false
            }
        })
        const fetchedToken = response.data?.token?.trim()
        if (isJwtToken(fetchedToken)) {
            return fetchedToken
        }

        return fallbackToken
    } catch {
        return fallbackToken
    }
}
