import { describe, expect, it } from "vitest"

import { isNewChatPath } from "@/lib/last-chat-route"

describe("isNewChatPath", () => {
    it("identifies root and folder composer routes as new chats", () => {
        expect(isNewChatPath("/")).toBe(true)
        expect(isNewChatPath("/folder/folder-1")).toBe(true)
        expect(isNewChatPath("/folder/folder-1/")).toBe(true)
    })

    it("keeps the shortcut enabled for saved chats and other views", () => {
        expect(isNewChatPath("/thread/thread-1")).toBe(false)
        expect(isNewChatPath("/folder/folder-1/thread/thread-1")).toBe(false)
        expect(isNewChatPath("/library")).toBe(false)
        expect(isNewChatPath("/s/shared-thread-1")).toBe(false)
    })
})
