import { authClient } from "@/lib/auth-client"

const decodeBase64Url = (value: string) => {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))
    const base64 = `${normalized}${padding}`

    if (typeof atob === "function") {
        return atob(base64)
    }

    return Buffer.from(base64, "base64").toString("utf8")
}

export const isJwtToken = (token: string | null | undefined): token is string => {
    if (typeof token !== "string") {
        return false
    }

    const normalizedToken = token.trim()
    const parts = normalizedToken.split(".")
    if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
        return false
    }

    try {
        JSON.parse(decodeBase64Url(parts[1]))
        return true
    } catch {
        return false
    }
}

export const resolveJwtToken = async (token: string | null | undefined) => {
    const normalizedToken = token?.trim()

    if (isJwtToken(normalizedToken)) {
        return normalizedToken
    }

    try {
        const response = await authClient.$fetch<{ token?: string }>("/token")
        const fetchedToken = response.data?.token?.trim()
        return isJwtToken(fetchedToken) ? fetchedToken : undefined
    } catch {
        return undefined
    }
}
