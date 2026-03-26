"use node"

import { loadServerEnv } from "@/lib/load-server-env"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

loadServerEnv()

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

const shouldUseSsl =
    process.env.DATABASE_SSL === "true" ||
    connectionString.includes("supabase.co") ||
    connectionString.includes("neon.tech")

const pool = new Pool({
    connectionString,
    ssl: shouldUseSsl
        ? {
              rejectUnauthorized: false
          }
        : undefined,
    max: 5,
    allowExitOnIdle: true
})

export const db = drizzle({
    client: pool
})
