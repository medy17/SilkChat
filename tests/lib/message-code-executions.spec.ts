import { getMessageCodeExecutions } from "@/lib/message-code-executions"
import { describe, expect, it } from "vitest"

describe("getMessageCodeExecutions", () => {
    it("collects executions in message order and gives legacy calls useful titles", () => {
        const result = getMessageCodeExecutions({
            role: "assistant",
            parts: [
                { type: "text", text: "Checking this." },
                {
                    type: "tool-execute_code",
                    toolCallId: "code-1",
                    state: "output-available",
                    input: {
                        purpose: "  Finding candidate values  ",
                        language: "python",
                        code: "print(42)"
                    },
                    output: { success: true, exitCode: 0, stdout: "42" }
                },
                { type: "text", text: "Verifying it." },
                {
                    type: "tool-execute_code",
                    toolCallId: "code-2",
                    state: "input-available",
                    input: { language: "javascript", code: "console.log(42)" }
                }
            ]
        } as never)

        expect(
            result.map(({ toolCallId, title, status }) => ({ toolCallId, title, status }))
        ).toEqual([
            { toolCallId: "code-1", title: "Finding candidate values", status: "succeeded" },
            { toolCallId: "code-2", title: "Running JavaScript code", status: "running" }
        ])
    })

    it("marks unsuccessful results and tool errors as failed", () => {
        const result = getMessageCodeExecutions({
            role: "assistant",
            parts: [
                {
                    type: "tool-execute_code",
                    toolCallId: "code-1",
                    state: "output-available",
                    input: { language: "python", code: "raise RuntimeError()" },
                    output: { success: false, exitCode: 1, stderr: "RuntimeError" }
                },
                {
                    type: "tool-execute_code",
                    toolCallId: "code-2",
                    state: "output-error",
                    input: { language: "python", code: "print('hi')" },
                    errorText: "Sandbox unavailable"
                }
            ]
        } as never)

        expect(result.map((execution) => execution.status)).toEqual(["failed", "failed"])
        expect(result[1]?.errorText).toBe("Sandbox unavailable")
    })

    it("ignores code execution parts on non-assistant messages", () => {
        expect(
            getMessageCodeExecutions({
                role: "user",
                parts: [
                    {
                        type: "tool-execute_code",
                        toolCallId: "code-1",
                        state: "input-available",
                        input: { language: "python", code: "print('hi')" }
                    }
                ]
            } as never)
        ).toEqual([])
    })
})
