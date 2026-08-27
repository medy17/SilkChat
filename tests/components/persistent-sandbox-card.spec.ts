// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const convexMocks = vi.hoisted(() => ({
    queryResult: undefined as unknown,
    action: vi.fn(),
    mutation: vi.fn()
}))

vi.mock("convex/react", () => ({
    useAction: () => convexMocks.action,
    useMutation: () => convexMocks.mutation,
    useQuery: () => convexMocks.queryResult
}))

import { PersistentSandboxCard } from "@/components/renderers/persistent-sandbox-card"

const requestedAt = Date.UTC(2026, 7, 27, 12)
const invocation = {
    state: "output-available",
    toolCallId: "sandbox-tool-1",
    input: {
        purpose: "Analyze a dataset",
        runtime: "python",
        ttlMinutes: 30
    },
    output: {
        success: true,
        kind: "persistent_sandbox_request",
        status: "pending_confirmation",
        cardId: "sandbox-card-1",
        purpose: "Analyze a dataset",
        runtime: "python",
        runtimeVersion: "3.14",
        ttlMinutes: 30,
        requestedAt,
        confirmationExpiresAt: requestedAt + 30_000
    }
}

describe("PersistentSandboxCard", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(requestedAt)
        convexMocks.queryResult = undefined
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("renders the persisted active state instead of the original pending tool output", () => {
        const { rerender } = render(
            React.createElement(PersistentSandboxCard, {
                toolInvocation: invocation as never,
                threadId: "thread-1",
                messageId: "assistant-1"
            })
        )

        expect(screen.getByRole("button", { name: "Allow" })).toBeTruthy()
        expect(screen.getByText("30 minute TTL")).toBeTruthy()

        convexMocks.queryResult = {
            ...invocation.output,
            status: "active",
            sandboxId: "sandbox-1",
            expiresAt: requestedAt + 120_000
        }
        rerender(
            React.createElement(PersistentSandboxCard, {
                toolInvocation: { ...invocation } as never,
                threadId: "thread-1",
                messageId: "assistant-1"
            })
        )

        expect(screen.queryByRole("button", { name: "Allow" })).toBeNull()
        expect(screen.getByRole("button", { name: "Kill sandbox" })).toBeTruthy()
        expect(screen.getByText("2:00 remaining")).toBeTruthy()
    })
})
