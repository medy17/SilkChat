import {
    MESSAGE_DIRECT_RENDER_LIMIT,
    getVirtualizedMessageCount,
    shouldVirtualizeMessageList
} from "@/lib/message-list-mode"
import { describe, expect, it } from "vitest"

describe("message list rendering mode", () => {
    it("keeps ordinary threads in normal document flow and virtualizes only larger histories", () => {
        expect(shouldVirtualizeMessageList(MESSAGE_DIRECT_RENDER_LIMIT)).toBe(false)
        expect(shouldVirtualizeMessageList(MESSAGE_DIRECT_RENDER_LIMIT + 1)).toBe(true)
        expect(getVirtualizedMessageCount(MESSAGE_DIRECT_RENDER_LIMIT + 1)).toBe(1)
        expect(getVirtualizedMessageCount(100)).toBe(60)
    })
})
