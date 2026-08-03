import { getBlockedToolAttempt, getBlockedToolAttempts } from "@/lib/blocked-tool-attempt"
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
})
