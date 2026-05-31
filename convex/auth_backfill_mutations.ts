import { createClient } from "@convex-dev/better-auth"
import type { ComponentApi as BetterAuthComponentApi } from "@convex-dev/better-auth/_generated/component.js"
import { v } from "convex/values"
import { components } from "./_generated/api.js"
import { internalMutation } from "./_generated/server"

const betterAuthComponent = (
    components as typeof components & {
        betterAuth: BetterAuthComponentApi<"betterAuth">
    }
).betterAuth

const authComponent = createClient(betterAuthComponent)

const optionalString = v.optional(v.union(v.null(), v.string()))
const optionalNumber = v.optional(v.union(v.null(), v.number()))

const userBackfillValidator = v.object({
    id: v.string(),
    name: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    creditPlan: v.union(v.literal("free"), v.literal("pro")),
    image: optionalString,
    createdAt: v.number(),
    updatedAt: v.number()
})

const accountBackfillValidator = v.object({
    accountId: v.string(),
    providerId: v.string(),
    legacyUserId: v.string(),
    accessToken: optionalString,
    refreshToken: optionalString,
    idToken: optionalString,
    accessTokenExpiresAt: optionalNumber,
    refreshTokenExpiresAt: optionalNumber,
    scope: optionalString,
    password: optionalString,
    createdAt: v.number(),
    updatedAt: v.number()
})

export const upsertUsers = internalMutation({
    args: {
        users: v.array(userBackfillValidator)
    },
    handler: async (ctx, args) => {
        const mappings: Array<{
            legacyUserId: string
            authUserId: string
            mode: "created" | "updated"
        }> = []

        for (const user of args.users) {
            const existingByLegacyId = await ctx.runQuery(betterAuthComponent.adapter.findOne, {
                model: "user",
                where: [{ field: "userId", operator: "eq", value: user.id }]
            })

            const existingByEmail = existingByLegacyId
                ? null
                : await ctx.runQuery(betterAuthComponent.adapter.findOne, {
                      model: "user",
                      where: [{ field: "email", operator: "eq", value: user.email }]
                  })

            const existingUser = existingByLegacyId || existingByEmail
            const updateData = {
                name: user.name,
                email: user.email,
                emailVerified: user.emailVerified,
                image: user.image,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                userId: user.id
            }

            if (existingUser?._id) {
                await ctx.runMutation(betterAuthComponent.adapter.updateOne, {
                    input: {
                        model: "user",
                        where: [{ field: "_id", operator: "eq", value: String(existingUser._id) }],
                        update: updateData
                    }
                })

                mappings.push({
                    legacyUserId: user.id,
                    authUserId: String(existingUser._id),
                    mode: "updated"
                })
                continue
            }

            const createdUser = await ctx.runMutation(betterAuthComponent.adapter.create, {
                input: {
                    model: "user",
                    data: updateData
                }
            })

            mappings.push({
                legacyUserId: user.id,
                authUserId: String(createdUser._id),
                mode: "created"
            })
        }

        return mappings
    }
})

export const upsertAccounts = internalMutation({
    args: {
        accounts: v.array(accountBackfillValidator)
    },
    handler: async (ctx, args) => {
        let created = 0
        let updated = 0
        let skipped = 0

        for (const account of args.accounts) {
            const authUser = await ctx.runQuery(betterAuthComponent.adapter.findOne, {
                model: "user",
                where: [{ field: "userId", operator: "eq", value: account.legacyUserId }]
            })

            if (!authUser?._id) {
                skipped += 1
                continue
            }

            const existingAccount = await ctx.runQuery(betterAuthComponent.adapter.findOne, {
                model: "account",
                where: [
                    { field: "accountId", operator: "eq", value: account.accountId },
                    { field: "providerId", operator: "eq", value: account.providerId }
                ]
            })

            const accountData = {
                accountId: account.accountId,
                providerId: account.providerId,
                userId: String(authUser._id),
                accessToken: account.accessToken,
                refreshToken: account.refreshToken,
                idToken: account.idToken,
                accessTokenExpiresAt: account.accessTokenExpiresAt,
                refreshTokenExpiresAt: account.refreshTokenExpiresAt,
                scope: account.scope,
                password: account.password,
                createdAt: account.createdAt,
                updatedAt: account.updatedAt
            }

            if (existingAccount?._id) {
                await ctx.runMutation(betterAuthComponent.adapter.updateOne, {
                    input: {
                        model: "account",
                        where: [
                            { field: "_id", operator: "eq", value: String(existingAccount._id) }
                        ],
                        update: accountData
                    }
                })
                updated += 1
                continue
            }

            await ctx.runMutation(betterAuthComponent.adapter.create, {
                input: {
                    model: "account",
                    data: accountData
                }
            })
            created += 1
        }

        return { created, updated, skipped }
    }
})
