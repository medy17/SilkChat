import { afterEach, describe, expect, it } from "vitest"
import {
    getVercelSandboxCredentials,
    resolveCodeSandbox,
    truncateCodeExecutionOutput
} from "../../convex/lib/tools/code_execution_node"

afterEach(() => {
    Reflect.deleteProperty(process.env, "VERCEL_TEAM_ID")
    Reflect.deleteProperty(process.env, "VERCEL_PROJECT_ID")
    Reflect.deleteProperty(process.env, "VERCEL_TOKEN")
})

describe("code execution helpers", () => {
    it("requires the complete server-side credential set", () => {
        process.env.VERCEL_TEAM_ID = "team-1"
        process.env.VERCEL_PROJECT_ID = "project-1"

        expect(getVercelSandboxCredentials()).toBeNull()

        process.env.VERCEL_TOKEN = "token-1"
        expect(getVercelSandboxCredentials()).toEqual({
            teamId: "team-1",
            projectId: "project-1",
            token: "token-1"
        })
    })

    it("bounds tool output and marks truncation", () => {
        expect(truncateCodeExecutionOutput("short", 10)).toEqual({
            value: "short",
            truncated: false
        })
        expect(truncateCodeExecutionOutput("0123456789abcdef", 10)).toEqual({
            value: "0123456789\n[output truncated]",
            truncated: true
        })
    })

    it("forces compatible executions into an active persistent sandbox", () => {
        expect(
            resolveCodeSandbox({
                requestedMode: "ephemeral",
                runtime: "python3.13",
                activeSandbox: {
                    status: "active",
                    runtime: "python3.13",
                    sandboxName: "persistent-1",
                    expiresAt: 20_000
                },
                now: 10_000
            })
        ).toEqual({ mode: "persistent", sandboxName: "persistent-1" })
    })

    it("blocks an ephemeral runtime escape while a different persistent runtime is active", () => {
        expect(
            resolveCodeSandbox({
                requestedMode: "ephemeral",
                runtime: "node24",
                activeSandbox: {
                    status: "active",
                    runtime: "python3.13",
                    sandboxName: "persistent-1",
                    expiresAt: 20_000
                },
                now: 10_000
            })
        ).toEqual({
            error: "The active persistent sandbox uses python3.13; node24 execution cannot use an ephemeral sandbox until the active sandbox is killed."
        })
    })
})
