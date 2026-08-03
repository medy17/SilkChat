import type { ResolvedToolAvailabilityMap } from "@/convex/lib/tools/availability"
import {
    getBlockedBuiltinTools,
    resolveBlockedBuiltinToolReasons
} from "@/convex/lib/tools/blocked"
import { describe, expect, it } from "vitest"

const available: ResolvedToolAvailabilityMap = {
    web_search: { enabled: true, fundingSource: "deployment" },
    code_execution: { enabled: true, fundingSource: "deployment" },
    supermemory: { enabled: true, fundingSource: "byok" },
    mcp: { enabled: false, fundingSource: "none" }
}

describe("blocked built-in tools", () => {
    it("distinguishes disabled, unconfigured, and auth-gated tools", () => {
        expect(
            resolveBlockedBuiltinToolReasons({
                requestedTools: ["supermemory"],
                callableTools: [],
                toolAvailability: {
                    ...available,
                    supermemory: { enabled: false, fundingSource: "none" }
                },
                isAnonymous: true
            })
        ).toEqual({
            web_search: "user_disabled",
            code_execution: "auth_required",
            supermemory: "not_configured"
        })
    })

    it("captures an attempted call without executing the real tool", async () => {
        const tools = getBlockedBuiltinTools({ code_execution: "user_disabled" })

        const output = await tools.execute_code.execute?.(
            {
                purpose: "Inspecting station identifiers",
                language: "python",
                code: "print('no execution')",
                dependencies: [],
                sandboxMode: "ephemeral",
                timeoutMs: 20_000
            },
            { toolCallId: "blocked-code" } as never
        )

        expect(output).toEqual({
            success: false,
            code: "tool_blocked",
            reason: "user_disabled",
            ability: "code_execution",
            toolName: "execute_code",
            toolLabel: "Code execution"
        })
    })
})
