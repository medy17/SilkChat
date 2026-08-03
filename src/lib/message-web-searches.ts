import type { UIMessage } from "ai"
import { getBlockedToolAttempt } from "./blocked-tool-attempt"

type UnknownRecord = Record<string, unknown>

export type WebSearchResult = {
    url?: string
    title?: string
    description?: string
    snippet?: string
}

export type MessageWebSearch = {
    toolCallId: string
    query: string
    results: WebSearchResult[]
    error?: string
    status: "running" | "succeeded" | "failed"
}

type MessageWithParts = Pick<UIMessage, "role" | "parts">

const isRecord = (value: unknown): value is UnknownRecord =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const asTrimmedString = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : undefined

const getResults = (value: unknown): WebSearchResult[] => {
    if (!isRecord(value) || !Array.isArray(value.results)) return []

    return value.results.filter(isRecord).map((result) => ({
        url: asTrimmedString(result.url),
        title: asTrimmedString(result.title),
        description: asTrimmedString(result.description),
        snippet: asTrimmedString(result.snippet)
    }))
}

export const getMessageWebSearches = (message: MessageWithParts) => {
    if (message.role !== "assistant") return []

    const searches: MessageWebSearch[] = []

    for (const part of message.parts) {
        if (part.type !== "tool-web_search") continue
        if (getBlockedToolAttempt(part)) continue

        const invocation = part as typeof part & {
            toolCallId?: string
            state?: string
            input?: unknown
            output?: unknown
            errorText?: string
        }
        const input = isRecord(invocation.input) ? invocation.input : undefined
        const output = isRecord(invocation.output) ? invocation.output : undefined
        const state = invocation.state ?? "input-streaming"
        const failed =
            state === "output-error" || state === "output-denied" || output?.success === false
        const running = state !== "output-available" && !failed

        searches.push({
            toolCallId: invocation.toolCallId ?? `web-search-${searches.length}`,
            query:
                asTrimmedString(input?.query) ??
                asTrimmedString(output?.query) ??
                "Searching the web",
            results: getResults(output),
            error: asTrimmedString(invocation.errorText) ?? asTrimmedString(output?.error),
            status: failed ? "failed" : running ? "running" : "succeeded"
        })
    }

    return searches
}
