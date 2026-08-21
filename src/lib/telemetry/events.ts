export const TELEMETRY_EVENTS = {
    composerSubmitted: "composer submitted",
    modelManuallySelected: "model manually selected",
    advancedOptionsOpened: "advanced options opened",
    toolToggled: "tool toggled",
    retryRequested: "retry requested",
    conversationBranched: "conversation branched",
    generationStopped: "generation stopped",
    responseActioned: "response actioned",
    modelSelectorOpened: "model selector opened",
    modelSelectorClosed: "model selector closed",
    reasoningEffortManuallySelected: "reasoning effort manually selected",
    attachmentProcessingCompleted: "attachment processing completed",
    attachmentProcessingFailed: "attachment processing failed",
    usageLimitEncountered: "usage limit encountered",
    chatGenerationStarted: "chat generation started",
    chatGenerationCompleted: "chat generation completed",
    chatGenerationFailed: "chat generation failed"
} as const

export type TelemetryTargetMode = "normal" | "edit" | "retry"

type TelemetryValue = string | number | boolean | readonly string[] | null | undefined

export type TelemetryEventProperties = {
    [TELEMETRY_EVENTS.composerSubmitted]: {
        model_id: string | null
        thread_id: string | null
        attachment_count: number
        prompt_character_count: number
        prompt_estimated_tokens: number
        enabled_tool_count: number
        enabled_tool_ids: string[]
        existing_message_count: number
        is_new_thread: boolean
        intent: string | null
    }
    [TELEMETRY_EVENTS.modelManuallySelected]: {
        previous_model_id: string
        selected_model_id: string
        surface: "composer" | "message_edit" | "persona_settings"
    }
    [TELEMETRY_EVENTS.advancedOptionsOpened]: {
        surface: "mobile_overflow" | "desktop_tools"
        enabled_tool_ids: string[]
    }
    [TELEMETRY_EVENTS.toolToggled]: {
        tool_id: string
        enabled: boolean
        surface: "mobile_overflow" | "desktop_tools" | "automatic"
        model_id: string | null
    }
    [TELEMETRY_EVENTS.retryRequested]: {
        thread_id: string | null
        target_message_id: string
        retry_type: "same_model" | "different_model"
        original_model_id: string | null
        selected_model_id: string | null
    }
    [TELEMETRY_EVENTS.conversationBranched]: {
        source_thread_id: string
        new_thread_id: string
        source_message_id: string
        source_message_index: number
    }
    [TELEMETRY_EVENTS.generationStopped]: {
        thread_id: string | null
        message_id: string | null
        model_id: string | null
        elapsed_ms: number | null
        had_visible_output: boolean
    }
    [TELEMETRY_EVENTS.responseActioned]: {
        message_id: string
        action: "copy" | "download"
        asset_count: number
        model_id: string | null
    }
    [TELEMETRY_EVENTS.modelSelectorOpened]: {
        surface: "composer" | "message_edit" | "persona_settings"
        presentation: "mobile" | "desktop"
        available_model_count: number
    }
    [TELEMETRY_EVENTS.modelSelectorClosed]: {
        surface: "composer" | "message_edit" | "persona_settings"
        presentation: "mobile" | "desktop"
        selection_made: boolean
        search_used: boolean
        search_character_count: number
        result_count: number
    }
    [TELEMETRY_EVENTS.reasoningEffortManuallySelected]: {
        model_id: string | null
        previous_effort: string
        selected_effort: string
        surface: "composer_desktop" | "composer_mobile"
    }
    [TELEMETRY_EVENTS.attachmentProcessingCompleted]: {
        category: "image" | "pdf" | "document" | "code" | "text" | "other"
        size_bucket: "under_100_kb" | "100_kb_to_1_mb" | "1_mb_to_5_mb" | "over_5_mb"
        duration_ms: number
        stage: "inline_ingest" | "upload"
    }
    [TELEMETRY_EVENTS.attachmentProcessingFailed]: {
        category: "image" | "pdf" | "document" | "code" | "text" | "other"
        size_bucket: "under_100_kb" | "100_kb_to_1_mb" | "1_mb_to_5_mb" | "over_5_mb"
        duration_ms: number
        stage: "validation" | "conversion" | "upload"
        error_type: string
    }
    [TELEMETRY_EVENTS.usageLimitEncountered]: {
        window: "five_hour" | "monthly"
        used_usd: number | null
        limit_usd: number | null
        remaining_usd: number | null
    }
    [TELEMETRY_EVENTS.chatGenerationStarted]: {
        request_id: string
        thread_id: string
        message_id: string
        model_id: string
        provider: string
        target_mode: TelemetryTargetMode
        enabled_tool_count: number
        enabled_tool_ids: string[]
        available_tool_names: string[]
    }
    [TELEMETRY_EVENTS.chatGenerationCompleted]: {
        request_id: string
        thread_id: string
        message_id: string
        model_id: string
        provider: string
        target_mode: TelemetryTargetMode
        finish_reason: string
        duration_ms: number
        time_to_first_visible_ms: number | null
        prompt_tokens: number
        completion_tokens: number
        reasoning_tokens: number
        tool_call_count: number
        used_tool_names: string[]
        estimated_cost_usd: number | null
    }
    [TELEMETRY_EVENTS.chatGenerationFailed]: {
        request_id: string
        thread_id: string
        message_id: string
        model_id: string
        provider: string
        target_mode: TelemetryTargetMode
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
