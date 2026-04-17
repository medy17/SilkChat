// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { useAvailableModelsMock, useConvexAuthMock, useDiskCachedQueryMock, useSessionMock } =
    vi.hoisted(() => ({
        useAvailableModelsMock: vi.fn(),
        useConvexAuthMock: vi.fn(),
        useDiskCachedQueryMock: vi.fn(),
        useSessionMock: vi.fn()
    }))

vi.mock("@/components/model-selector", () => ({
    getProviderIcon: () => React.createElement("span", { "data-testid": "provider-icon" })
}))

vi.mock("@/convex/_generated/api", () => ({
    api: {
        settings: {
            getUserSettings: "getUserSettings"
        }
    }
}))

vi.mock("@/hooks/auth-hooks", () => ({
    useSession: useSessionMock
}))

vi.mock("@/lib/convex-cached-query", () => ({
    useDiskCachedQuery: useDiskCachedQueryMock
}))

vi.mock("@/lib/models-providers-shared", async () => {
    const actual = await vi.importActual<typeof import("@/lib/models-providers-shared")>(
        "@/lib/models-providers-shared"
    )

    return {
        ...actual,
        useAvailableModels: useAvailableModelsMock
    }
})

vi.mock("@convex-dev/react-query", () => ({
    useConvexAuth: useConvexAuthMock
}))

import { RetryMenu } from "@/components/retry-menu"

describe("RetryMenu", () => {
    beforeEach(() => {
        useAvailableModelsMock.mockReset()
        useConvexAuthMock.mockReset()
        useDiskCachedQueryMock.mockReset()
        useSessionMock.mockReset()

        useSessionMock.mockReturnValue({
            user: {
                id: "user-1"
            }
        })
        useConvexAuthMock.mockReturnValue({ isLoading: false })
        useDiskCachedQueryMock.mockReturnValue({})
    })

    it("hides image and speech-to-text providers from the retry flyout", async () => {
        useAvailableModelsMock.mockReturnValue({
            availableModels: [
                {
                    id: "gpt-4.1",
                    name: "GPT-4.1",
                    abilities: [],
                    adapters: ["openai:gpt-4.1"],
                    releaseOrder: 10
                },
                {
                    id: "gpt-image-1",
                    name: "GPT Image 1",
                    abilities: [],
                    adapters: ["openai:gpt-image-1"],
                    mode: "image",
                    releaseOrder: 9
                },
                {
                    id: "fal-image",
                    name: "Fal Image",
                    abilities: [],
                    adapters: ["fal:fal-image"],
                    mode: "image",
                    releaseOrder: 8
                },
                {
                    id: "whisper-1",
                    name: "Whisper 1",
                    abilities: [],
                    adapters: ["groq:whisper-1"],
                    mode: "speech-to-text",
                    releaseOrder: 7
                }
            ],
            currentProviders: {
                core: {},
                custom: {}
            }
        })

        render(React.createElement(RetryMenu, { onRetry: vi.fn() }))

        fireEvent.pointerDown(screen.getByRole("button"), { button: 0, ctrlKey: false })

        expect(await screen.findByText("Retry same")).toBeTruthy()
        expect(screen.getByText("OpenAI")).toBeTruthy()
        expect(screen.queryByText("Fal AI")).toBeNull()
        expect(screen.queryByText("Groq")).toBeNull()
    })
})
