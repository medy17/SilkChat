// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import {
    clearAccountSessionStorage,
    switchAccountStorage
} from "../../src/lib/impersonation-storage"

beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
})

describe("impersonation browser state", () => {
    it("isolates drafts and preferences, drops query caches, and restores each account on return", () => {
        localStorage.setItem("silkchat:thread-drafts:v1", "owner draft")
        localStorage.setItem("model-storage", "owner model")
        localStorage.setItem("CVX_DISK_CACHE:threads", "private owner chats")
        localStorage.setItem("DISK_CACHE:user-name", "Owner")
        localStorage.setItem("theme-store", "shared browser theme")
        switchAccountStorage(localStorage, "owner", "customer")
        expect(localStorage.getItem("silkchat:thread-drafts:v1")).toBeNull()
        expect(localStorage.getItem("model-storage")).toBeNull()
        expect(localStorage.getItem("CVX_DISK_CACHE:threads")).toBeNull()
        expect(localStorage.getItem("DISK_CACHE:user-name")).toBeNull()
        expect(localStorage.getItem("theme-store")).toBe("shared browser theme")
        localStorage.setItem("silkchat:thread-drafts:v1", "customer draft")
        localStorage.setItem("CVX_DISK_CACHE:threads", "private customer chats")
        switchAccountStorage(localStorage, "customer", "owner")
        expect(localStorage.getItem("silkchat:thread-drafts:v1")).toBe("owner draft")
        expect(localStorage.getItem("model-storage")).toBe("owner model")
        expect(localStorage.getItem("CVX_DISK_CACHE:threads")).toBeNull()
        switchAccountStorage(localStorage, "owner", "customer")
        expect(localStorage.getItem("silkchat:thread-drafts:v1")).toBe("customer draft")
    })

    it("does not retain the previous account's state when a saved snapshot is invalid", () => {
        localStorage.setItem("silkchat:account-browser-state:customer", "bad json")
        localStorage.setItem("user-input", "private draft")
        switchAccountStorage(localStorage, "owner", "customer")
        expect(localStorage.getItem("user-input")).toBeNull()
        sessionStorage.setItem("last-chat-route", "/chat/private")
        sessionStorage.setItem("persona-onboarding-handoff", "private persona")
        sessionStorage.setItem("unrelated", "preserved")
        clearAccountSessionStorage(sessionStorage)
        expect(sessionStorage.getItem("last-chat-route")).toBeNull()
        expect(sessionStorage.getItem("persona-onboarding-handoff")).toBeNull()
        expect(sessionStorage.getItem("unrelated")).toBe("preserved")
    })
})
