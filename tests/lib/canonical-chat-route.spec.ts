import { describe, expect, it } from "vitest"

import { getCanonicalChatRouteTarget } from "@/lib/canonical-chat-route"

describe("getCanonicalChatRouteTarget", () => {
    it("returns the thread route for root chats", () => {
        expect(
            getCanonicalChatRouteTarget({
                pathname: "/",
                threadId: "thread-1"
            })
        ).toEqual({
            pathname: "/thread/thread-1",
            to: "/thread/$threadId",
            params: { threadId: "thread-1" }
        })
    })

    it("returns the folder thread route for folder chats", () => {
        expect(
            getCanonicalChatRouteTarget({
                pathname: "/folder/folder-1",
                threadId: "thread-1",
                folderId: "folder-1"
            })
        ).toEqual({
            pathname: "/folder/folder-1/thread/thread-1",
            to: "/folder/$folderId/thread/$threadId",
            params: { folderId: "folder-1", threadId: "thread-1" }
        })
    })

    it("returns null when already on the canonical route", () => {
        expect(
            getCanonicalChatRouteTarget({
                pathname: "/thread/thread-1",
                threadId: "thread-1"
            })
        ).toBeNull()
    })
})
