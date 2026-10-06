// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { session, impersonate, stop, lookup } = vi.hoisted(() => ({
    session: {
        data: { user: { id: "owner", email: "owner@example.com" }, session: {} },
        isPending: false
    },
    impersonate: vi.fn(),
    stop: vi.fn(),
    lookup: vi.fn()
}))
vi.mock("@/lib/auth-client", () => ({
    authClient: {
        useSession: () => session,
        admin: { impersonateUser: impersonate, stopImpersonating: stop }
    }
}))

vi.mock("convex/react", () => ({ useConvex: () => ({ query: lookup }) }))

import { ImpersonationBoundary, ImpersonationPicker } from "../../src/components/auth/impersonation"
import { switchImpersonation, useAccountSwitch } from "../../src/lib/impersonation-client"
import { ACCOUNT_STORAGE_OWNER, ACCOUNT_SWITCH_EVENT } from "../../src/lib/impersonation-storage"

const originalLocation = window.location
const replace = vi.fn()
const accountView = () =>
    createElement(ImpersonationBoundary, null, createElement("p", null, "Account contents"))

beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem(ACCOUNT_STORAGE_OWNER, "owner")
    session.data.user.id = "owner"
    session.isPending = false
    useAccountSwitch.setState({ switching: false, error: null })
    Object.defineProperty(window, "location", {
        configurable: true,
        value: { replace, reload: vi.fn() }
    })
    impersonate.mockReset()
    lookup.mockReset()
})
afterEach(() =>
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation })
)

describe("account switching UI", () => {
    it("leaves the existing loading and sign-in flow alone before impersonation is used", () => {
        localStorage.removeItem(ACCOUNT_STORAGE_OWNER)
        session.isPending = true
        render(accountView())
        expect(screen.getByText("Account contents")).toBeTruthy()
        expect(replace).not.toHaveBeenCalled()
    })
    it("unmounts account contents before the auth request completes and reloads with isolated state", async () => {
        localStorage.setItem("user-input", "owner draft")
        localStorage.setItem("CVX_DISK_CACHE:threads", "owner threads")
        let finish!: (value: unknown) => void
        impersonate.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finish = resolve
                })
        )
        render(accountView())
        let switched!: Promise<void>
        act(() => {
            switched = switchImpersonation("owner", "customer")
        })
        expect(screen.queryByText("Account contents")).toBeNull()
        expect(screen.getByText("Switching accounts…")).toBeTruthy()
        await act(async () => {
            finish({ data: { user: { id: "customer" } }, error: null })
            await switched
        })
        expect(localStorage.getItem(ACCOUNT_STORAGE_OWNER)).toBe("customer")
        expect(localStorage.getItem("user-input")).toBeNull()
        expect(localStorage.getItem("CVX_DISK_CACHE:threads")).toBeNull()
        expect(replace).toHaveBeenCalledWith("/")
        expect(screen.queryByText("Account contents")).toBeNull()
    })

    it("keeps the original view on a rejection, but blocks stale views after an uncertain network failure", async () => {
        render(accountView())
        impersonate.mockResolvedValue({ error: { status: 403, message: "Forbidden" } })
        await act(async () => {
            await expect(switchImpersonation("owner", "customer")).rejects.toThrow("Forbidden")
        })
        expect(screen.getByText("Account contents")).toBeTruthy()
        impersonate.mockRejectedValue(new Error("Connection lost"))
        await act(async () => {
            await expect(switchImpersonation("owner", "customer")).rejects.toThrow(
                "Connection lost"
            )
        })
        expect(screen.queryByText("Account contents")).toBeNull()
        expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy()
    })

    it("blocks another tab during switching and removes old routes before reloading", () => {
        sessionStorage.setItem("last-chat-route", "/chat/owner-thread")
        render(accountView())
        act(() =>
            window.dispatchEvent(
                new StorageEvent("storage", {
                    key: ACCOUNT_SWITCH_EVENT,
                    newValue: JSON.stringify({ state: "switching" })
                })
            )
        )
        expect(screen.queryByText("Account contents")).toBeNull()
        act(() =>
            window.dispatchEvent(
                new StorageEvent("storage", {
                    key: ACCOUNT_SWITCH_EVENT,
                    newValue: JSON.stringify({ state: "complete" })
                })
            )
        )
        expect(sessionStorage.getItem("last-chat-route")).toBeNull()
        expect(replace).toHaveBeenCalledWith("/")
    })

    it("isolates browser state before rendering when a session changes outside the picker", () => {
        localStorage.setItem("user-input", "old account draft")
        session.data.user.id = "customer"
        render(accountView())
        expect(screen.queryByText("Account contents")).toBeNull()
        expect(localStorage.getItem("user-input")).toBeNull()
        expect(localStorage.getItem(ACCOUNT_STORAGE_OWNER)).toBe("customer")
        expect(replace).toHaveBeenCalledWith("/")
    })
})

const customer = {
    id: "customer",
    name: "Test Customer",
    email: "customer@example.com",
    image: null,
    lastActiveAt: null,
    plan: "pro",
    subscriptionStatus: "active"
}
const picker = (open = true) =>
    createElement(ImpersonationPicker, { open, onOpenChange: vi.fn(), currentUserId: "owner" })
const findUser = (identifier = "customer@example.com") => {
    fireEvent.change(screen.getByLabelText("Email address or user ID"), {
        target: { value: identifier }
    })
    fireEvent.click(screen.getByRole("button", { name: "Find user" }))
}

describe("impersonation confirmation", () => {
    it("only looks up on submit, shows a skeleton, and requires confirmation before switching", async () => {
        let finish!: (value: unknown) => void
        lookup.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finish = resolve
                })
        )
        render(picker())
        expect(lookup).not.toHaveBeenCalled()
        fireEvent.change(screen.getByLabelText("Email address or user ID"), {
            target: { value: customer.email }
        })
        expect(lookup).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole("button", { name: "Find user" }))
        expect(screen.getByRole("status").textContent).toContain("Loading user")
        expect(
            (screen.getByRole("button", { name: "Continue as this user" }) as HTMLButtonElement)
                .disabled
        ).toBe(true)
        expect(screen.queryByRole("alert")).toBeNull()
        await act(async () => finish(customer))
        expect(screen.queryByRole("status")).toBeNull()
        expect(screen.getByText(customer.name)).toBeTruthy()
        expect(screen.getByText("No recorded activity")).toBeTruthy()
        expect(document.activeElement).toBe(
            screen.getByRole("button", { name: "Continue as this user" })
        )
        expect(impersonate).not.toHaveBeenCalled()
        impersonate.mockResolvedValue({ data: { user: { id: customer.id } }, error: null })
        await act(async () =>
            fireEvent.click(screen.getByRole("button", { name: "Continue as this user" }))
        )
        expect(localStorage.getItem(ACCOUNT_STORAGE_OWNER)).toBe(customer.id)
    })

    it("discards pending results on Back or close and allows another selection", async () => {
        let finish!: (value: unknown) => void
        lookup.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finish = resolve
                })
        )
        const view = render(picker())
        findUser()
        fireEvent.click(screen.getByRole("button", { name: "Back" }))
        await act(async () => finish(customer))
        expect(screen.getByLabelText("Email address or user ID")).toBeTruthy()
        expect(screen.queryByText(customer.name)).toBeNull()
        findUser()
        view.rerender(picker(false))
        view.rerender(picker(true))
        await act(async () => finish(customer))
        expect((screen.getByLabelText("Email address or user ID") as HTMLInputElement).value).toBe(
            ""
        )
        expect(screen.queryByText(customer.name)).toBeNull()
        lookup.mockResolvedValue(customer)
        await act(async () => findUser())
        fireEvent.click(screen.getByRole("button", { name: "Back" }))
        lookup.mockResolvedValue({ ...customer, id: "different", name: "Another Customer" })
        await act(async () => findUser("different"))
        expect(screen.getByText("Another Customer")).toBeTruthy()
        expect(impersonate).not.toHaveBeenCalled()
    })

    it("shows missing-user and network errors only once lookup settles, then allows retry", async () => {
        lookup.mockResolvedValue(null)
        render(picker())
        await act(async () => findUser())
        expect(screen.getByRole("alert").textContent).toContain("No user found")
        lookup.mockRejectedValue(new Error("Network error"))
        await act(async () => findUser())
        expect(screen.getByRole("alert").textContent).toContain("Please try again")
        lookup.mockResolvedValue(customer)
        await act(async () => findUser())
        expect(screen.queryByRole("alert")).toBeNull()
        expect(screen.getByText(customer.name)).toBeTruthy()
    })
})
