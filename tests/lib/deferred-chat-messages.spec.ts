import { resolveDeferredChatMessages } from "@/lib/deferred-chat-messages"
import type { UIMessage } from "ai"
import { describe, expect, it } from "vitest"

describe("resolveDeferredChatMessages", () => {
    it("paints a server-cleared retry immediately instead of retaining the old response", () => {
        const oldMessages: UIMessage[] = [
            { id: "user-1", role: "user", parts: [{ type: "text", text: "Prompt" }] },
            {
                id: "assistant-1",
                role: "assistant",
                parts: [{ type: "text", text: "Old response" }]
            }
        ]
        const clearedMessages: UIMessage[] = [
            oldMessages[0],
            { id: "assistant-1", role: "assistant", parts: [] }
        ]

        expect(resolveDeferredChatMessages(clearedMessages, oldMessages)).toBe(clearedMessages)
    })

    it("paints destructive retry truncation immediately", () => {
        const truncatedMessages: UIMessage[] = [
            { id: "user-1", role: "user", parts: [{ type: "text", text: "Prompt" }] },
            { id: "assistant-1", role: "assistant", parts: [] }
        ]
        const oldMessages: UIMessage[] = [
            ...truncatedMessages,
            { id: "user-2", role: "user", parts: [{ type: "text", text: "Later prompt" }] }
        ]

        expect(resolveDeferredChatMessages(truncatedMessages, oldMessages)).toBe(truncatedMessages)
    })

    it("keeps ordinary non-destructive updates deferred", () => {
        const deferredMessages: UIMessage[] = [
            { id: "user-1", role: "user", parts: [{ type: "text", text: "Prompt" }] }
        ]
        const currentMessages: UIMessage[] = [
            ...deferredMessages,
            { id: "assistant-1", role: "assistant", parts: [{ type: "text", text: "New" }] }
        ]

        expect(resolveDeferredChatMessages(currentMessages, deferredMessages)).toBe(
            deferredMessages
        )
    })
})
