"use node"

import { posix } from "node:path"
import { Sandbox } from "@vercel/sandbox"
import type { GenericActionCtx } from "convex/server"
import { v } from "convex/values"
import { internal } from "../../_generated/api"
import type { DataModel } from "../../_generated/dataModel"
import { internalAction } from "../../_generated/server"
import { r2 } from "../../attachments"
import {
    calculateSandboxUsageMicrousd,
    collectSandboxBillableUsage,
    sandboxSessionNeedsStop
} from "../sandbox_billing"
import {
    defaultSandboxRuntimeVersion,
    sandboxImageForRuntime,
    sandboxRuntimeForLanguage
} from "../sandbox_runtime"
import {
    CODE_EXECUTION_ARTIFACT_DIRECTORY_ENV,
    CODE_EXECUTION_ARTIFACT_STORAGE_ROOT,
    type CodeExecutionArtifact,
    type CodeExecutionArtifactError,
    MAX_CODE_EXECUTION_ARTIFACTS,
    MAX_CODE_EXECUTION_ARTIFACT_BYTES,
    MAX_CODE_EXECUTION_ARTIFACT_DEPTH,
    MAX_CODE_EXECUTION_ARTIFACT_SCAN_ENTRIES,
    MAX_CODE_EXECUTION_ARTIFACT_TOTAL_BYTES,
    buildCodeExecutionArtifactPublicUrl,
    detectCodeExecutionArtifactMediaType,
    sanitizeCodeExecutionArtifactFilename,
    sanitizeCodeExecutionArtifactStorageSegment
} from "./code_execution_artifacts"

const DEPENDENCY_INSTALL_TIMEOUT_MS = 90_000
const SANDBOX_SESSION_TIMEOUT_MS = 140_000
const MAX_OUTPUT_CHARS_PER_STREAM = 32_000
const OUTPUT_HEAD_SHARE = 0.25
const MAX_CODE_CHARS = 100_000
const MAX_DEPENDENCIES = 10
const PACKAGE_SPECIFIER = /^[a-zA-Z0-9@._+\-/[\],=<>!~^]+$/
const SANDBOX_ARTIFACT_ROOT = "/vercel/sandbox/.silkchat/artifacts"

export const getVercelSandboxCredentials = () => {
    const teamId = process.env.VERCEL_TEAM_ID?.trim()
    const projectId = process.env.VERCEL_PROJECT_ID?.trim()
    const token = process.env.VERCEL_TOKEN?.trim()

    return teamId && projectId && token ? { teamId, projectId, token } : null
}

export const truncateCodeExecutionOutput = (
    value: string,
    maxChars = MAX_OUTPUT_CHARS_PER_STREAM
): { value: string; truncated: boolean } => {
    if (value.length <= maxChars) return { value, truncated: false }
    // Builds and test runs report what went wrong last, so most of the budget goes to the end.
    const head = Math.floor(maxChars * OUTPUT_HEAD_SHARE)
    const tail = maxChars - head
    const omitted = value.length - maxChars
    return {
        value: `${value.slice(0, head)}\n[${omitted} characters truncated]\n${value.slice(-tail)}`,
        truncated: true
    }
}

export const collectCommandOutput = async (command: {
    stdout: () => Promise<string>
    stderr: () => Promise<string>
}) => {
    const [rawStdout, rawStderr] = await Promise.all([command.stdout(), command.stderr()])
    const stdout = truncateCodeExecutionOutput(rawStdout)
    const stderr = truncateCodeExecutionOutput(rawStderr)

    return {
        stdout: stdout.value,
        stderr: stderr.value,
        outputTruncated: stdout.truncated || stderr.truncated
    }
}

const readSandboxFileBounded = async (sandbox: Sandbox, path: string) => {
    const stream = await sandbox.readFile({ path })
    if (!stream) throw new Error("Artifact disappeared before it could be exported")

    const chunks: Buffer[] = []
    let size = 0
    try {
        for await (const rawChunk of stream as NodeJS.ReadableStream & AsyncIterable<unknown>) {
            const chunk = Buffer.isBuffer(rawChunk)
                ? rawChunk
                : typeof rawChunk === "string"
                  ? Buffer.from(rawChunk)
                  : Buffer.from(rawChunk as Uint8Array)
            size += chunk.byteLength
            if (size > MAX_CODE_EXECUTION_ARTIFACT_BYTES) {
                throw new Error("Artifact exceeds the 15 MB per-file limit")
            }
            chunks.push(chunk)
        }
    } catch (error) {
        if ("destroy" in stream && typeof stream.destroy === "function") stream.destroy()
        throw error
    }

    return Buffer.concat(chunks, size)
}

export const exportSandboxArtifacts = async ({
    sandbox,
    artifactDirectory,
    userId,
    ctx
}: {
    sandbox: Sandbox
    artifactDirectory: string
    userId: string
    ctx: GenericActionCtx<DataModel>
}): Promise<{
    artifacts: CodeExecutionArtifact[]
    artifactErrors: CodeExecutionArtifactError[]
}> => {
    const artifacts: CodeExecutionArtifact[] = []
    const artifactErrors: CodeExecutionArtifactError[] = []
    const candidates: Array<{ path: string; relativePath: string; size: number }> = []
    let scannedEntries = 0

    const addError = (filename: string, error: string) => {
        if (artifactErrors.length < 20) artifactErrors.push({ filename, error })
    }

    const walk = async (directory: string, relativeDirectory: string, depth: number) => {
        const entries = await sandbox.fs.readdir(directory, { withFileTypes: true })
        entries.sort((left, right) => left.name.localeCompare(right.name))

        for (const entry of entries) {
            scannedEntries += 1
            if (scannedEntries > MAX_CODE_EXECUTION_ARTIFACT_SCAN_ENTRIES) {
                addError(
                    "artifact directory",
                    "Too many output-directory entries; only 100 are scanned"
                )
                return
            }

            const path = posix.join(directory, entry.name)
            const relativePath = relativeDirectory
                ? posix.join(relativeDirectory, entry.name)
                : entry.name
            const stats = await sandbox.fs.lstat(path)

            if (stats.isSymbolicLink()) {
                addError(relativePath, "Symbolic links cannot be exported")
                continue
            }
            if (stats.isDirectory()) {
                if (depth >= MAX_CODE_EXECUTION_ARTIFACT_DEPTH) {
                    addError(
                        relativePath,
                        "Artifact directories may be nested at most three levels"
                    )
                    continue
                }
                await walk(path, relativePath, depth + 1)
                continue
            }
            if (!stats.isFile()) {
                addError(relativePath, "Only regular files can be exported")
                continue
            }

            const realPath = await sandbox.fs.realpath(path)
            if (!realPath.startsWith(`${artifactDirectory}/`)) {
                addError(relativePath, "Artifact resolves outside the output directory")
                continue
            }
            if (stats.size > MAX_CODE_EXECUTION_ARTIFACT_BYTES) {
                addError(relativePath, "Artifact exceeds the 15 MB per-file limit")
                continue
            }
            candidates.push({ path, relativePath, size: stats.size })
        }
    }

    try {
        await walk(artifactDirectory, "", 0)
    } catch (error) {
        addError(
            "artifact directory",
            error instanceof Error ? error.message : "Failed to inspect generated artifacts"
        )
        return { artifacts, artifactErrors }
    }

    let totalBytes = 0
    for (const candidate of candidates) {
        if (artifacts.length >= MAX_CODE_EXECUTION_ARTIFACTS) {
            addError(candidate.relativePath, "Only five artifacts can be exported per execution")
            continue
        }
        if (totalBytes + candidate.size > MAX_CODE_EXECUTION_ARTIFACT_TOTAL_BYTES) {
            addError(candidate.relativePath, "Artifacts exceed the 25 MB aggregate limit")
            continue
        }

        try {
            const bytes = await readSandboxFileBounded(sandbox, candidate.path)
            if (totalBytes + bytes.byteLength > MAX_CODE_EXECUTION_ARTIFACT_TOTAL_BYTES) {
                addError(candidate.relativePath, "Artifacts exceed the 25 MB aggregate limit")
                continue
            }

            const filename = sanitizeCodeExecutionArtifactFilename(candidate.relativePath)
            const mediaType = detectCodeExecutionArtifactMediaType(filename, bytes)
            if (!mediaType) {
                addError(candidate.relativePath, "Unsupported file type or invalid file signature")
                continue
            }

            const key = `${CODE_EXECUTION_ARTIFACT_STORAGE_ROOT}/${userId}/${Date.now()}-${crypto.randomUUID()}-${sanitizeCodeExecutionArtifactStorageSegment(filename)}`
            const storedKey = await r2.store(ctx, bytes, {
                authorId: userId,
                key,
                type: mediaType
            })
            const url = buildCodeExecutionArtifactPublicUrl(
                storedKey,
                process.env.R2_PUBLIC_BASE_URL
            )
            artifacts.push({
                key: storedKey,
                filename,
                mediaType,
                size: bytes.byteLength,
                ...(url ? { url } : {})
            })
            totalBytes += bytes.byteLength
        } catch (error) {
            addError(
                candidate.relativePath,
                error instanceof Error ? error.message : "Failed to export artifact"
            )
        }
    }

    return { artifacts, artifactErrors }
}

const validateExecutionInput = (code: string, dependencies: string[]) => {
    if (code.length === 0 || code.length > MAX_CODE_CHARS) {
        throw new Error("Code exceeds the supported execution size")
    }
    if (dependencies.length > MAX_DEPENDENCIES) {
        throw new Error("Too many dependencies")
    }
    if (
        dependencies.some(
            (dependency) =>
                dependency.length === 0 ||
                dependency.length > 150 ||
                dependency.startsWith("-") ||
                !PACKAGE_SPECIFIER.test(dependency)
        )
    ) {
        throw new Error("Invalid dependency specifier")
    }
}

export const executeCode = internalAction({
    args: {
        userId: v.string(),
        language: v.union(v.literal("javascript"), v.literal("python")),
        code: v.string(),
        dependencies: v.array(v.string()),
        timeoutMs: v.number()
    },
    handler: async (ctx, { userId, language, code, dependencies, timeoutMs }) => {
        validateExecutionInput(code, dependencies)
        const credentials = getVercelSandboxCredentials()
        if (!credentials) {
            return {
                success: false,
                phase: "sandbox",
                language,
                error: "Vercel Sandbox is not configured"
            }
        }

        const extension = language === "javascript" ? "mjs" : "py"
        const executionId = crypto.randomUUID()
        const filename = `main-${executionId}.${extension}`
        const artifactDirectory = `${SANDBOX_ARTIFACT_ROOT}/${executionId}`
        let sandbox: Sandbox | undefined

        const finalizeToolBilling = async () => {
            if (!sandbox) return { settledMicrousd: 0, pricingSource: "sandbox_reported" as const }

            const ephemeralSandbox = sandbox
            sandbox = undefined
            try {
                await ephemeralSandbox.fs
                    .rm(artifactDirectory, { recursive: true, force: true })
                    .catch(() => undefined)
                if (sandboxSessionNeedsStop(ephemeralSandbox.status)) {
                    await ephemeralSandbox.stop()
                }
                const usage = await collectSandboxBillableUsage(ephemeralSandbox)
                const settledMicrousd = calculateSandboxUsageMicrousd(usage)
                await ephemeralSandbox.delete()
                return { settledMicrousd, pricingSource: "sandbox_reported" as const }
            } catch (error) {
                console.error("Failed to capture ephemeral sandbox billing", error)
                await ephemeralSandbox.delete().catch(() => undefined)
                return undefined
            }
        }

        try {
            const runtime = sandboxRuntimeForLanguage(language)
            sandbox = await Sandbox.create({
                ...credentials,
                image: sandboxImageForRuntime(runtime, defaultSandboxRuntimeVersion(runtime)),
                resources: { vcpus: 1 },
                timeout: SANDBOX_SESSION_TIMEOUT_MS,
                persistent: false,
                networkPolicy: "allow-all",
                tags: { app: "silkchat", feature: "code-execution" }
            })

            if (!sandbox) throw new Error("Sandbox failed to initialize")
            await sandbox.fs.mkdir(artifactDirectory, { recursive: true })
            await sandbox.writeFiles([{ path: filename, content: Buffer.from(code) }])

            if (dependencies.length > 0) {
                const installCommand =
                    language === "javascript"
                        ? {
                              cmd: "npm",
                              args: ["install", "--no-audit", "--no-fund", "--", ...dependencies]
                          }
                        : {
                              cmd: "python",
                              args: [
                                  "-m",
                                  "pip",
                                  "install",
                                  "--disable-pip-version-check",
                                  "--no-input",
                                  ...dependencies
                              ]
                          }
                const installResult = await sandbox.runCommand({
                    ...installCommand,
                    timeoutMs: DEPENDENCY_INSTALL_TIMEOUT_MS
                })

                if (installResult.exitCode !== 0) {
                    return {
                        success: false,
                        phase: "dependency_install",
                        language,
                        dependencies,
                        exitCode: installResult.exitCode,
                        durationMs: installResult.durationMs,
                        ...(await collectCommandOutput(installResult)),
                        __toolBilling: await finalizeToolBilling()
                    }
                }
            }

            const result = await sandbox.runCommand({
                cmd: language === "javascript" ? "node" : "python",
                args: [filename],
                env: { [CODE_EXECUTION_ARTIFACT_DIRECTORY_ENV]: artifactDirectory },
                timeoutMs: Math.min(30_000, Math.max(1_000, Math.round(timeoutMs)))
            })
            const artifactResult = await exportSandboxArtifacts({
                sandbox,
                artifactDirectory,
                userId,
                ctx
            })

            return {
                success: result.exitCode === 0,
                phase: "execution",
                language,
                dependencies,
                networkAccess: "public-internet",
                exitCode: result.exitCode,
                durationMs: result.durationMs,
                ...(await collectCommandOutput(result)),
                ...artifactResult,
                __toolBilling: await finalizeToolBilling()
            }
        } catch (error) {
            return {
                success: false,
                phase: "sandbox",
                language,
                error: error instanceof Error ? error.message : "Sandbox execution failed",
                __toolBilling: await finalizeToolBilling()
            }
        } finally {
            if (sandbox) {
                await sandbox.delete().catch(async (error) => {
                    console.error("Failed to delete code execution sandbox", error)
                    await sandbox
                        ?.stop()
                        .catch((stopError) =>
                            console.error("Failed to stop code execution sandbox", stopError)
                        )
                })
            }
        }
    }
})
