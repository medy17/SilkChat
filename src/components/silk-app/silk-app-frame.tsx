import { useResolvedThemeMode } from "@/hooks/use-resolved-theme-mode"
import { buildSilkAppDocument, loadSilkAppFonts, readSilkAppTheme } from "@/lib/silk-app/host-theme"
import {
    type HostToFrameMessage,
    SILK_APP_MAX_INLINE_HEIGHT,
    type SilkAppMode,
    parseFrameMessage
} from "@/lib/silk-app/protocol"
import { useThemeStore } from "@/lib/theme-store"
import { cn } from "@/lib/utils"
import { memo, useEffect, useEffectEvent, useRef, useState } from "react"

/** How long a frame gets to boot and render before it reads as failed. */
const START_TIMEOUT_MS = 15_000

export type SilkAppFrameStatus =
    | { status: "loading" }
    | { status: "rendered" }
    | { status: "error"; message: string }

/**
 * Runs a model-written app in a sandboxed frame. `allow-scripts` without
 * `allow-same-origin` gives the frame an opaque origin: no cookies, storage, or access
 * to this page, whatever the code does. The document's CSP keeps it off the network.
 */
export const SilkAppFrame = memo(function SilkAppFrame({
    code,
    mode,
    title,
    onStatusChange,
    className
}: {
    code: string
    mode: SilkAppMode
    title: string
    onStatusChange: (status: SilkAppFrameStatus) => void
    className?: string
}) {
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const readyRef = useRef(false)
    const [srcDoc] = useState(() => buildSilkAppDocument(window.location.origin))
    const [height, setHeight] = useState(0)
    // Until the app has rendered, the frame fills its placeholder instead of measuring 0px:
    // browsers pause rendering in zero-size cross-origin frames.
    const [revealed, setRevealed] = useState(false)
    const loadCountRef = useRef(0)
    const [navigatedAway, setNavigatedAway] = useState(false)
    const { themeState } = useThemeStore()
    const isDark = useResolvedThemeMode(themeState.currentMode) === "dark"

    const send = (message: HostToFrameMessage) =>
        iframeRef.current?.contentWindow?.postMessage(message, "*")

    // A frame that never answers would otherwise spin forever; surface it as an error.
    const watchdogRef = useRef(0)
    const armWatchdog = useEffectEvent(() => {
        window.clearTimeout(watchdogRef.current)
        watchdogRef.current = window.setTimeout(
            () =>
                onStatusChange({
                    status: "error",
                    message: "The app didn't start. Try restarting it."
                }),
            START_TIMEOUT_MS
        )
    })

    useEffect(() => {
        armWatchdog()
        return () => window.clearTimeout(watchdogRef.current)
    }, [])

    const renderApp = useEffectEvent(() => {
        setRevealed(false)
        armWatchdog()
        onStatusChange({ status: "loading" })
        send({ type: "silk-app:render", code, mode, theme: readSilkAppTheme() })
    })

    const handleMessage = useEffectEvent((event: MessageEvent) => {
        if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return
        const message = parseFrameMessage(event.data)
        if (!message) return

        switch (message.type) {
            case "silk-app:ready":
                readyRef.current = true
                renderApp()
                void loadSilkAppFonts().then((fonts) => {
                    if (fonts.length > 0) send({ type: "silk-app:fonts", fonts })
                })
                break
            case "silk-app:rendered":
                window.clearTimeout(watchdogRef.current)
                setHeight(message.height)
                setRevealed(true)
                onStatusChange({ status: "rendered" })
                break
            case "silk-app:resize":
                setHeight(message.height)
                break
            case "silk-app:error":
                if (message.fatal) {
                    window.clearTimeout(watchdogRef.current)
                    onStatusChange({ status: "error", message: message.message })
                } else {
                    console.warn("[silk-app]", message.message)
                }
                break
        }
    })

    useEffect(() => {
        const listener = (event: MessageEvent) => handleMessage(event)
        window.addEventListener("message", listener)
        return () => window.removeEventListener("message", listener)
    }, [])

    // biome-ignore lint/correctness/useExhaustiveDependencies: re-render when the code or mode changes
    useEffect(() => {
        if (readyRef.current) renderApp()
    }, [code, mode])

    const syncTheme = useEffectEvent(() => {
        if (readyRef.current) send({ type: "silk-app:theme", theme: readSilkAppTheme() })
    })

    useEffect(() => {
        let frame = 0
        const schedule = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => syncTheme())
        }
        const observer = new MutationObserver(schedule)
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class", "style"]
        })
        // Theme fonts arrive as stylesheet links after the theme switches.
        observer.observe(document.head, { childList: true })
        return () => {
            observer.disconnect()
            cancelAnimationFrame(frame)
        }
    }, [])

    // The app document loads once. Another load means the code navigated the frame to
    // some other page, which is removed rather than left running inside the message.
    const handleLoad = () => {
        loadCountRef.current += 1
        if (loadCountRef.current === 1) return
        window.clearTimeout(watchdogRef.current)
        readyRef.current = false
        setNavigatedAway(true)
        onStatusChange({ status: "error", message: "The app tried to open another page." })
    }

    if (navigatedAway) return null

    return (
        <iframe
            ref={iframeRef}
            title={title}
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-forms"
            referrerPolicy="no-referrer"
            onLoad={handleLoad}
            className={cn("block border-0 bg-transparent", className)}
            style={{
                // Matching color schemes keeps the frame transparent.
                colorScheme: isDark ? "dark" : "light",
                ...(mode === "inline"
                    ? { height: revealed ? Math.min(height, SILK_APP_MAX_INLINE_HEIGHT) : "100%" }
                    : null)
            }}
        />
    )
})
