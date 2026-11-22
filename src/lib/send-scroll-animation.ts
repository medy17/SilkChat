import { resolveComposerText } from "@/lib/composer-message"

// Ease-out quart, shared by the send glide and the sent bubble's entrance: a quick launch
// that still leaves enough travel in the middle to read as motion, then a soft landing.
export const SEND_SCROLL_CSS_EASING = "cubic-bezier(0.25, 1, 0.5, 1)"
export const SEND_BUBBLE_ENTRANCE_DURATION_MS = 320

export const SEND_SCROLL_CONFIG = {
    minDurationMs: 320,
    // Cap longer glides so sending from scrolled-up never drags.
    maxDurationMs: 560,
    baseDurationMs: 260,
    msPerPx: 0.3,
    // Skip spinning up a rAF loop for sub-2px shifts.
    minAnimatedDistancePx: 2,
    // Beyond this many screens, jump to one screen away first so virtualized rows
    // don't remeasure mid-glide and stall the arrival.
    maxGlideScreens: 2,
    // A send that never commits a user message stops waiting after this long.
    pendingTimeoutMs: 1500
} as const

export type SendScrollConfig = typeof SEND_SCROLL_CONFIG

export const easeOutSendScroll = (progress: number) => {
    if (progress <= 0) return 0
    if (progress >= 1) return 1
    return 1 - (1 - progress) ** 4
}

export const getSendScrollDurationMs = (
    distancePx: number,
    config: SendScrollConfig = SEND_SCROLL_CONFIG
) => {
    const raw = config.baseDurationMs + Math.abs(distancePx) * config.msPerPx
    return Math.min(config.maxDurationMs, Math.max(config.minDurationMs, Math.round(raw)))
}

export const resolveSendScrollStartOffset = ({
    currentOffset,
    targetOffset,
    viewportSize,
    maxGlideScreens = SEND_SCROLL_CONFIG.maxGlideScreens
}: {
    currentOffset: number
    targetOffset: number
    viewportSize: number
    maxGlideScreens?: number
}) => {
    const distance = targetOffset - currentOffset
    if (viewportSize > 0 && distance > viewportSize * maxGlideScreens) {
        return Math.max(currentOffset, targetOffset - viewportSize)
    }
    return currentOffset
}

export const createSendScrollAnimation = ({
    startOffset,
    initialTargetOffset,
    startTime,
    config = SEND_SCROLL_CONFIG
}: {
    startOffset: number
    initialTargetOffset: number
    startTime: number
    config?: SendScrollConfig
}) => {
    const durationMs = getSendScrollDurationMs(Math.abs(initialTargetOffset - startOffset), config)

    // The target is re-read every frame, so content that grows mid-flight (an attachment
    // decoding, the reply starting) bends the glide instead of snapping at the end.
    const step = ({
        time,
        targetOffset
    }: {
        time: number
        targetOffset: number
    }): { offset: number; done: boolean } => {
        const elapsed = Math.max(0, time - startTime)
        const progress = durationMs <= 0 ? 1 : Math.min(1, elapsed / durationMs)

        if (progress >= 1) {
            return { offset: targetOffset, done: true }
        }

        return {
            offset: startOffset + (targetOffset - startOffset) * easeOutSendScroll(progress),
            done: false
        }
    }

    return { durationMs, step }
}

export const willSubmitComposerMessage = ({
    composerStatus,
    inputValue,
    fileCount
}: {
    composerStatus: string
    inputValue?: string
    fileCount: number
}) => {
    if (composerStatus === "streaming" || composerStatus === "submitted") {
        return false
    }

    return Boolean(resolveComposerText(inputValue ?? "", fileCount) || fileCount > 0)
}
