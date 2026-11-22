import { SEND_SCROLL_CONFIG, easeOutSendScroll } from "@/lib/send-scroll-animation"

// The composer-to-bubble handoff: the sent text lifts out of the composer as a ghost of the
// bubble, stretches along its flight, squashes as it lands, and the bubble's surface forms
// around the text on the way. The ghost tracks the real bubble every frame, so it rides the
// send glide and hands over exactly where the bubble sits.

export type HandoffRect = { left: number; top: number; width: number; height: number }

export type SendHandoffSource = {
    // Tight box around the sent text as it sat in the composer.
    textRect: HandoffRect
    fontSizePx: number
    capturedAt: number
    // Lets the composer show its placeholder again. Idempotent.
    releaseComposer: () => void
}

export const SEND_HANDOFF_CONFIG = {
    // Added to the glide's duration so the bubble finishes forming as the scroll settles.
    extraDurationMs: 140,
    // Flight stretch along the direction of travel, and the landing squash after it.
    stretch: { along: 0.12, across: 0.06 },
    squash: 0.45,
    // Ramps the stretch in so the first frame matches the composer text exactly.
    stretchRampIn: 0.12,
    landingStart: 0.55,
    // The bubble's surface is fully formed by this point of the flight.
    surfaceFormedAt: 0.45,
    // By here the words have cleared the composer, so its placeholder can fade back in.
    composerReleaseAt: 0.25,
    // The message's actions settle in after the bubble lands rather than popping in with it.
    actionsFadeMs: 200
} as const

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount

export const getSendHandoffFrame = ({
    from,
    to,
    progress,
    startTextScale,
    config = SEND_HANDOFF_CONFIG
}: {
    from: HandoffRect
    to: HandoffRect
    progress: number
    startTextScale: number
    config?: typeof SEND_HANDOFF_CONFIG
}) => {
    const t = clamp01(progress)
    const move = easeOutSendScroll(t)

    // Stretch follows the flight's speed (ease-out quart velocity), then a single soft
    // squash settles the bubble into shape.
    const flightStretch = Math.min(1, t / config.stretchRampIn) * (1 - t) ** 3
    const landingSquash =
        t > config.landingStart
            ? -config.squash *
              Math.sin((Math.PI * (t - config.landingStart)) / (1 - config.landingStart))
            : 0
    const deformation = t >= 1 ? 0 : flightStretch + landingSquash

    const travelX = Math.abs(to.left - from.left)
    const travelY = Math.abs(to.top - from.top)
    const vertical = travelY >= travelX

    return {
        left: lerp(from.left, to.left, move),
        top: lerp(from.top, to.top, move),
        width: lerp(from.width, to.width, move),
        height: lerp(from.height, to.height, move),
        scaleX: 1 + deformation * (vertical ? -config.stretch.across : config.stretch.along),
        scaleY: 1 + deformation * (vertical ? config.stretch.along : -config.stretch.across),
        surfaceOpacity: easeOutSendScroll(clamp01(t / config.surfaceFormedAt)),
        textScale: lerp(startTextScale, 1, move)
    }
}

let pendingSource: SendHandoffSource | null = null

const toHandoffRect = (rect: DOMRect): HandoffRect => ({
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
})

/**
 * Records where the sent text sits in the composer. Call it right before the composer clears.
 * `contentElement` is the editor's content element; each line is measured on its text, so the
 * box hugs the words rather than the full-width editor.
 */
export const captureSendHandoffSource = (contentElement: HTMLElement | null | undefined) => {
    pendingSource?.releaseComposer()
    pendingSource = null
    if (!contentElement) return

    const visible = (
        contentElement.closest(".cm-scroller") ?? contentElement
    ).getBoundingClientRect()
    const range = document.createRange()
    let left = Number.POSITIVE_INFINITY
    let top = Number.POSITIVE_INFINITY
    let right = Number.NEGATIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY

    for (const line of contentElement.querySelectorAll<HTMLElement>(".cm-line")) {
        range.selectNodeContents(line)
        const rect = range.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) continue
        if (rect.bottom <= visible.top || rect.top >= visible.bottom) continue
        left = Math.min(left, rect.left)
        top = Math.min(top, Math.max(rect.top, visible.top))
        right = Math.max(right, rect.right)
        bottom = Math.max(bottom, Math.min(rect.bottom, visible.bottom))
    }
    range.detach()

    if (!Number.isFinite(left) || right <= left || bottom <= top) return

    // The composer clears right after this; hold its placeholder back until the words have
    // flown, or until the send turns out never to produce a bubble.
    const editor = contentElement.closest<HTMLElement>(".cm-editor")
    editor?.setAttribute("data-send-handoff", "")
    let released = false
    const releaseComposer = () => {
        if (released) return
        released = true
        clearTimeout(expiry)
        editor?.removeAttribute("data-send-handoff")
    }
    const expiry = setTimeout(releaseComposer, SEND_SCROLL_CONFIG.pendingTimeoutMs)

    pendingSource = {
        textRect: { left, top, width: right - left, height: bottom - top },
        fontSizePx: Number.parseFloat(getComputedStyle(contentElement).fontSize) || 0,
        capturedAt: performance.now(),
        releaseComposer
    }
}

export const takeSendHandoffSource = () => {
    const source = pendingSource
    pendingSource = null
    if (!source) return null
    if (performance.now() - source.capturedAt > SEND_SCROLL_CONFIG.pendingTimeoutMs) {
        source.releaseComposer()
        return null
    }
    return source
}

/**
 * Flies a ghost of `bubble` from the captured composer text into the bubble. The real bubble
 * stays hidden until the ghost lands on it. Returns a cancel function.
 */
export const playSendHandoff = ({
    source,
    bubble,
    durationMs
}: {
    source: SendHandoffSource
    bubble: HTMLElement
    durationMs: number
}) => {
    const bubbleStyle = getComputedStyle(bubble)
    const bubbleFontSize = Number.parseFloat(bubbleStyle.fontSize)
    const startTextScale =
        source.fontSizePx > 0 && bubbleFontSize > 0 ? source.fontSizePx / bubbleFontSize : 1
    const padding = {
        left: Number.parseFloat(bubbleStyle.paddingLeft) || 0,
        right: Number.parseFloat(bubbleStyle.paddingRight) || 0,
        top: Number.parseFloat(bubbleStyle.paddingTop) || 0,
        bottom: Number.parseFloat(bubbleStyle.paddingBottom) || 0
    }
    // The ghost opens as the bubble's padding wrapped round the composer text, at the
    // composer's text size, so its first frame sits exactly on the words that just left.
    const from: HandoffRect = {
        left: source.textRect.left - padding.left * startTextScale,
        top: source.textRect.top - padding.top * startTextScale,
        width: source.textRect.width + (padding.left + padding.right) * startTextScale,
        height: source.textRect.height + (padding.top + padding.bottom) * startTextScale
    }
    const bubbleWidth = bubble.getBoundingClientRect().width

    const ghost = document.createElement("div")
    ghost.setAttribute("aria-hidden", "true")
    Object.assign(ghost.style, {
        position: "fixed",
        left: "0px",
        top: "0px",
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: "40",
        borderRadius: bubbleStyle.borderRadius,
        transformOrigin: "50% 50%",
        willChange: "transform, width, height"
    })

    const surface = document.createElement("div")
    surface.className = "bg-user-message border border-border"
    Object.assign(surface.style, {
        position: "absolute",
        inset: "0px",
        borderRadius: "inherit"
    })

    // A clone of the finished bubble, laid out at its final width so the words never reflow
    // mid-flight; the shape deforms around them instead.
    const text = bubble.cloneNode(true) as HTMLElement
    // The actions belong to the landed message, not the flight.
    text.querySelector("[data-message-actions]")?.remove()
    Object.assign(text.style, {
        position: "absolute",
        left: "0px",
        top: "0px",
        margin: "0px",
        width: `${bubbleWidth}px`,
        maxWidth: "none",
        background: "transparent",
        borderColor: "transparent",
        color: bubbleStyle.color,
        fontFamily: bubbleStyle.fontFamily,
        fontSize: bubbleStyle.fontSize,
        lineHeight: bubbleStyle.lineHeight,
        transformOrigin: "0 0"
    })

    ghost.append(surface, text)

    // Measured rects and fixed positioning can disagree while a mobile keyboard pans the
    // viewport (iOS keeps the layout viewport and scrolls the visual one). A fixed marker at
    // 0,0 reports where fixed space starts in measured space, so the ghost corrects for any
    // pan in the frame it happens; where the two agree it reads 0,0.
    const origin = document.createElement("div")
    origin.setAttribute("aria-hidden", "true")
    Object.assign(origin.style, {
        position: "fixed",
        left: "0px",
        top: "0px",
        width: "0px",
        height: "0px",
        visibility: "hidden",
        pointerEvents: "none"
    })

    document.body.append(origin, ghost)

    // Hold the real bubble hidden past the ghost's run; landing cancels the hold in the same
    // frame the ghost leaves, so there is never a frame with neither.
    const hold = bubble.animate([{ opacity: 0 }, { opacity: 0 }], {
        duration: durationMs + 1000
    })

    let frameId: number | null = null
    let startTime: number | null = null

    const finish = () => {
        if (frameId !== null) cancelAnimationFrame(frameId)
        frameId = null
        ghost.remove()
        origin.remove()
        hold.cancel()
        source.releaseComposer()
    }

    // Fades to whatever the actions would show at rest: always-on on phones, hover-only on
    // desktop (where this is usually 0 and nothing runs).
    const revealActions = () => {
        const actions = bubble.querySelector<HTMLElement>("[data-message-actions]")
        if (!actions) return
        const restingOpacity = Number.parseFloat(getComputedStyle(actions).opacity)
        if (!(restingOpacity > 0)) return
        actions.animate([{ opacity: 0 }, { opacity: restingOpacity }], {
            duration: SEND_HANDOFF_CONFIG.actionsFadeMs,
            easing: "ease-out"
        })
    }

    const apply = (progress: number) => {
        const frame = getSendHandoffFrame({
            from,
            to: toHandoffRect(bubble.getBoundingClientRect()),
            progress,
            startTextScale
        })
        const fixedOrigin = origin.getBoundingClientRect()
        ghost.style.width = `${frame.width}px`
        ghost.style.height = `${frame.height}px`
        ghost.style.transform = `translate(${frame.left - fixedOrigin.left}px, ${frame.top - fixedOrigin.top}px) scale(${frame.scaleX}, ${frame.scaleY})`
        surface.style.opacity = `${frame.surfaceOpacity}`
        text.style.transform = `scale(${frame.textScale})`
    }

    const tick = (frameTime: number) => {
        if (!bubble.isConnected) {
            finish()
            return
        }
        startTime ??= frameTime
        const progress = durationMs <= 0 ? 1 : (frameTime - startTime) / durationMs
        apply(progress)
        if (progress >= SEND_HANDOFF_CONFIG.composerReleaseAt) source.releaseComposer()
        if (progress >= 1) {
            finish()
            revealActions()
            return
        }
        frameId = requestAnimationFrame(tick)
    }

    apply(0)
    frameId = requestAnimationFrame(tick)
    return finish
}
