import { createIsomorphicFn } from "@tanstack/react-start"
import {
    appendResponseHeader,
    getRequestHeader,
    setResponseHeader
} from "@tanstack/react-start/server"
import type { BootAuthState } from "@/lib/boot-auth"

const COOKIE_PREFIX = "better-auth"
// Convex refreshes the token itself before expiry; a token this close to it isn't worth
// handing over.
const MIN_TOKEN_LIFETIME_SECONDS = 120

const parseCookieHeader = (header: string) => {
    const cookies = new Map<string, string>()
    for (const part of header.split(";")) {
        const separator = part.indexOf("=")
        if (separator <= 0) continue
        const name = part.slice(0, separator).trim()
        if (!name || cookies.has(name)) continue
        const raw = part.slice(separator + 1).trim()
        try {
            cookies.set(name, decodeURIComponent(raw))
        } catch {
            cookies.set(name, raw)
        }
    }
    return cookies
}

// Mirrors better-auth's getSessionCookie lookup: secure-prefixed first, then the plain
// name, in both the dotted and the dashed spelling.
const getAuthCookie = (cookies: Map<string, string>, name: string) => {
    const get = (cookieName: string) =>
        cookies.get(`__Secure-${cookieName}`) ?? cookies.get(cookieName)
    return get(`${COOKIE_PREFIX}.${name}`) || get(`${COOKIE_PREFIX}-${name}`) || null
}

const readFreshJwt = (token: string | null) => {
    if (!token) return null
    try {
        const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString())
        const exp = typeof payload?.exp === "number" ? payload.exp : 0
        return exp - Date.now() / 1000 > MIN_TOKEN_LIFETIME_SECONDS ? token : null
    } catch {
        return null
    }
}

/**
 * The boot auth state a request's cookies imply. No network: a session cookie means a
 * returning signed-in user (better-auth clears it on sign-out and expires it with the
 * session), and `get-session` re-mints the Convex JWT cookie on every visit, so a recent
 * user's token is usually already here. The client verifies both straight away.
 */
export const readBootAuthFromCookieHeader = (cookieHeader: string): BootAuthState => {
    const cookies = parseCookieHeader(cookieHeader)
    if (!getAuthCookie(cookies, "session_token")) return { hasSession: false, convexToken: null }
    return {
        hasSession: true,
        convexToken: readFreshJwt(getAuthCookie(cookies, "convex_jwt"))
    }
}

export const readBootAuthFromRequest = createIsomorphicFn()
    .server((): BootAuthState => {
        const bootAuth = readBootAuthFromCookieHeader(getRequestHeader("cookie") ?? "")
        try {
            // Every page now depends on the cookies (signed-out pages skip /get-session), so
            // no cache may serve one visitor's page for another set of cookies.
            appendResponseHeader("Vary", "Cookie")
            // Signed-in pages carry per-user state, so nothing may keep them at all.
            if (bootAuth.hasSession) setResponseHeader("Cache-Control", "private, no-store")
        } catch {}
        return bootAuth
    })
    .client((): BootAuthState | undefined => undefined)
