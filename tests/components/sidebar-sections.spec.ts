import { groupThreadsByTime } from "@/components/threads/sidebar-sections"
import type { Id } from "@/convex/_generated/dataModel"
import { describe, expect, it, vi } from "vitest"

const threadId = (id: string) => id as Id<"threads">

describe("groupThreadsByTime", () => {
    it("keeps threads older than 30 days in an Older group", () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-05-02T12:00:00.000Z"))

        const grouped = groupThreadsByTime([
            {
                _id: threadId("thread-older"),
                authorId: "user-1",
                title: "Old thread",
                createdAt: new Date("2026-03-01T12:00:00.000Z").getTime(),
                updatedAt: new Date("2026-03-01T12:00:00.000Z").getTime(),
                pinned: false
            },
            {
                _id: threadId("thread-recent"),
                authorId: "user-1",
                title: "Recent thread",
                createdAt: new Date("2026-04-20T12:00:00.000Z").getTime(),
                updatedAt: new Date("2026-04-20T12:00:00.000Z").getTime(),
                pinned: false
            }
        ])

        expect(grouped.older.map((thread) => thread._id)).toEqual(["thread-older"])
        expect(grouped.lastThirtyDays.map((thread) => thread._id)).toEqual(["thread-recent"])

        vi.useRealTimers()
    })
})
