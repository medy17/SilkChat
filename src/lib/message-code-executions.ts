import type { UIMessage } from "ai"
import { getToolFailureAttempt } from "./blocked-tool-attempt"

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
    kind: "code" | "math"
    toolCallId: string
    state: string
    input: CodeExecutionInput
    output?: CodeExecutionOutput
    errorText?: string
    status: "running" | "succeeded" | "failed" | "unresolved"
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
    const executionIndexesByCallId = new Map<string, number>()

    for (const part of message.parts) {
        if (part.type !== "tool-execute_code" && part.type !== "tool-execute_math") continue
        if (getToolFailureAttempt(part)) continue

        const invocation = part as typeof part & {
            toolCallId?: string
            state?: string
            input?: unknown
            output?: unknown
            errorText?: string
            toolMetadata?: Record<string, unknown>
        }
        const parsedInput = getInput(invocation.input)
        const input =
            part.type === "tool-execute_math"
                ? { ...parsedInput, language: "python" as const }
                : parsedInput
        const output = getOutput(invocation.output)
        const state = invocation.state ?? "input-streaming"
        const failed =
            state === "output-error" ||
            state === "output-denied" ||
            output?.success === false ||
            (typeof output?.exitCode === "number" && output.exitCode !== 0)
        const unresolved =
            state !== "output-available" &&
            invocation.toolMetadata?.silkchatPersistedWithoutTerminalResult === true &&
            !failed
        const running = state !== "output-available" && !failed && !unresolved

        const execution: MessageCodeExecution = {
            kind: part.type === "tool-execute_math" ? "math" : "code",
            toolCallId: invocation.toolCallId ?? `code-execution-${executions.length}`,
            state,
            input,
            output,
            errorText:
                asTrimmedString(invocation.errorText) ??
                (unresolved ? "No terminal result was recorded for this execution." : undefined),
            status: failed
                ? "failed"
                : unresolved
                  ? "unresolved"
                  : running
                    ? "running"
                    : "succeeded",
            title: input.purpose ?? getFallbackTitle(input.language)
        }
        const existingIndex = invocation.toolCallId
            ? executionIndexesByCallId.get(invocation.toolCallId)
            : undefined

        if (existingIndex === undefined) {
            if (invocation.toolCallId) {
                executionIndexesByCallId.set(invocation.toolCallId, executions.length)
            }
            executions.push(execution)
        } else {
            executions[existingIndex] = execution
        }
    }

    return executions
}
