import { optionalBrowserEnv } from "@/lib/browser-env"
import posthog from "posthog-js"
import type { TelemetryEventName, TelemetryEventProperties } from "./events"

export const isBrowserTelemetryConfigured = () =>
    Boolean(optionalBrowserEnv("VITE_POSTHOG_KEY") && optionalBrowserEnv("VITE_POSTHOG_HOST"))

export const captureBrowserEvent = <N extends TelemetryEventName>(
    name: N,
    properties: TelemetryEventProperties[N]
) => {
    if (!isBrowserTelemetryConfigured()) return
    posthog.capture(name, properties)
}

export const captureBrowserException = (
    error: unknown,
    properties?: Record<string, string | number | boolean | null>
) => {
    if (!isBrowserTelemetryConfigured()) return

    const safeError = new Error("Frontend operation failed")
    safeError.name = error instanceof Error && error.name ? error.name : "UnknownError"
    if (error instanceof Error && error.stack) {
        safeError.stack = [
            `${safeError.name}: ${safeError.message}`,
            ...error.stack.split("\n").slice(1)
        ].join("\n")
    }
    posthog.captureException(safeError, properties)
}
