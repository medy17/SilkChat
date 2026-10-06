import type { GenericCtx } from "@convex-dev/better-auth"
import type { BetterAuthPlugin } from "better-auth"
import { APIError } from "better-auth/api"
import { internal } from "../_generated/api"
import type { DataModel } from "../_generated/dataModel"
import { getFingerprintPepper } from "./account_deletion_restore"
import { fingerprintAccountIdentity } from "./account_deletion"
import {
    RESTRICTED_ERROR_CODE,
    type RestrictionNotice,
    formatRestrictionNotice
} from "./moderation"

// This plugin is registered before Better Auth's admin plugin so its notice wins.
const restricted = (notice: RestrictionNotice) =>
    new APIError("FORBIDDEN", {
        message: formatRestrictionNotice(notice),
        code: RESTRICTED_ERROR_CODE
    })

export const moderationGate = (ctx: GenericCtx<DataModel>): BetterAuthPlugin => ({
    id: "silkchat-moderation",
    init: () => ({
        options: {
            databaseHooks: {
                user: {
                    create: {
                        before: async (user) => {
                            if (typeof user.email !== "string" || !user.email) return
                            const { emailHash } = await fingerprintAccountIdentity({
                                pepper: getFingerprintPepper(),
                                email: user.email
                            })
                            const caseId = await ctx.runQuery(
                                internal.moderation.getBlockedSignupCaseInternal,
                                { emailHash }
                            )
                            if (caseId !== null) throw restricted({ caseId })
                        }
                    }
                },
                session: {
                    create: {
                        before: async (session, hookCtx) => {
                            if (!hookCtx) return
                            const user = await hookCtx.context.internalAdapter.findUserById(
                                session.userId
                            )
                            const banExpires = (user as { banExpires?: Date | number | null })
                                ?.banExpires
                            if (!(user as { banned?: boolean | null } | null)?.banned) return
                            // Expired bans fall through so the admin plugin can clear them.
                            if (banExpires && new Date(banExpires).getTime() < Date.now()) return
                            throw restricted(
                                await ctx.runQuery(
                                    internal.moderation.getRestrictionNoticeInternal,
                                    {
                                        authUserId: session.userId
                                    }
                                )
                            )
                        }
                    }
                }
            }
        }
    })
})
