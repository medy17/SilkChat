import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("convex/values", () => {
    const passthrough = () => ({})
    return { v: new Proxy({}, { get: () => passthrough }) }
})

vi.mock("../../convex/_generated/server", () => ({
    internalMutation: (config: unknown) => config,
    internalQuery: (config: unknown) => config
}))

vi.mock("../../convex/_generated/api", () => ({
    internal: {
        account_activity_node: {
            deliverInactiveAccountNotice: "deliverInactiveAccountNotice"
        }
    }
}))

import {
    prepareInactiveAccountNoticeDelivery,
    queueInactiveAccountNotices
} from "../../convex/account_activity"

const queueHandler = (
    queueInactiveAccountNotices as unknown as {
        handler: (ctx: {
            db: {
                query: ReturnType<typeof vi.fn>
                patch: ReturnType<typeof vi.fn>
            }
            scheduler: { runAfter: ReturnType<typeof vi.fn> }
        }) => Promise<{ queued: number }>
    }
).handler

const prepareHandler = (
    prepareInactiveAccountNoticeDelivery as unknown as {
        handler: (
            ctx: {
                db: {
                    get: ReturnType<typeof vi.fn>
                    patch: ReturnType<typeof vi.fn>
                }
            },
            args: { activityId: string }
        ) => Promise<boolean>
    }
).handler

beforeEach(() => {
    vi.clearAllMocks()
})

describe("inactive account notice workflow", () => {
    it("queues each eligible account only once for the weekly delivery action", async () => {
        const candidates = [{ _id: "activity-1" }, { _id: "activity-2" }]
        const take = vi.fn().mockResolvedValue(candidates)
        const withIndex = vi.fn((_name, buildQuery) => {
            const query = {
                eq: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis()
            }
            buildQuery(query)
            return { take }
        })
        const db = {
            query: vi.fn(() => ({ withIndex })),
            patch: vi.fn().mockResolvedValue(undefined)
        }
        const scheduler = { runAfter: vi.fn().mockResolvedValue(undefined) }

        await expect(queueHandler({ db, scheduler })).resolves.toEqual({ queued: 2 })
        expect(db.patch).toHaveBeenCalledTimes(2)
        expect(scheduler.runAfter).toHaveBeenCalledTimes(2)
        expect(scheduler.runAfter).toHaveBeenCalledWith(0, "deliverInactiveAccountNotice", {
            activityId: "activity-1"
        })
    })

    it("cancels a queued notice when authenticated activity resumes", async () => {
        const db = {
            get: vi.fn().mockResolvedValue({
                inactivityNoticeState: "queued",
                lastActiveAt: Date.now()
            }),
            patch: vi.fn().mockResolvedValue(undefined)
        }

        await expect(prepareHandler({ db }, { activityId: "activity-1" })).resolves.toBe(false)
        expect(db.patch).toHaveBeenCalledWith("activity-1", {
            inactivityNoticeState: "pending",
            inactivityNoticeQueuedAt: undefined
        })
    })
})
