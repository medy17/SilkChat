import { getErrorType, getTelemetryEnvironment } from "@/lib/telemetry/events"
import {
    sanitizePostHogEvent,
    sanitizeTelemetryProperties,
    stripUrlDetails
} from "@/lib/telemetry/sanitize"
import { describe, expect, it } from "vitest"

describe("telemetry privacy", () => {
    it("removes content and credentials while preserving operational properties", () => {
        expect(
            sanitizeTelemetryProperties({
                model_id: "gpt-5",
                prompt: "private question",
                response: "private answer",
                authorization: "Bearer secret",
                duration_ms: 120
            })
        ).toEqual({
            model_id: "gpt-5",
            duration_ms: 120
        })
    })

    it("removes query strings and fragments from captured URLs", () => {
        expect(stripUrlDetails("https://silkchat.dev/thread/123?token=secret#message")).toBe(
            "https://silkchat.dev/thread/123"
        )
        expect(stripUrlDetails("/settings?email=user@example.com")).toBe("/settings")
    })

    it("sanitizes event, person, and set-once properties", () => {
        expect(
            sanitizePostHogEvent({
                uuid: "event-uuid",
                event: "composer submitted",
                properties: { prompt: "private", model_id: "gpt-5" },
                $set: { email: "user@example.com", plan: "pro" },
                $set_once: { file_name: "private.pdf", source: "web" }
            })
        ).toEqual({
            uuid: "event-uuid",
            event: "composer submitted",
            properties: { model_id: "gpt-5" },
            $set: { plan: "pro" },
            $set_once: { source: "web" }
        })
    })

    it("redacts exception messages while preserving their type and stack", () => {
        expect(
            sanitizeTelemetryProperties({
                $exception_message: "private provider response",
                $exception_list: [
                    {
                        type: "TypeError",
                        value: "private provider response",
                        stacktrace: { frames: [{ filename: "app.tsx", lineno: 42 }] }
                    }
                ]
            })
        ).toEqual({
            $exception_list: [
                {
                    type: "TypeError",
                    value: "Frontend operation failed",
                    stacktrace: { frames: [{ filename: "app.tsx", lineno: 42 }] }
                }
            ]
        })
    })
})

describe("telemetry metadata", () => {
    it("normalizes known environments and rejects arbitrary values", () => {
        expect(getTelemetryEnvironment(" Production ")).toBe("production")
        expect(getTelemetryEnvironment("preview-123")).toBe("development")
    })

    it("classifies errors without exposing their messages", () => {
        expect(getErrorType(new TypeError("private content"))).toBe("TypeError")
        expect(getErrorType("private content")).toBe("string")
    })
})
