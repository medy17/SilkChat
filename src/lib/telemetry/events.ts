export const TELEMETRY_EVENTS = {
    composerSubmitted: "composer submitted",
    chatGenerationStarted: "chat generation started",
    chatGenerationCompleted: "chat generation completed",
    chatGenerationFailed: "chat generation failed"
} as const

type TelemetryValue = string | number | boolean | null | undefined

export type TelemetryEventProperties = {
    [TELEMETRY_EVENTS.composerSubmitted]: {
        model_id: string | null
        attachment_count: number
        enabled_tool_count: number
        is_new_thread: boolean
        intent: string | null
    }
    [TELEMETRY_EVENTS.chatGenerationStarted]: {
        request_id: string
        thread_id: string
        message_id: string
        model_id: string
        provider: string
        enabled_tool_count: number
    }
    [TELEMETRY_EVENTS.chatGenerationCompleted]: {
        request_id: string
        thread_id: string
        message_id: string
        model_id: string
        provider: string
        finish_reason: string
        duration_ms: number
        time_to_first_visible_ms: number | null
        prompt_tokens: number
        completion_tokens: number
        reasoning_tokens: number
        tool_call_count: number
        estimated_cost_usd: number | null
    }
    [TELEMETRY_EVENTS.chatGenerationFailed]: {
        request_id: string
        thread_id: string
        message_id: string
        model_id: string
        provider: string
        duration_ms: number
        error_type: string
    }
}

export type TelemetryEventName = keyof TelemetryEventProperties

export type TelemetryProperties = Record<string, TelemetryValue>

export type TelemetryEvent<N extends TelemetryEventName = TelemetryEventName> = {
    name: N
    properties: TelemetryEventProperties[N]
}

export const getTelemetryEnvironment = (value?: string) => {
    const normalized = value?.trim().toLowerCase()
    if (normalized === "production" || normalized === "staging" || normalized === "development") {
        return normalized
    }
    return "development"
}

export const getErrorType = (error: unknown) => {
    if (error instanceof Error && error.name) return error.name
    return typeof error === "string" ? "string" : "unknown"
}
