import { backendToUiMessages } from "@/convex/lib/backend_to_ui_messages"
import { describe, expect, it } from "vitest"

describe("backendToUiMessages", () => {
    it("restores a persisted malformed tool result as a terminal sanitized error", () => {
        const [message] = backendToUiMessages([
            {
                messageId: "assistant-1",
                role: "assistant",
                parts: [
                    {
                        type: "tool-invocation",
                        toolInvocation: {
                            state: "result",
                            args: { purpose: "Deeper analysis", code: "print(42)" },
                            result: {
                                kind: "silkchat_tool_error",
                                code: "invalid_tool_input",
                                success: false
                            },
                            toolCallId: "call-1",
                            toolName: "execute_code"
                        }
                    }
                ],
                metadata: {},
                createdAt: 1,
                updatedAt: 2,
                threadId: "thread-1"
            } as never
        ])

        expect(message?.parts).toEqual([
            {
                type: "tool-execute_code",
                toolCallId: "call-1",
                state: "output-error",
                input: { purpose: "Deeper analysis", code: "print(42)" },
                errorText: "Invalid input for tool execute_code"
            }
        ])
    })

    it("marks persisted calls without a terminal result as incomplete snapshots", () => {
        const [message] = backendToUiMessages([
            {
                messageId: "assistant-1",
                role: "assistant",
                parts: [
                    {
                        type: "tool-invocation",
                        toolInvocation: {
                            state: "call",
                            args: { purpose: "Deeper analysis", code: "print(42)" },
                            toolCallId: "call-1",
                            toolName: "execute_code"
                        }
                    }
                ],
                metadata: {},
                createdAt: 1,
                updatedAt: 2,
                threadId: "thread-1"
            } as never
        ])

        expect(message?.parts).toEqual([
            {
                type: "tool-execute_code",
                toolCallId: "call-1",
                state: "input-available",
                input: { purpose: "Deeper analysis", code: "print(42)" },
                toolMetadata: { silkchatPersistedWithoutTerminalResult: true }
            }
        ])
    })
})
