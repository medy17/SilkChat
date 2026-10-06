import { JWT_COOKIE_NAME } from "@convex-dev/better-auth/plugins"
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api"

// Auth IDs are deployment-specific. Staff/usage bypass flags never grant this permission.
export const getImpersonationUserIds = () =>
    (process.env.AUTH_IMPERSONATION_USER_IDS ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)

export const canImpersonate = (authId: string) => getImpersonationUserIds().includes(authId)

const switchPaths = new Set(["/admin/impersonate-user", "/admin/stop-impersonating"])

export const impersonationHooks = {
    before: createAuthMiddleware(async (ctx) => {
        if (!ctx.path?.startsWith("/admin/")) return
        // Better Auth validates the saved original session when returning. Allow returning
        // even if the operator was removed from the allowlist during an impersonation.
        if (ctx.path === "/admin/stop-impersonating") return

        const session = await getSessionFromCtx(ctx)
        if (
            !session ||
            !canImpersonate(session.user.id) ||
            (session.session as { impersonatedBy?: string | null }).impersonatedBy ||
            ctx.path !== "/admin/impersonate-user"
        ) {
            throw new APIError("FORBIDDEN", { message: "Impersonation access required" })
        }
        if (ctx.path === "/admin/impersonate-user" && typeof ctx.body?.userId === "string") {
            const target = await ctx.context.internalAdapter.findUserById(ctx.body.userId)
            if (
                target &&
                (canImpersonate(target.id) ||
                    (target as { role?: string }).role?.split(",").includes("admin"))
            ) {
                throw new APIError("FORBIDDEN", {
                    message: "Cannot impersonate an operator account"
                })
            }
        }
    }),
    after: createAuthMiddleware(async (ctx) => {
        if (!ctx.path || !switchPaths.has(ctx.path) || !ctx.context.newSession) return
        // The Convex plugin refreshes this cookie on sign-in/get-session, but not on
        // impersonation. Never let SSR reuse the previous account's cached JWT.
        const cookie = ctx.context.createAuthCookie(JWT_COOKIE_NAME, { maxAge: 0 })
        ctx.setCookie(cookie.name, "", cookie.attributes)
    })
}
