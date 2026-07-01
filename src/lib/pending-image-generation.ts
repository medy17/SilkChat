import type { UIMessage } from "ai"

/**
 * Statuses a prepared image generation moves through after the user clicks
 * "Generate" and before the job settles into a terminal state. `pending_confirmation`
 * is deliberately excluded: a proposal the user has not acted on does not block chat.
 */
export const IN_FLIGHT_IMAGE_GENERATION_STATUSES: ReadonlySet<string> = new Set([
    "submitting",
    "submitted",
    "processing"
])

/**
 * Statuses where nothing is actively running anymore: either the run ended in an
 * error, or (`storing_failed`) recovery requires an explicit user retry — which
 * re-enters "processing" and re-engages the gate on its own.
 */
const SETTLED_IMAGE_GENERATION_STATUSES: ReadonlySet<string> = new Set([
    "failed",
    "partial",
    "refunded",
    "storing_failed"
])

const PREPARE_IMAGE_GENERATION_PART_TYPE = "tool-prepareImageGeneration"

type ToolPartWithStatus = {
    type: string
    output?: {
        status?: string
        error?: string
        variants?: number
        assets?: unknown[]
    } | null
}

const isCardPending = (part: ToolPartWithStatus): boolean => {
    const output = part.output
    const status = output?.status
    if (!status || status === "pending_confirmation") return false
    if (IN_FLIGHT_IMAGE_GENERATION_STATUSES.has(status)) return true
    if (SETTLED_IMAGE_GENERATION_STATUSES.has(status) || output?.error) return false

    // Multi-variant runs are one job per variant, and each job patches the shared
    // card status last-write-wins: the first variant to finish flips the card to
    // "completed" while sibling jobs are still generating. Mirror the card UI's
    // isAwaitingVariants check (assets vs. variants) instead of trusting status alone.
    if (status === "completed") {
        const expectedVariants = Math.max(output?.variants ?? 1, 1)
        const readyAssets = output?.assets?.length ?? 0
        return readyAssets > 0 && readyAssets < expectedVariants
    }

    return false
}

/**
 * True when any prepared-image-generation tool card in the thread is mid-flight
 * (the user clicked Generate but the job — or a sibling variant job — has not
 * finished). Used to block sending a new chat message so a background generation
 * is not interleaved with a new turn.
 */
export const hasPendingImageGeneration = (
    messages: readonly Pick<UIMessage, "parts">[] | undefined
): boolean => {
    if (!messages) return false

    for (const message of messages) {
        for (const part of message.parts as ToolPartWithStatus[]) {
            if (part.type !== PREPARE_IMAGE_GENERATION_PART_TYPE) continue
            if (isCardPending(part)) return true
        }
    }

    return false
}
