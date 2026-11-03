import { components } from "../_generated/api"
import type { MutationCtx, QueryCtx } from "../_generated/server"

// True when an operator is viewing as this user. Such sessions must not spend the user's
// one-time things, like notices, appeals, or Banked Resets.
export const isImpersonatedSession = async (ctx: QueryCtx | MutationCtx, sessionId: unknown) => {
    if (typeof sessionId !== "string" || !sessionId) return false
    const session = await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "session",
        where: [{ field: "_id", value: sessionId }]
    })
    return Boolean((session as { impersonatedBy?: string | null } | null)?.impersonatedBy)
}
