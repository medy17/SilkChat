import { getInlinePartKeys } from "@/lib/message-part-keys"
import type { UIMessage } from "ai"
import { describe, expect, it } from "vitest"

type Parts = UIMessage["parts"]

describe("getInlinePartKeys", () => {
    it("keeps part keys stable when the saved reply replaces the streamed one", () => {
        // The SDK marks steps in streamed messages; Convex persists only the content.
        const streamed: Parts = [
            { type: "step-start" },
            { type: "text", text: "Searching." },
            { type: "step-start" },
            { type: "text", text: "Here is the answer." }
        ]
        const saved: Parts = [
            { type: "text", text: "Searching." },
            { type: "text", text: "Here is the answer." }
        ]
        const textKeys = (parts: Parts) =>
            getInlinePartKeys("msg", parts).filter((_key, index) => parts[index].type === "text")

        expect(textKeys(streamed)).toEqual(["msg-text-0", "msg-text-1"])
        expect(textKeys(saved)).toEqual(textKeys(streamed))
    })
})
