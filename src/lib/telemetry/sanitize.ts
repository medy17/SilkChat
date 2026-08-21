import type { CaptureResult } from "posthog-js"

const BLOCKED_PROPERTY_NAMES = new Set([
    "$ai_input",
    "$ai_output_choices",
    "$exception_message",
    "$exception_values",
    "api_key",
    "attachment_content",
    "attachment_name",
    "authorization",
    "cookie",
    "email",
    "file_content",
    "file_name",
    "filename",
    "input",
    "message_content",
    "output",
    "prompt",
    "provider_key",
    "response",
    "secret",
    "user_email"
])

const URL_PROPERTY_NAMES = new Set([
    "$current_url",
    "$initial_current_url",
    "$session_entry_url",
    "$referrer",
    "url",
    "url.full"
])

export const stripUrlDetails = (value: unknown) => {
    if (typeof value !== "string") return value
    try {
        const url = new URL(value, "https://silkchat.invalid")
        const cleanPath = `${url.pathname}`
        return url.origin === "https://silkchat.invalid" ? cleanPath : `${url.origin}${cleanPath}`
    } catch {
        return value.split(/[?#]/, 1)[0]
    }
}

export const sanitizeTelemetryProperties = (
    properties: Record<string, unknown> | undefined
): Record<string, unknown> | undefined => {
    if (!properties) return properties

    return Object.fromEntries(
        Object.entries(properties).flatMap(([key, value]) => {
            if (BLOCKED_PROPERTY_NAMES.has(key.toLowerCase())) return []
            if (key === "$exception_list" && Array.isArray(value)) {
                return [
                    [
                        key,
                        value.map((exception) =>
                            exception && typeof exception === "object"
                                ? { ...exception, value: "Frontend operation failed" }
                                : exception
                        )
                    ]
                ]
            }
            if (URL_PROPERTY_NAMES.has(key.toLowerCase())) return [[key, stripUrlDetails(value)]]
            return [[key, value]]
        })
    )
}

export const sanitizePostHogEvent = (event: CaptureResult | null): CaptureResult | null => {
    if (!event) return null
    return {
        ...event,
        properties: sanitizeTelemetryProperties(event.properties) as CaptureResult["properties"],
        $set: sanitizeTelemetryProperties(event.$set) as CaptureResult["$set"],
        $set_once: sanitizeTelemetryProperties(event.$set_once) as CaptureResult["$set_once"]
    }
}
