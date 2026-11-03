import { api } from "@/convex/_generated/api"
import {
    readCachedPrototypeCreditValue,
    writeCachedPrototypeCreditValue
} from "@/lib/prototype-credits"
import { useQuery } from "convex/react"
import { useEffect, useMemo } from "react"

const getCacheKey = (userId: string) => `hosted-usage-reset-tickets:v1:${userId}`

// The last known count, so the usage card's skeleton and first paint already hold the
// ticket button instead of it popping in once the query lands.
export const readCachedResetTicketCount = (userId: string | undefined) =>
    userId ? (readCachedPrototypeCreditValue<number>(getCacheKey(userId))?.value ?? 0) : 0

export function useUsageResetTicketCount(userId: string | undefined, enabled = true) {
    const cachedCount = useMemo(() => readCachedResetTicketCount(userId), [userId])
    const liveCount = useQuery(
        api.usage_resets.getMyUsageResetTicketCount,
        enabled && userId ? {} : "skip"
    )
    const count = liveCount === null ? 0 : liveCount

    useEffect(() => {
        if (userId && count !== undefined) {
            writeCachedPrototypeCreditValue(getCacheKey(userId), count)
        }
    }, [count, userId])

    return count ?? cachedCount
}
