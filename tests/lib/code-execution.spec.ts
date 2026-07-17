import { afterEach, describe, expect, it } from "vitest"
import {
    getVercelSandboxCredentials,
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
})
