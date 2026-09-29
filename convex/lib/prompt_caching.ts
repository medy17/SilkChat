import type { ModelMessage } from "ai"

// Models flagged `explicitPromptCaching` (Anthropic) only reuse a prefix up to a
// cache_control breakpoint. Everything else caches implicitly and needs none of this.
export const EPHEMERAL_CACHE_CONTROL = { type: "ephemeral" }

type WithProviderOptions = { providerOptions?: ModelMessage["providerOptions"] }

const withCacheControl = <T extends WithProviderOptions>(value: T): T => ({
    ...value,
    providerOptions: {
        ...value.providerOptions,
        openrouter: {
            ...value.providerOptions?.openrouter,
            cacheControl: EPHEMERAL_CACHE_CONTROL
        }
    }
})

type CacheablePart = {
    type: string
    text?: string
    mediaType?: string
    data?: unknown
} & WithProviderOptions

const isRemoteUrl = (data: unknown) =>
    data instanceof URL
        ? data.protocol === "http:" || data.protocol === "https:"
        : typeof data === "string" && /^https?:\/\//i.test(data)

// The AI SDK drops empty user text parts, and the OpenRouter SDK sends no marker for tool
// approval responses or for documents referenced by http(s) URL, such as PDFs; image,
// video, and audio files keep theirs.
const canHoldCacheControl = (part: CacheablePart) => {
    if (part.type === "tool-approval-response") return false
    if (part.type === "text") return part.text !== ""
    if (part.type !== "file" || !isRemoteUrl(part.data)) return true
    return /^(image|video|audio)\//.test(part.mediaType ?? "")
}

/**
 * Marks the end of `message` as a cache breakpoint. The OpenRouter SDK applies a
 * message-level marker only to the last text part of a user message (skipping trailing
 * images/files) and to every result of a tool message, so array content is marked on
 * the last part that can carry it. Anything after that part is cached on the next turn.
 */
export const withCacheBreakpoint = (message: ModelMessage): ModelMessage => {
    if ((message.role === "user" || message.role === "tool") && Array.isArray(message.content)) {
        const parts = message.content as CacheablePart[]
        let lastIndex = parts.length - 1
        while (lastIndex >= 0 && !canHoldCacheControl(parts[lastIndex])) lastIndex--
        if (lastIndex !== -1) {
            const content = parts.map((part, index) =>
                index === lastIndex ? withCacheControl(part) : part
            )
            return { ...message, content } as ModelMessage
        }
    }

    return withCacheControl(message)
}
