"use node"

import { db } from "@/database/db"
import { users } from "@/database/schema"
import { loadServerEnv } from "@/lib/load-server-env"
import { eq } from "drizzle-orm"

loadServerEnv()

export type UserCreditPlan = "free" | "pro"

const parseCreditLimit = (value: string | undefined, fallback: number) => {
    if (!value) return fallback

    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export const getConfiguredCreditLimits = (plan: UserCreditPlan) => {
    const freeBasicCredits = parseCreditLimit(process.env.MONTHLY_CREDITS_FREE, 200)
    const proBasicCredits = parseCreditLimit(process.env.MONTHLY_CREDITS_PRO, 1500)
    const proCredits = parseCreditLimit(process.env.MONTHLY_PRO_CREDITS, 100)

    if (plan === "pro") {
        return {
            basic: proBasicCredits,
            pro: proCredits
        }
    }

    return {
        basic: freeBasicCredits,
        pro: 0
    }
}

export const getUserCreditPlan = async (userId: string): Promise<UserCreditPlan> => {
    const [user] = await db
        .select({
            creditPlan: users.creditPlan
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

    return user?.creditPlan === "pro" ? "pro" : "free"
}

export const setUserCreditPlan = async (userId: string, plan: UserCreditPlan) => {
    await db.update(users).set({ creditPlan: plan }).where(eq(users.id, userId))

    return plan
}
