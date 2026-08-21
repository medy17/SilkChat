import type { TelemetryEventName, TelemetryEventProperties } from "@/lib/telemetry/events"
import { getTelemetryEnvironment } from "@/lib/telemetry/events"

type PostHogProperties = Record<string, unknown>

const getConfig = () => {
    const projectToken = process.env.POSTHOG_PROJECT_TOKEN?.trim()
    const host = process.env.POSTHOG_HOST?.trim()
    if (!projectToken || !host) return null
    return { projectToken, host: host.replace(/\/+$/, "") }
}

const commonProperties = () => ({
    app: "silkchat",
    environment: getTelemetryEnvironment(process.env.POSTHOG_ENVIRONMENT ?? process.env.NODE_ENV),
    release: process.env.APP_RELEASE?.trim() || "unknown",
    source: "convex",
    $geoip_disable: true
})

const sendEvent = async (args: {
    distinctId: string
    event: string
    properties: PostHogProperties
}) => {
    const config = getConfig()
    if (!config) return

    try {
        const response = await fetch(`${config.host}/batch/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: config.projectToken,
                batch: [
                    {
                        event: args.event,
                        properties: {
                            distinct_id: args.distinctId,
                            ...commonProperties(),
                            ...args.properties
                        },
                        timestamp: new Date().toISOString()
                    }
                ]
            })
        })

        if (!response.ok) {
            console.error("[telemetry] PostHog rejected an event", {
                event: args.event,
                status: response.status
            })
        }
    } catch (error) {
        console.error("[telemetry] Failed to capture a PostHog event", {
            event: args.event,
            errorType: error instanceof Error ? error.name : "unknown"
        })
    }
}

const parseStackFrames = (error: unknown) => {
    if (!(error instanceof Error) || !error.stack) return []

    return error.stack
        .split("\n")
        .slice(1)
        .flatMap((line) => {
            const match = line.trim().match(/^at (?:(.*?) \()?(.+?):(\d+):(\d+)\)?$/)
            if (!match) return []
            return [
                {
                    function: match[1] || "<anonymous>",
                    filename: match[2].split(/[?#]/, 1)[0],
                    lineno: Number(match[3]),
                    colno: Number(match[4]),
                    in_app: true
                }
            ]
        })
}

export const captureServerEvent = async <N extends TelemetryEventName>(args: {
    distinctId: string
    name: N
    properties: TelemetryEventProperties[N]
}) => {
    await sendEvent({
        distinctId: args.distinctId,
        event: args.name,
        properties: args.properties
    })
}

export const captureServerException = async (args: {
    distinctId: string
    error: unknown
    properties: Record<string, string | number | boolean | null>
}) => {
    const errorType =
        args.error instanceof Error && args.error.name ? args.error.name : "UnknownError"
    await sendEvent({
        distinctId: args.distinctId,
        event: "$exception",
        properties: {
            ...args.properties,
            $exception_type: errorType,
            $exception_message: "Backend operation failed",
            $exception_list: [
                {
                    type: errorType,
                    value: "Backend operation failed",
                    stacktrace: {
                        type: "raw",
                        frames: parseStackFrames(args.error)
                    }
                }
            ]
        }
    })
}

export const captureServerAiGeneration = async (args: {
    distinctId: string
    traceId: string
    generationId: string
    sessionId?: string
    model: string
    provider: string
    latencyMs: number
    inputTokens?: number
    outputTokens?: number
    totalCostUsd?: number | null
    finishReason?: string
    isError?: boolean
    errorType?: string
    functionName: string
}) => {
    await sendEvent({
        distinctId: args.distinctId,
        event: "$ai_generation",
        properties: {
            $ai_trace_id: args.traceId,
            $ai_generation_id: args.generationId,
            $ai_session_id: args.sessionId,
            $ai_model: args.model,
            $ai_provider: args.provider,
            $ai_latency: args.latencyMs / 1000,
            $ai_input_tokens: args.inputTokens,
            $ai_output_tokens: args.outputTokens,
            $ai_total_cost_usd: args.totalCostUsd,
            $ai_finish_reason: args.finishReason,
            $ai_is_error: args.isError ?? false,
            $ai_error_type: args.errorType,
            $ai_input: undefined,
            $ai_output_choices: undefined,
            function_name: args.functionName
        }
    })
}
