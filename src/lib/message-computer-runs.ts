import type { UIMessage } from "ai"
import { getToolFailureAttempt } from "./blocked-tool-attempt"

export type MessageComputerRun = {
    toolCallId: string
    title: string
    command?: string
    status: "running" | "succeeded" | "failed"
    exitCode?: number
    durationMs?: number
    stdout?: string
    stderr?: string
    error?: string
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const asString = (value: unknown) => (typeof value === "string" && value ? value : undefined)

const asNumber = (value: unknown) => (typeof value === "number" ? value : undefined)

export const getMessageComputerRuns = (message: Pick<UIMessage, "role" | "parts">) => {
    if (message.role !== "assistant") return []

    const runs: MessageComputerRun[] = []
    for (const part of message.parts) {
        if (part.type !== "tool-computer_run" || getToolFailureAttempt(part)) continue

        const invocation = part as typeof part & {
            toolCallId?: string
            state?: string
            input?: unknown
            output?: unknown
            errorText?: string
            toolMetadata?: Record<string, unknown>
        }
        const input = isRecord(invocation.input) ? invocation.input : {}
        const output = isRecord(invocation.output) ? invocation.output : undefined
        // A reply cut off mid-command never gets a result, and must not spin forever.
        const interrupted =
            invocation.state !== "output-available" &&
            invocation.toolMetadata?.silkchatPersistedWithoutTerminalResult === true
        const error =
            invocation.errorText ??
            asString(output?.error) ??
            (interrupted ? "No result was recorded for this step." : undefined)
        const finished =
            interrupted ||
            invocation.state === "output-available" ||
            invocation.state === "output-error" ||
            invocation.state === "output-denied"

        runs.push({
            toolCallId: invocation.toolCallId ?? `computer-run-${runs.length}`,
            title: asString(input.purpose) ?? "Running a command",
            command: asString(input.command),
            status: !finished
                ? "running"
                : output?.success === true && !error
                  ? "succeeded"
                  : "failed",
            exitCode: asNumber(output?.exitCode),
            durationMs: asNumber(output?.durationMs),
            stdout: asString(output?.stdout),
            stderr: asString(output?.stderr),
            error
        })
    }
    return runs
}
