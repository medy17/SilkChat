import type { UIMessage } from "ai"

type UnknownRecord = Record<string, unknown>

export type CodeExecutionInput = {
    purpose?: string
    language?: "javascript" | "python"
    code?: string
    dependencies: string[]
    sandboxMode?: "ephemeral" | "persistent"
    timeoutMs?: number
}

export type CodeExecutionOutput = {
    success?: boolean
    phase?: string
    language?: "javascript" | "python"
    dependencies: string[]
    sandboxMode?: "ephemeral" | "persistent"
    networkAccess?: string
    exitCode?: number
    durationMs?: number
    stdout?: string
    stderr?: string
    outputTruncated?: boolean
    artifacts: UnknownRecord[]
    artifactErrors: UnknownRecord[]
    error?: string
}

export type MessageCodeExecution = {
    toolCallId: string
    state: string
    input: CodeExecutionInput
    output?: CodeExecutionOutput
    errorText?: string
    status: "running" | "succeeded" | "failed"
    title: string
}

type MessageWithParts = Pick<UIMessage, "role" | "parts">

const isRecord = (value: unknown): value is UnknownRecord =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const asTrimmedString = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : undefined

const asStringArray = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

const asRecordArray = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is UnknownRecord => isRecord(item)) : []

const getInput = (value: unknown): CodeExecutionInput => {
    if (!isRecord(value)) return { dependencies: [] }

    const language =
        value.language === "javascript" || value.language === "python" ? value.language : undefined
    const sandboxMode =
        value.sandboxMode === "ephemeral" || value.sandboxMode === "persistent"
            ? value.sandboxMode
            : undefined

    return {
        purpose: asTrimmedString(value.purpose),
        language,
        code: typeof value.code === "string" ? value.code : undefined,
        dependencies: asStringArray(value.dependencies),
        sandboxMode,
        timeoutMs: typeof value.timeoutMs === "number" ? value.timeoutMs : undefined
    }
}

const getOutput = (value: unknown): CodeExecutionOutput | undefined => {
    if (!isRecord(value)) return undefined

    const language =
        value.language === "javascript" || value.language === "python" ? value.language : undefined
    const sandboxMode =
        value.sandboxMode === "ephemeral" || value.sandboxMode === "persistent"
            ? value.sandboxMode
            : undefined

    return {
        success: typeof value.success === "boolean" ? value.success : undefined,
        phase: asTrimmedString(value.phase),
        language,
        dependencies: asStringArray(value.dependencies),
        sandboxMode,
        networkAccess: asTrimmedString(value.networkAccess),
        exitCode: typeof value.exitCode === "number" ? value.exitCode : undefined,
        durationMs: typeof value.durationMs === "number" ? value.durationMs : undefined,
        stdout: typeof value.stdout === "string" ? value.stdout : undefined,
        stderr: typeof value.stderr === "string" ? value.stderr : undefined,
        outputTruncated:
            typeof value.outputTruncated === "boolean" ? value.outputTruncated : undefined,
        artifacts: asRecordArray(value.artifacts),
        artifactErrors: asRecordArray(value.artifactErrors),
        error: asTrimmedString(value.error)
    }
}

const getFallbackTitle = (language?: CodeExecutionInput["language"]) => {
    if (language === "python") return "Running Python code"
    if (language === "javascript") return "Running JavaScript code"
    return "Running code"
}

export const getMessageCodeExecutions = (message: MessageWithParts) => {
    if (message.role !== "assistant") return []

    const executions: MessageCodeExecution[] = []

    for (const part of message.parts) {
        if (part.type !== "tool-execute_code") continue

        const invocation = part as typeof part & {
            toolCallId?: string
            state?: string
            input?: unknown
            output?: unknown
            errorText?: string
        }
        const input = getInput(invocation.input)
        const output = getOutput(invocation.output)
        const state = invocation.state ?? "input-streaming"
        const failed =
            state === "output-error" ||
            state === "output-denied" ||
            output?.success === false ||
            (typeof output?.exitCode === "number" && output.exitCode !== 0)
        const running = state !== "output-available" && !failed

        executions.push({
            toolCallId: invocation.toolCallId ?? `code-execution-${executions.length}`,
            state,
            input,
            output,
            errorText: asTrimmedString(invocation.errorText),
            status: failed ? "failed" : running ? "running" : "succeeded",
            title: input.purpose ?? getFallbackTitle(input.language)
        })
    }

    return executions
}
