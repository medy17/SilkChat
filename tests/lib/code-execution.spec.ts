import { afterEach, describe, expect, it } from "vitest"
import { z } from "zod"
import { codeExecutionInputSchema } from "../../convex/lib/tools/code_execution"
import {
    buildCodeExecutionArtifactPublicUrl,
    detectCodeExecutionArtifactMediaType,
    getCodeExecutionArtifactsFromToolOutput,
    sanitizeCodeExecutionArtifactFilename
} from "../../convex/lib/tools/code_execution_artifacts"
import {
    getVercelSandboxCredentials,
    resolveCodeSandbox,
    truncateCodeExecutionOutput
} from "../../convex/lib/tools/code_execution_node"
import {
    defaultSandboxRuntimeVersion,
    parseSandboxRuntime,
    parseSandboxRuntimeVersion,
    sandboxImageForRuntime
} from "../../convex/lib/sandbox_runtime"

afterEach(() => {
    Reflect.deleteProperty(process.env, "VERCEL_TEAM_ID")
    Reflect.deleteProperty(process.env, "VERCEL_PROJECT_ID")
    Reflect.deleteProperty(process.env, "VERCEL_TOKEN")
})

describe("code execution helpers", () => {
    it("keeps package validation out of the provider-facing JSON Schema", () => {
        const dependencies = z.toJSONSchema(codeExecutionInputSchema).properties?.dependencies as {
            items?: Record<string, unknown>
        }

        expect(dependencies.items).toEqual({
            type: "string",
            minLength: 1,
            maxLength: 150
        })
        expect(() =>
            codeExecutionInputSchema.parse({
                purpose: "Checking package validation",
                language: "javascript",
                code: "console.log('ok')",
                dependencies: ["@scope/package@^1.2.3", "malicious package"]
            })
        ).toThrow("Invalid package specifier")
    })

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

    it("accepts supported artifact signatures and rejects disguised active content", () => {
        expect(
            detectCodeExecutionArtifactMediaType(
                "report.pdf",
                new TextEncoder().encode("%PDF-1.7\nreport")
            )
        ).toBe("application/pdf")
        expect(
            detectCodeExecutionArtifactMediaType(
                "table.csv",
                new TextEncoder().encode("date,value\n2026-07-18,42\n")
            )
        ).toBe("text/csv")
        expect(
            detectCodeExecutionArtifactMediaType(
                "fake.pdf",
                new TextEncoder().encode("<html><script>alert(1)</script></html>")
            )
        ).toBeNull()
        expect(
            detectCodeExecutionArtifactMediaType(
                "report.html",
                new TextEncoder().encode("<h1>Report</h1>")
            )
        ).toBeNull()
    })

    it("sanitizes artifact display names and only accepts owned durable tool output", () => {
        expect(sanitizeCodeExecutionArtifactFilename("../../charts/summary.pdf\u0000")).toBe(
            "summary.pdf"
        )

        expect(
            getCodeExecutionArtifactsFromToolOutput(
                {
                    artifacts: [
                        {
                            key: "code-artifacts/user-1/one-report.pdf",
                            filename: "report.pdf",
                            mediaType: "application/pdf",
                            size: 1234
                        },
                        {
                            key: "code-artifacts/another-user/stolen.pdf",
                            filename: "stolen.pdf",
                            mediaType: "application/pdf",
                            size: 1234
                        }
                    ]
                },
                "user-1"
            )
        ).toEqual([
            {
                key: "code-artifacts/user-1/one-report.pdf",
                filename: "report.pdf",
                mediaType: "application/pdf",
                size: 1234
            }
        ])
    })

    it("builds a direct public artifact URL without exposing a sandbox-local path", () => {
        expect(
            buildCodeExecutionArtifactPublicUrl(
                "code-artifacts/user-1/report with spaces.pdf",
                "https://assets.example.com/bucket/"
            )
        ).toBe("https://assets.example.com/bucket/code-artifacts/user-1/report%20with%20spaces.pdf")
        expect(
            buildCodeExecutionArtifactPublicUrl(
                "code-artifacts/user-1/report.pdf",
                "javascript:alert(1)"
            )
        ).toBeUndefined()
    })

    it("routes Python execution into an active Python sandbox", () => {
        expect(
            resolveCodeSandbox({
                requestedMode: "ephemeral",
                language: "python",
                activeSandbox: {
                    status: "active",
                    runtime: "python",
                    sandboxName: "persistent-1",
                    expiresAt: 20_000
                },
                now: 10_000
            })
        ).toEqual({
            mode: "persistent",
            runtime: "python",
            sandboxName: "persistent-1"
        })
    })

    it("blocks an ephemeral runtime escape while a different persistent runtime is active", () => {
        expect(
            resolveCodeSandbox({
                requestedMode: "ephemeral",
                language: "javascript",
                activeSandbox: {
                    status: "active",
                    runtime: "python",
                    sandboxName: "persistent-1",
                    expiresAt: 20_000
                },
                now: 10_000
            })
        ).toEqual({
            error: "The active persistent sandbox uses python; node execution cannot use an ephemeral sandbox until the active sandbox is killed."
        })
    })

    it("builds images from explicit runtime version locks", () => {
        expect(defaultSandboxRuntimeVersion("node")).toBe("24")
        expect(defaultSandboxRuntimeVersion("python")).toBe("3.14")
        expect(sandboxImageForRuntime("node", "22")).toBe("vercel/sandbox/node:22")
        expect(sandboxImageForRuntime("python", "3.14")).toBe("vercel/sandbox/python:3.14")
        expect(parseSandboxRuntime("ruby")).toBeNull()
        expect(parseSandboxRuntimeVersion("3.14")).toBe("3.14")
        expect(parseSandboxRuntimeVersion("../../ubuntu")).toBeNull()
    })
})
