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

    it("does not show a persisted call with no terminal result as actively running", () => {
        const result = getMessageCodeExecutions({
            role: "assistant",
            parts: [
                {
                    type: "tool-execute_code",
                    toolCallId: "code-1",
                    state: "input-available",
                    toolMetadata: { silkchatPersistedWithoutTerminalResult: true },
                    input: { purpose: "Deeper analysis", code: "print(42)" }
                }
            ]
        } as never)

        expect(result[0]).toMatchObject({
            status: "unresolved",
            errorText: "No terminal result was recorded for this execution."
        })
    })

    it("clears the incomplete snapshot state when a resumed execution receives output", () => {
        const result = getMessageCodeExecutions({
            role: "assistant",
            parts: [
                {
                    type: "tool-execute_code",
                    toolCallId: "code-1",
                    state: "output-available",
                    toolMetadata: { silkchatPersistedWithoutTerminalResult: true },
                    input: { purpose: "Deeper analysis", code: "print(42)" },
                    output: { success: true, stdout: "42" }
                }
            ]
        } as never)

        expect(result[0]).toMatchObject({
            status: "succeeded",
            output: { success: true, stdout: "42" }
        })
        expect(result[0]?.errorText).toBeUndefined()
    })

    it("leaves malformed calls to the shared tool-failure card", () => {
        const result = getMessageCodeExecutions({
            role: "assistant",
            parts: [
                {
                    type: "tool-execute_code",
                    toolCallId: "code-1",
                    state: "output-error",
                    input: { purpose: "Missing code" },
                    errorText: "Invalid input for tool execute_code"
                }
            ]
        } as never)

        expect(result).toEqual([])
    })

    it("groups Math Kit calculations as Python executions", () => {
        const result = getMessageCodeExecutions({
            role: "assistant",
            parts: [
                {
                    type: "tool-execute_math",
                    toolCallId: "math-1",
                    state: "output-available",
                    input: { purpose: "Solving symbolically", code: "print(42)" },
                    output: { success: true, exitCode: 0, stdout: "42" }
                }
            ]
        } as never)

        expect(result[0]).toMatchObject({
            kind: "math",
            toolCallId: "math-1",
            status: "succeeded",
            title: "Solving symbolically",
            input: { language: "python" }
        })
    })

    it("distinguishes Math Kit work from general code execution", () => {
        const result = getMessageCodeExecutions({
            role: "assistant",
            parts: [
                {
                    type: "tool-execute_math",
                    toolCallId: "math-1",
                    state: "output-available",
                    input: { code: "print(1)" },
                    output: { success: true, exitCode: 0 }
                },
                {
                    type: "tool-execute_code",
                    toolCallId: "code-1",
                    state: "output-available",
                    input: { language: "python", code: "print(2)" },
                    output: { success: true, exitCode: 0 }
                }
            ]
        } as never)

        expect(result.map(({ toolCallId, kind }) => ({ toolCallId, kind }))).toEqual([
            { toolCallId: "math-1", kind: "math" },
            { toolCallId: "code-1", kind: "code" }
        ])
    })

    it("collapses transient duplicate parts for the same tool call", () => {
        const result = getMessageCodeExecutions({
            role: "assistant",
            parts: [
                {
                    type: "tool-execute_math",
                    toolCallId: "math-1",
                    state: "input-streaming",
                    input: { purpose: "Evaluating an integral", code: "print(value)" }
                },
                {
                    type: "tool-execute_math",
                    toolCallId: "math-1",
                    state: "input-available",
                    input: { purpose: "Evaluating an integral", code: "print(value)" }
                }
            ]
        } as never)

        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({
            kind: "math",
            toolCallId: "math-1",
            state: "input-available"
        })
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
