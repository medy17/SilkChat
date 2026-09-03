// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const retryMenuMock = vi.fn((_props: unknown) => null)

vi.mock("@/lib/browser-env", () => ({
    browserEnv: vi.fn(() => "https://convex.example"),
    optionalBrowserEnv: vi.fn(() => undefined)
}))

vi.mock("@/components/retry-menu", () => ({
    RetryMenu: (props: unknown) => retryMenuMock(props)
}))

import { ChatActions } from "@/components/chat-actions"
import { useMessageFooterStore } from "@/lib/message-footer-store"
import type { UIMessage } from "ai"

const createAssistantMessage = (metadata?: Record<string, unknown>) =>
    ({
        id: "assistant-1",
        role: "assistant",
        metadata,
        parts: [{ type: "text", text: "Hello world" }]
    }) as unknown as UIMessage

describe("ChatActions", () => {
    beforeEach(() => {
        useMessageFooterStore.setState({ footerMode: "simple", footerMetadataByMessageId: {} })
        retryMenuMock.mockClear()
    })

    it("renders only the model name in simple mode", () => {
        render(
            React.createElement(ChatActions, {
                role: "assistant",
                message: createAssistantMessage({
                    modelName: "GPT 5.4 Mini",
                    runtimeProvider: "openrouter",
                    reasoningEffort: "medium",
                    promptTokens: 757,
                    completionTokens: 159,
                    reasoningTokens: 76,
                    totalTokens: 916,
                    serverDurationMs: 2500,
                    timeToFirstVisibleMs: 500
                })
            })
        )

        expect(screen.getByText("GPT 5.4 Mini (Medium)")).toBeTruthy()
        expect(screen.queryByText("916 tokens")).toBeNull()
        expect(screen.queryByText("79.50 tok/sec")).toBeNull()
        expect(screen.queryByText("TTFT 0.50 sec")).toBeNull()
    })

    it("shows BYOK in simple mode when the response used a user key", () => {
        render(
            React.createElement(ChatActions, {
                role: "assistant",
                message: createAssistantMessage({
                    modelName: "Gemini 3.1 Pro",
                    runtimeProvider: "openrouter",
                    creditProviderSource: "openrouter",
                    reasoningEffort: "low"
                })
            })
        )

        expect(screen.getByText("Gemini 3.1 Pro (Low)")).toBeTruthy()
        expect(screen.getByText("BYOK")).toBeTruthy()
    })

    it("renders nerd stats and marquee chrome when metadata is complete", () => {
        useMessageFooterStore.setState({ footerMode: "nerd" })

        const { container } = render(
            React.createElement(ChatActions, {
                role: "assistant",
                message: createAssistantMessage({
                    modelName: "GPT 5.4 Mini",
                    runtimeProvider: "openrouter",
                    reasoningEffort: "medium",
                    promptTokens: 757,
                    completionTokens: 159,
                    reasoningTokens: 76,
                    totalTokens: 916,
                    serverDurationMs: 2500,
                    timeToFirstVisibleMs: 500
                })
            })
        )

        expect(screen.getByText("GPT 5.4 Mini (Medium)")).toBeTruthy()
        expect(screen.getByText("79.50 tok/sec")).toBeTruthy()
        expect(screen.getByText("916 tokens (757 in, 159 out)")).toBeTruthy()
        expect(screen.getByText("TTFT 0.50 sec")).toBeTruthy()
        expect(container.querySelector(".footer-marquee-mask")).toBeTruthy()
        expect(container.querySelector(".footer-marquee-track")).toBeTruthy()
        expect(screen.queryByText(/reasoning/)).toBeNull()
    })

    it("shows model metadata for a completed generated error without usage", () => {
        useMessageFooterStore.setState({ footerMode: "nerd" })

        render(
            React.createElement(ChatActions, {
                role: "assistant",
                message: {
                    ...createAssistantMessage({
                        modelId: "openai/gpt-5.4-mini",
                        modelName: "GPT 5.4 Mini",
                        reasoningEffort: "medium"
                    }),
                    parts: [
                        {
                            type: "data-context-error",
                            data: { message: "Context limit reached" }
                        }
                    ]
                } as UIMessage
            })
        )

        expect(screen.getByText("GPT 5.4 Mini (Medium)")).toBeTruthy()
    })

    it("shows BYOK in the footer without labeling hosted responses", () => {
        useMessageFooterStore.setState({ footerMode: "nerd" })

        const { rerender } = render(
            React.createElement(ChatActions, {
                role: "assistant",
                message: createAssistantMessage({
                    modelName: "GPT 5.4 Mini",
                    creditProviderSource: "internal"
                })
            })
        )

        expect(screen.queryByText("Hosted")).toBeNull()
        expect(screen.queryByText("BYOK")).toBeNull()

        rerender(
            React.createElement(ChatActions, {
                role: "assistant",
                message: createAssistantMessage({
                    modelName: "GPT 5.4 Mini",
                    creditProviderSource: "openrouter",
                    contextRouting: {
                        mode: "byok_fallback",
                        reason: "thread",
                        limitType: "hosted",
                        estimatedTokens: 48_000,
                        limitTokens: 32_000
                    }
                })
            })
        )

        expect(screen.getByText("BYOK (large thread)")).toBeTruthy()
        expect(screen.queryByText("Hosted")).toBeNull()
    })

    it("falls back to prompt plus completion total without double-counting reasoning", () => {
        useMessageFooterStore.setState({ footerMode: "nerd" })

        render(
            React.createElement(ChatActions, {
                role: "assistant",
                message: createAssistantMessage({
                    modelName: "GPT 5.4 Mini",
                    runtimeProvider: "openrouter",
                    reasoningEffort: "medium",
                    promptTokens: 757,
                    completionTokens: 159,
                    reasoningTokens: 76
                })
            })
        )

        expect(screen.getByText("916 tokens (757 in, 159 out)")).toBeTruthy()
        expect(screen.queryByText("992 tokens")).toBeNull()
    })

    it("defers generated footer stats until final metadata is available", () => {
        useMessageFooterStore.setState({ footerMode: "nerd" })

        const message = createAssistantMessage({
            modelId: "openai/gpt-5.4-mini",
            modelName: "GPT 5.4 Mini",
            timeToFirstVisibleMs: 500
        })

        const { rerender } = render(
            React.createElement(ChatActions, {
                role: "assistant",
                message
            })
        )

        expect(screen.queryByText("TTFT 0.50 sec")).toBeNull()
        expect(screen.queryByText("GPT 5.4 Mini (Medium)")).toBeNull()

        act(() => {
            useMessageFooterStore.getState().setFooterMetadata(message.id, {
                modelId: "openai/gpt-5.4-mini",
                modelName: "GPT 5.4 Mini",
                runtimeProvider: "openrouter",
                reasoningEffort: "medium",
                promptTokens: 757,
                completionTokens: 159,
                totalTokens: 916,
                serverDurationMs: 2500,
                timeToFirstVisibleMs: 500
            })
        })

        rerender(
            React.createElement(ChatActions, {
                role: "assistant",
                message
            })
        )

        expect(screen.getByText("GPT 5.4 Mini (Medium)")).toBeTruthy()
        expect(screen.getByText("79.50 tok/sec")).toBeTruthy()
        expect(screen.getByText("916 tokens (757 in, 159 out)")).toBeTruthy()
    })

    it("passes attachment modality gating through to the retry menu", () => {
        render(
            React.createElement(ChatActions, {
                role: "user",
                message: createAssistantMessage(),
                onRetry: vi.fn(),
                requiresVisionForModelSelection: true,
                requiresNativePdfForModelSelection: true
            })
        )

        expect(retryMenuMock).toHaveBeenCalledWith(
            expect.objectContaining({
                requiresVision: true,
                requiresNativePdf: true
            })
        )
    })

    it("renders a branch action between retry and edit controls", () => {
        const onBranch = vi.fn()
        const message = createAssistantMessage()

        render(
            React.createElement(ChatActions, {
                role: "user",
                message,
                onRetry: vi.fn(),
                onBranch,
                onEdit: vi.fn()
            })
        )

        screen.getByRole("button", { name: "Branch chat" }).click()

        expect(retryMenuMock).toHaveBeenCalled()
        expect(onBranch).toHaveBeenCalledWith(message)
    })

    it("keeps assistant metadata while limiting shared-message actions to copy", () => {
        const message = {
            ...createAssistantMessage({
                modelName: "GPT 5.4 Mini",
                runtimeProvider: "openrouter"
            }),
            parts: [
                { type: "text", text: "A shared answer" },
                {
                    type: "tool-image_generation",
                    state: "output-available",
                    output: { assets: [{ imageUrl: "shared-image.png" }] }
                }
            ]
        } as UIMessage

        render(
            React.createElement(ChatActions, {
                role: "assistant",
                message,
                onRetry: vi.fn(),
                onBranch: vi.fn(),
                onEdit: vi.fn(),
                copyOnly: true
            })
        )

        expect(screen.getAllByRole("button")).toHaveLength(1)
        expect(screen.getByRole("button", { name: "Copy message" })).toBeTruthy()
        expect(screen.getByText("GPT 5.4 Mini")).toBeTruthy()
        expect(retryMenuMock).not.toHaveBeenCalled()
    })
})
