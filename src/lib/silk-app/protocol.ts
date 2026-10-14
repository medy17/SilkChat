/**
 * Message contract between a SilkChat app frame (the sandboxed iframe that runs
 * model-written components) and the host message that embeds it. The frame has an
 * opaque origin, so both sides verify the message source rather than the origin.
 */

export const SILK_APP_LANGUAGE = "silk-app"

/** Inline frames grow with their content up to this height, then scroll. */
export const SILK_APP_MAX_INLINE_HEIGHT = 3200

const MAX_ERROR_LENGTH = 2000

/**
 * Theme colors the host sends, by their variable name in the frame. frame.css gives each
 * a fallback and a Tailwind color; the canvas kit resolves each for drawing.
 */
export const SILK_APP_THEME_COLORS = [
    "background",
    "foreground",
    "card",
    "card-foreground",
    "popover",
    "popover-foreground",
    "primary",
    "primary-foreground",
    "secondary",
    "secondary-foreground",
    "muted",
    "muted-foreground",
    "accent",
    "accent-foreground",
    "destructive",
    "destructive-foreground",
    "border",
    "input",
    "ring",
    "chart-1",
    "chart-2",
    "chart-3",
    "chart-4",
    "chart-5",
    "warning",
    "warning-foreground",
    "success"
] as const

export type SilkAppMode = "inline" | "expanded"

export type SilkAppTheme = {
    /** CSS custom properties to set on the frame root, keyed without the leading dashes. */
    vars: Record<string, string>
    dark: boolean
    rootFontSize: string
    /** Google Fonts stylesheets the host theme has loaded. */
    fontStylesheets: string[]
}

export type SilkAppFont = {
    family: string
    data: ArrayBuffer
    weight: string
    style: string
}

export type HostToFrameMessage =
    | { type: "silk-app:render"; code: string; mode: SilkAppMode; theme: SilkAppTheme }
    | { type: "silk-app:theme"; theme: SilkAppTheme }
    | { type: "silk-app:fonts"; fonts: SilkAppFont[] }

export type FrameToHostMessage =
    | { type: "silk-app:ready" }
    | { type: "silk-app:rendered"; height: number }
    | { type: "silk-app:resize"; height: number }
    /** Fatal errors leave nothing on screen: the app failed to compile or render. */
    | { type: "silk-app:error"; message: string; fatal: boolean }

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null

export const clampFrameHeight = (height: number) =>
    Number.isFinite(height) ? Math.min(Math.max(Math.ceil(height), 0), 100_000) : 0

/** Validates a message from a frame. The frame runs model code, so nothing is trusted. */
export const parseFrameMessage = (data: unknown): FrameToHostMessage | null => {
    if (!isRecord(data) || typeof data.type !== "string") return null

    switch (data.type) {
        case "silk-app:ready":
            return { type: data.type }
        case "silk-app:rendered":
        case "silk-app:resize":
            return typeof data.height === "number"
                ? { type: data.type, height: clampFrameHeight(data.height) }
                : null
        case "silk-app:error":
            return typeof data.message === "string"
                ? {
                      type: data.type,
                      message: data.message.slice(0, MAX_ERROR_LENGTH),
                      fatal: data.fatal === true
                  }
                : null
        default:
            return null
    }
}

const isTheme = (value: unknown): value is SilkAppTheme =>
    isRecord(value) &&
    isRecord(value.vars) &&
    typeof value.dark === "boolean" &&
    typeof value.rootFontSize === "string" &&
    Array.isArray(value.fontStylesheets)

export const parseHostMessage = (data: unknown): HostToFrameMessage | null => {
    if (!isRecord(data) || typeof data.type !== "string") return null

    switch (data.type) {
        case "silk-app:render":
            return typeof data.code === "string" &&
                (data.mode === "inline" || data.mode === "expanded") &&
                isTheme(data.theme)
                ? { type: data.type, code: data.code, mode: data.mode, theme: data.theme }
                : null
        case "silk-app:theme":
            return isTheme(data.theme) ? { type: data.type, theme: data.theme } : null
        case "silk-app:fonts":
            return Array.isArray(data.fonts)
                ? { type: data.type, fonts: data.fonts as SilkAppFont[] }
                : null
        default:
            return null
    }
}
