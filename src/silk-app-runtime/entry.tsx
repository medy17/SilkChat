// Bootstrap for SilkChat app frames. Bundled by scripts/build-silk-app-runtime.mjs and
// loaded into a sandboxed, opaque-origin iframe after @tailwindcss/browser.

import { TooltipProvider } from "@/components/ui/tooltip"
import {
    type FrameToHostMessage,
    SILK_APP_MAX_INLINE_HEIGHT,
    type SilkAppFont,
    type SilkAppMode,
    type SilkAppTheme,
    parseHostMessage
} from "@/lib/silk-app/protocol"
import { Component, type ComponentType, type ReactNode } from "react"
import { type Root, createRoot } from "react-dom/client"
import { describeAppError } from "./errors"
import { evaluateSilkApp, findSilkAppModules, transpileSilkApp } from "./evaluate"
import { SILK_APP_MODULES, loadSilkAppModules } from "./modules"

declare const __SILK_APP_FRAME_CSS__: string

const post = (message: FrameToHostMessage) => window.parent.postMessage(message, "*")

const installStyles = () => {
    const style = document.createElement("style")
    style.setAttribute("type", "text/tailwindcss")
    style.textContent = __SILK_APP_FRAME_CSS__
    document.head.append(style)
}

const loadedStylesheets = new Set<string>()
const loadedFonts = new Set<string>()

const applyTheme = (theme: SilkAppTheme) => {
    const root = document.documentElement
    for (const [name, value] of Object.entries(theme.vars)) {
        if (/^[a-z0-9-]+$/.test(name)) root.style.setProperty(`--${name}`, value)
    }
    root.classList.toggle("dark", theme.dark)
    // Matching the host's color scheme keeps the frame transparent instead of painting
    // an opaque canvas behind it.
    root.style.colorScheme = theme.dark ? "dark" : "light"
    root.style.fontSize = theme.rootFontSize

    for (const href of theme.fontStylesheets) {
        if (loadedStylesheets.has(href) || !href.startsWith("https://fonts.googleapis.com/")) {
            continue
        }
        loadedStylesheets.add(href)
        const link = document.createElement("link")
        link.rel = "stylesheet"
        link.href = href
        document.head.append(link)
    }
}

// Same-origin font files can't be fetched from an opaque origin, so the host sends bytes.
const applyFonts = (fonts: SilkAppFont[]) => {
    for (const font of fonts) {
        const key = `${font.family}|${font.weight}|${font.style}`
        if (loadedFonts.has(key) || !(font.data instanceof ArrayBuffer)) continue
        loadedFonts.add(key)
        try {
            const face = new FontFace(font.family, font.data, {
                weight: font.weight,
                style: font.style,
                display: "swap"
            })
            document.fonts.add(face)
        } catch {
            loadedFonts.delete(key)
        }
    }
}

class AppErrorBoundary extends Component<
    { children: ReactNode; onError: (error: unknown) => void },
    { failed: boolean }
> {
    state = { failed: false }

    static getDerivedStateFromError() {
        return { failed: true }
    }

    componentDidCatch(error: unknown) {
        this.props.onError(error)
    }

    render() {
        return this.state.failed ? null : this.props.children
    }
}

const POPPER_SELECTOR = "[data-radix-popper-content-wrapper]"
const POPPER_GAP = 8

// Selects and tooltips open in portals, which add nothing to the body's height. One that
// can't fit below its trigger asks for the room it needs at full size (a squeezed list
// still scrolls to its full height), so the frame grows and Radix places it there instead
// of squeezing or clipping it. One that fits above asks for nothing.
const measurePoppers = () => {
    let bottom = 0
    for (const wrapper of document.querySelectorAll<HTMLElement>(POPPER_SELECTOR)) {
        const content = wrapper.firstElementChild
        if (!(content instanceof HTMLElement)) continue
        const rect = content.getBoundingClientRect()
        const top = rect.top + window.scrollY
        const natural = Math.max(rect.height, content.scrollHeight)
        if (content.dataset.side === "top") {
            if (rect.top >= 0 && natural <= rect.height + 1) continue
            const anchor =
                Number.parseFloat(wrapper.style.getPropertyValue("--radix-popper-anchor-height")) ||
                0
            bottom = Math.max(bottom, top + rect.height + anchor + natural + POPPER_GAP * 2)
        } else {
            bottom = Math.max(bottom, top + natural + POPPER_GAP)
        }
    }
    return bottom
}

const measure = () => {
    const height = Math.ceil(
        Math.max(document.body.getBoundingClientRect().height, measurePoppers())
    )
    // Past the host's cap the inline frame stops growing, so its content scrolls instead.
    document.documentElement.toggleAttribute("data-capped", height > SILK_APP_MAX_INLINE_HEIGHT)
    return height
}

let reactRoot: Root | null = null
let renderToken = 0
let lastHeight = -1

const reportResize = () => {
    const height = measure()
    if (height === lastHeight) return
    lastHeight = height
    post({ type: "silk-app:resize", height })
}

// Portals mount as children of the body; each open popper is re-measured as it moves
// into place or changes size.
const watchPoppers = () => {
    const moved = new MutationObserver(reportResize)
    const resized = new ResizeObserver(reportResize)
    new MutationObserver(() => {
        moved.disconnect()
        resized.disconnect()
        for (const wrapper of document.querySelectorAll<HTMLElement>(POPPER_SELECTOR)) {
            moved.observe(wrapper, { attributes: true, attributeFilter: ["style"] })
            if (wrapper.firstElementChild) resized.observe(wrapper.firstElementChild)
        }
        reportResize()
    }).observe(document.body, { childList: true })
}

// @tailwindcss/browser compiles after each DOM mutation; wait for that pass (or a short
// timeout) so the host never reveals unstyled markup. Timers only: the frame is
// transparent until revealed, and browsers may pause requestAnimationFrame in a
// cross-origin frame they consider hidden.
const waitForStyles = () =>
    new Promise<void>((resolve) => {
        const timeout = window.setTimeout(done, 180)
        const observer = new MutationObserver(done)
        for (const style of document.head.querySelectorAll("style:not([type])")) {
            observer.observe(style, { childList: true, characterData: true, subtree: true })
        }
        function done() {
            window.clearTimeout(timeout)
            observer.disconnect()
            window.setTimeout(resolve, 0)
        }
    })

const render = async (code: string, mode: SilkAppMode) => {
    const token = ++renderToken
    document.documentElement.dataset.mode = mode

    let App: ComponentType
    try {
        const transpiled = transpileSilkApp(code)
        await loadSilkAppModules(findSilkAppModules(transpiled))
        if (token !== renderToken) return
        App = evaluateSilkApp(transpiled, SILK_APP_MODULES)
    } catch (error) {
        if (token === renderToken) {
            post({ type: "silk-app:error", message: describeAppError(error), fatal: true })
        }
        return
    }

    const container = document.getElementById("root")
    if (!container) return
    reactRoot ??= createRoot(container)
    reactRoot.render(
        <TooltipProvider delayDuration={200}>
            <AppErrorBoundary
                key={token}
                onError={(error) =>
                    post({ type: "silk-app:error", message: describeAppError(error), fatal: true })
                }
            >
                <App />
            </AppErrorBoundary>
        </TooltipProvider>
    )

    await waitForStyles()
    if (token !== renderToken) return
    lastHeight = measure()
    post({ type: "silk-app:rendered", height: lastHeight })
}

const start = () => {
    installStyles()
    if (!document.getElementById("root")) {
        const container = document.createElement("div")
        container.id = "root"
        document.body.append(container)
    }

    new ResizeObserver(reportResize).observe(document.body)
    watchPoppers()

    // Following a link would replace the app with another page, which the host then
    // stops; in-page anchors still scroll. Capture phase, so React's handlers still run.
    document.addEventListener(
        "click",
        (event) => {
            const link = (event.target as Element | null)?.closest?.("a[href]")
            if (link && !link.getAttribute("href")?.startsWith("#")) event.preventDefault()
        },
        true
    )

    window.addEventListener("message", (event) => {
        if (event.source !== window.parent) return
        const message = parseHostMessage(event.data)
        if (!message) return

        if (message.type === "silk-app:render") {
            applyTheme(message.theme)
            void render(message.code, message.mode)
        } else if (message.type === "silk-app:theme") {
            applyTheme(message.theme)
        } else {
            applyFonts(message.fonts)
        }
    })

    // Errors in event handlers and timers leave the last render on screen.
    window.addEventListener("error", (event) => {
        post({
            type: "silk-app:error",
            message: describeAppError(event.error ?? event.message),
            fatal: false
        })
    })
    window.addEventListener("unhandledrejection", (event) => {
        post({ type: "silk-app:error", message: describeAppError(event.reason), fatal: false })
    })

    post({ type: "silk-app:ready" })
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true })
} else {
    start()
}
