import {
    getBlockedToolAttempt,
    getBlockedToolAttempts,
    getMalformedToolAttempt,
    getToolFailureAttempts
} from "@/lib/blocked-tool-attempt"
import type { UIMessage } from "ai"
import { describe, expect, it } from "vitest"

describe("getBlockedToolAttempt", () => {
    it("extracts a user-facing summary from a captured tool call", () => {
        const part = {
            type: "tool-execute_code",
            toolCallId: "call-1",
            state: "output-available",
            input: {
                purpose: "Finding the actual station ID",
                language: "python",
                code: "print('not run')"
            },
            output: {
                success: false,
                code: "tool_blocked",
                reason: "user_disabled",
                ability: "code_execution",
                toolName: "execute_code",
                toolLabel: "Code execution"
            }
        } as UIMessage["parts"][number]

        expect(getBlockedToolAttempt(part)).toEqual({
            ability: "code_execution",
            toolName: "execute_code",
            toolLabel: "Code execution",
            reason: "user_disabled",
            input: {
                purpose: "Finding the actual station ID",
                language: "python",
                code: "print('not run')"
            },
            summary: "Finding the actual station ID"
        })
    })

    it("leaves ordinary tool results alone", () => {
        const part = {
            type: "tool-web_search",
            toolCallId: "call-2",
            state: "output-available",
            input: { query: "South Pole weather" },
            output: { success: true, results: [] }
        } as UIMessage["parts"][number]

        expect(getBlockedToolAttempt(part)).toBeNull()
    })

    it("coalesces blocked calls from one assistant turn in message order", () => {
        const blockedOutput = {
            success: false,
            code: "tool_blocked",
            reason: "user_disabled",
            ability: "web_search",
            toolName: "web_search",
            toolLabel: "Web search"
        }
        const message = {
            role: "assistant",
            parts: [
                {
                    type: "tool-web_search",
                    toolCallId: "call-1",
                    state: "output-available",
                    input: { query: "first query" },
                    output: blockedOutput
                },
                { type: "text", text: "Trying again" },
                {
                    type: "tool-web_search",
                    toolCallId: "call-2",
                    state: "output-available",
                    input: { query: "second query" },
                    output: blockedOutput
                }
            ]
        } as Pick<UIMessage, "role" | "parts">

        expect(getBlockedToolAttempts(message).map((attempt) => attempt.summary)).toEqual([
            "first query",
            "second query"
        ])
    })

    it("classifies a streamed validation failure without exposing its raw trace", () => {
        const part = {
            type: "tool-render_chart",
            toolCallId: "chart-1",
            state: "output-error",
            input: {
                title: "Deaths by year",
                type: "line",
                xKey: "year"
            },
            errorText:
                "AI_InvalidToolInputError: Invalid input for tool render_chart: Type validation failed"
        } as UIMessage["parts"][number]

        expect(getMalformedToolAttempt(part)).toEqual({
            ability: "mathematical_instruments",
            toolName: "render_chart",
            toolLabel: "Chart renderer",
            reason: "malformed_tool_call",
            input: {
                title: "Deaths by year",
                type: "line",
                xKey: "year"
            },
            summary: undefined
        })
    })

    it("does not turn an ordinary renderer failure into a malformed-call card", () => {
        const message = {
            role: "assistant",
            parts: [
                {
                    type: "tool-render_chart",
                    toolCallId: "chart-1",
                    state: "output-error",
                    input: { title: "Incomplete chart" },
                    errorText: "Invalid input for tool render_chart"
                },
                {
                    type: "tool-render_chart",
                    toolCallId: "chart-2",
                    state: "output-error",
                    input: { title: "Renderer crashed" },
                    errorText: "Unexpected renderer failure"
                }
            ]
        } as Pick<UIMessage, "role" | "parts">

        expect(getToolFailureAttempts(message)).toHaveLength(1)
    })
})
