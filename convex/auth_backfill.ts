"use node"

import { v } from "convex/values"
import { Pool } from "pg"
import { internal } from "./_generated/api.js"
import { action } from "./_generated/server"
const BACKFILL_BATCH_SIZE = 100

type LegacyUserRow = {
    id: string
    name: string
    email: string
    emailVerified: boolean
    creditPlan: "free" | "pro"
    image: string | null
    createdAt: number
    updatedAt: number
}

type LegacyAccountRow = {
    accountId: string
    providerId: string
    legacyUserId: string
    accessToken: string | null
    refreshToken: string | null
    idToken: string | null
    accessTokenExpiresAt: number | null
    refreshTokenExpiresAt: number | null
    scope: string | null
    password: string | null
    createdAt: number
    updatedAt: number
}

const getBackfillSecret = () => {
    const secret =
        process.env.AUTH_BACKFILL_SECRET?.trim() || process.env.BETTER_AUTH_SECRET?.trim()
    if (!secret) {
        throw new Error("Missing AUTH_BACKFILL_SECRET or BETTER_AUTH_SECRET in Convex env")
    }
    return secret
}

const requireBackfillSecret = (providedSecret: string) => {
    if (providedSecret !== getBackfillSecret()) {
        throw new Error("Invalid auth backfill secret")
    }
}

const toTimestamp = (value: unknown) => {
    if (value instanceof Date) {
        return value.getTime()
    }

    if (typeof value === "string" || typeof value === "number") {
        const parsed = new Date(value).getTime()
        return Number.isFinite(parsed) ? parsed : 0
    }

    return 0
}

const getConnectionString = () => {
    const connectionString =
        process.env.DATABASE_URL ||
        process.env.POSTGRES_URL_NON_POOLING ||
        process.env.POSTGRES_URL ||
        process.env.POSTGRES_PRISMA_URL

    if (!connectionString) {
        throw new Error(
            "A Postgres connection string is required (DATABASE_URL, POSTGRES_URL_NON_POOLING, POSTGRES_URL, or POSTGRES_PRISMA_URL)"
        )
    }

    return connectionString
}

const shouldUseSsl = (connectionString: string) =>
    process.env.DATABASE_SSL === "true" ||
    connectionString.includes("supabase.co") ||
    connectionString.includes("neon.tech")

const chunk = <T>(items: T[], size: number) => {
    const result: T[][] = []

    for (let index = 0; index < items.length; index += size) {
        result.push(items.slice(index, index + size))
    }

    return result
}

export const backfillFromPostgres = action({
    args: {
        secret: v.string(),
        batchSize: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        requireBackfillSecret(args.secret)

        const connectionString = getConnectionString()
        const pool = new Pool({
            connectionString,
            ssl: shouldUseSsl(connectionString)
                ? {
                      rejectUnauthorized: false
                  }
                : undefined,
            max: 1,
            allowExitOnIdle: true
        })

        try {
            const batchSize =
                Number.isFinite(args.batchSize) && args.batchSize && args.batchSize > 0
                    ? Math.floor(args.batchSize)
                    : BACKFILL_BATCH_SIZE

            const userRowsResult = await pool.query<{
                id: string
                name: string
                email: string
                email_verified: boolean
                credit_plan: "free" | "pro" | null
                image: string | null
                created_at: Date | string | number
                updated_at: Date | string | number
            }>(`
                select id, name, email, email_verified, credit_plan, image, created_at, updated_at
                from users
                order by created_at asc
            `)

            const accountRowsResult = await pool.query<{
                account_id: string
                provider_id: string
                user_id: string
                access_token: string | null
                refresh_token: string | null
                id_token: string | null
                access_token_expires_at: Date | string | number | null
                refresh_token_expires_at: Date | string | number | null
                scope: string | null
                password: string | null
                created_at: Date | string | number
                updated_at: Date | string | number
            }>(`
                select
                    account_id,
                    provider_id,
                    user_id,
                    access_token,
                    refresh_token,
                    id_token,
                    access_token_expires_at,
                    refresh_token_expires_at,
                    scope,
                    password,
                    created_at,
                    updated_at
                from accounts
                order by created_at asc
            `)

            const legacyUsers: LegacyUserRow[] = userRowsResult.rows.map((row) => ({
                id: row.id,
                name: row.name,
                email: row.email,
                emailVerified: row.email_verified,
                creditPlan: row.credit_plan === "pro" ? "pro" : "free",
                image: row.image,
                createdAt: toTimestamp(row.created_at),
                updatedAt: toTimestamp(row.updated_at)
            }))

            const legacyAccounts: LegacyAccountRow[] = accountRowsResult.rows.map((row) => ({
                accountId: row.account_id,
                providerId: row.provider_id,
                legacyUserId: row.user_id,
                accessToken: row.access_token,
                refreshToken: row.refresh_token,
                idToken: row.id_token,
                accessTokenExpiresAt: row.access_token_expires_at
                    ? toTimestamp(row.access_token_expires_at)
                    : null,
                refreshTokenExpiresAt: row.refresh_token_expires_at
                    ? toTimestamp(row.refresh_token_expires_at)
                    : null,
                scope: row.scope,
                password: row.password,
                createdAt: toTimestamp(row.created_at),
                updatedAt: toTimestamp(row.updated_at)
            }))

            let createdUsers = 0
            let updatedUsers = 0

            for (const userBatch of chunk(legacyUsers, batchSize)) {
                const result = await ctx.runMutation(
                    (internal as any).auth_backfill_mutations.upsertUsers,
                    {
                        users: userBatch
                    }
                )

                for (const mapping of result as Array<{ mode: "created" | "updated" }>) {
                    if (mapping.mode === "created") {
                        createdUsers += 1
                    } else {
                        updatedUsers += 1
                    }
                }
            }

            let createdCreditAccounts = 0
            let updatedCreditAccounts = 0

            for (const userBatch of chunk(legacyUsers, batchSize)) {
                const result = (await ctx.runMutation(
                    (internal as any).credits.upsertUserCreditPlansInternal,
                    {
                        accounts: userBatch.map((user) => ({
                            userId: user.id,
                            plan: user.creditPlan
                        }))
                    }
                )) as { created: number; updated: number }

                createdCreditAccounts += result.created
                updatedCreditAccounts += result.updated
            }

            let createdAccounts = 0
            let updatedAccounts = 0
            let skippedAccounts = 0

            for (const accountBatch of chunk(legacyAccounts, batchSize)) {
                const result = (await ctx.runMutation(
                    (internal as any).auth_backfill_mutations.upsertAccounts,
                    {
                        accounts: accountBatch
                    }
                )) as { created: number; updated: number; skipped: number }

                createdAccounts += result.created
                updatedAccounts += result.updated
                skippedAccounts += result.skipped
            }

            return {
                users: {
                    scanned: legacyUsers.length,
                    created: createdUsers,
                    updated: updatedUsers
                },
                accounts: {
                    scanned: legacyAccounts.length,
                    created: createdAccounts,
                    updated: updatedAccounts,
                    skipped: skippedAccounts
                },
                creditAccounts: {
                    scanned: legacyUsers.length,
                    created: createdCreditAccounts,
                    updated: updatedCreditAccounts
                },
                notes: [
                    "Legacy Postgres user IDs are stored in Better Auth user.userId.",
                    "Sessions, verification tokens, and JWKS rows are intentionally not backfilled."
                ]
            }
        } finally {
            await pool.end()
        }
    }
})
