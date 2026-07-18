import { describe, expect, it, vi } from "vitest"
import { wrapToolsWithExecutionLimits } from "../../convex/lib/toolkit"

describe("wrapToolsWithExecutionLimits", () => {
    it("returns a synthetic exhaustion result without executing the underlying tool", async () => {
        const execute = vi.fn()
        const tools = wrapToolsWithExecutionLimits(
            {
                web_search: {
                    description: "Search",
                    execute
                } as any
            },
            {
                consumeToolCall: vi.fn().mockResolvedValue({
                    allowed: false,
                    remainingCalls: 0
                })
            }
        )

        const result = await tools.web_search.execute?.({ query: "latest news" }, {
            toolCallId: "call-1"
        } as any)

        expect(execute).not.toHaveBeenCalled()
        expect(result).toEqual({
            success: false,
            code: "tool_budget_exhausted",
            error: "No remaining tool calls for this turn.",
            remainingToolCalls: 0
        })
    })

    it("passes through to the underlying tool when a reserved slot is available", async () => {
        const execute = vi.fn().mockResolvedValue({ success: true })
        const consumeToolCall = vi.fn().mockResolvedValue({
            allowed: true,
            remainingCalls: 2
        })
        const tools = wrapToolsWithExecutionLimits(
            {
                add_memory: {
                    description: "Add memory",
                    execute
                } as any
            },
            {
                consumeToolCall
            }
        )

        const result = await tools.add_memory.execute?.({ content: "remember this" }, {
            toolCallId: "call-2"
        } as any)

        expect(consumeToolCall).toHaveBeenCalledWith({
            toolName: "add_memory",
            toolCallId: "call-2"
        })
        expect(execute).toHaveBeenCalledWith({ content: "remember this" }, { toolCallId: "call-2" })
        expect(result).toEqual({ success: true })
    })

    it("converts thrown tool errors into structured execution failures", async () => {
        const tools = wrapToolsWithExecutionLimits(
            {
                failing_tool: {
                    description: "Failing tool",
                    execute: vi.fn().mockRejectedValue(new Error("boom"))
                } as any
            },
            {
                consumeToolCall: vi.fn().mockResolvedValue({
                    allowed: true,
                    remainingCalls: 1
                })
            }
        )

        const result = await tools.failing_tool.execute?.({}, { toolCallId: "call-3" } as any)

        expect(result).toEqual({
            success: false,
            code: "tool_execution_failed",
            error: "boom"
        })
    })

    it("allows sandbox release even after the ordinary tool budget is exhausted", async () => {
        const execute = vi.fn().mockResolvedValue({ success: true, released: true })
        const consumeToolCall = vi.fn().mockResolvedValue({ allowed: false, remainingCalls: 0 })
        const tools = wrapToolsWithExecutionLimits(
            {
                release_persistent_sandbox: {
                    description: "Release workspace",
                    execute
                } as any
            },
            { consumeToolCall }
        )

        const result = await tools.release_persistent_sandbox.execute?.({}, {
            toolCallId: "release-1"
        } as any)

        expect(consumeToolCall).not.toHaveBeenCalled()
        expect(execute).toHaveBeenCalled()
        expect(result).toEqual({ success: true, released: true })
    })

    it("settles measured tool usage without exposing internal billing metadata", async () => {
        const settleToolCall = vi.fn().mockResolvedValue({ reconciled: true })
        const tools = wrapToolsWithExecutionLimits(
            {
                execute_code: {
                    description: "Execute code",
                    execute: vi.fn().mockResolvedValue({
                        success: true,
                        stdout: "done",
                        __toolBilling: {
                            settledMicrousd: 1_234,
                            pricingSource: "sandbox_reported"
                        }
                    })
                } as any
            },
            {
                consumeToolCall: vi.fn().mockResolvedValue({ allowed: true }),
                settleToolCall
            }
        )

        const result = await tools.execute_code.execute?.({}, { toolCallId: "code-1" } as any)

        expect(settleToolCall).toHaveBeenCalledWith({
            toolName: "execute_code",
            toolCallId: "code-1",
            settledMicrousd: 1_234,
            pricingSource: "sandbox_reported"
        })
        expect(result).toEqual({ success: true, stdout: "done" })
    })
})
