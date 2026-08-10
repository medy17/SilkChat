export type OgDemo = "home" | "about" | "personas" | "shared"
export type OgPreview = OgDemo | "shared-long-question" | "shared-long-name"

export type OgContent = {
    id: string
    route: string
    studioLabel?: string
    title: string
    supportingText: string
    truncate?: boolean
}

export type FittedOgContent = OgContent & {
    titleSize: number
    supportingSize: number
}

type LegacySharedMessage = {
    role: string
    parts: Array<{ type: string; text?: string }>
}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })

export const SHARED_OG_QUESTION_SPEC = {
    minWords: 4,
    maxWords: 10,
    maxGraphemes: 72,
    instructions: [
        "Write one inviting question that captures the conversation’s most interesting idea.",
        "Address the reader naturally; do not summarize the conversation or state dry facts.",
        "Use the conversation’s language and preserve important names or terms.",
        "Return only the question, with no quotation marks, label, or emoji."
    ]
} as const

function normalizeText(value: string) {
    return value.replaceAll(/\s+/g, " ").trim()
}

export function ellipsizeOgText(value: string, maxGraphemes: number) {
    const normalized = normalizeText(value)
    const graphemes = Array.from(graphemeSegmenter.segment(normalized), ({ segment }) => segment)
    if (graphemes.length <= maxGraphemes) return normalized

    const candidate = graphemes
        .slice(0, maxGraphemes - 1)
        .join("")
        .trimEnd()
    const lastSpace = candidate.lastIndexOf(" ")
    const minimumUsefulBoundary = Math.floor(maxGraphemes * 0.65)
    const wordSafeCandidate =
        lastSpace >= minimumUsefulBoundary ? candidate.slice(0, lastSpace) : candidate

    return `${wordSafeCandidate.replace(/[,:;.!?—-]+$/u, "")}…`
}

export function createSharedOgContent(options: {
    id: string
    question: string
    sharerName?: string | null
    studioLabel?: string
}): OgContent {
    const question = normalizeText(options.question)
    const title = question.endsWith("?") ? question : `${question.replace(/[.!]+$/u, "")}?`
    const normalizedName = normalizeText(options.sharerName ?? "")
    const sharerName = normalizedName ? ellipsizeOgText(normalizedName, 30) : "Someone"

    return {
        id: options.id,
        route: "/s/$sharedThreadId",
        studioLabel: options.studioLabel,
        title,
        supportingText: `${sharerName} shared this conversation with you.`,
        truncate: true
    }
}

export function resolveSharedOgQuestion(options: {
    shareQuestion?: string | null
    title?: string | null
    messages?: LegacySharedMessage[] | null
}) {
    const savedQuestion = normalizeText(options.shareQuestion ?? "")
    if (savedQuestion) return savedQuestion

    const firstUserText = normalizeText(
        options.messages
            ?.find((message) => message.role === "user")
            ?.parts.find((part) => part.type === "text")?.text ?? ""
    )
    const openingQuestion = firstUserText.match(/^[^?]+\?/u)?.[0]
    if (openingQuestion) return ellipsizeOgText(openingQuestion, 72)

    const legacyTitle = normalizeText(options.title ?? "")
    if (legacyTitle && legacyTitle !== "New Chat") {
        return ellipsizeOgText(`What should we know about ${legacyTitle}?`, 72)
    }

    return null
}

export function createSharedThreadOgContent(options: {
    id: string
    shareQuestion?: string | null
    sharerName?: string | null
    title?: string | null
    messages?: LegacySharedMessage[] | null
}) {
    const question = resolveSharedOgQuestion(options)
    if (!question) return null

    return createSharedOgContent({
        id: options.id,
        question,
        sharerName: options.sharerName
    })
}

export function fitOgContent(
    content: OgContent,
    format: "wide" | "landscape" | "square"
): FittedOgContent {
    const isSquare = format === "square"
    const title = content.truncate
        ? ellipsizeOgText(content.title, isSquare ? 92 : 78)
        : normalizeText(content.title)
    const supportingText = content.truncate
        ? ellipsizeOgText(content.supportingText, isSquare ? 74 : 68)
        : normalizeText(content.supportingText)
    const titleLength = Array.from(graphemeSegmenter.segment(title)).length

    const titleSize = isSquare
        ? titleLength <= 42
            ? 104
            : titleLength <= 64
              ? 92
              : 80
        : titleLength <= 42
          ? 64
          : titleLength <= 60
            ? 58
            : 52

    return {
        ...content,
        title,
        supportingText,
        titleSize,
        supportingSize: isSquare ? 40 : 27
    }
}

export const OG_DEMOS = {
    home: {
        id: "home",
        route: "/",
        title: "Leading AI models, together in one chat.",
        supportingText:
            "Compare answers, create images, and chat with Personas in SilkChat—without switching apps."
    },
    about: {
        id: "about",
        route: "/about",
        title: "Built for better conversations with AI.",
        supportingText:
            "See how SilkChat brings models, image generation, Personas, and thoughtful controls into one calm workspace."
    },
    personas: {
        id: "personas",
        route: "/personas",
        title: "AI characters with actual personality.",
        supportingText:
            "Meet Socrates, Seraphine, and original characters with distinct voices and stories."
    },
    shared: createSharedOgContent({
        id: "shared",
        question: "Why do stars shimmer?",
        sharerName: "Ahmed"
    })
} as const satisfies Record<OgDemo, OgContent>

export const OG_SQUARE_STRESS_DEMOS = [
    createSharedOgContent({
        id: "shared-long-question",
        studioLabel: "Long generated question",
        question:
            "How do astronomers tell whether a distant shimmer comes from a star, an atmosphere, or something we have never seen before?",
        sharerName: "Ahmed"
    }),
    createSharedOgContent({
        id: "shared-long-name",
        studioLabel: "Long sharer name",
        question: "Why do stars shimmer?",
        sharerName: "Alexandria-Cassandra Montgomery-Worthington"
    })
] as const

export const OG_PREVIEWS = {
    ...OG_DEMOS,
    "shared-long-question": OG_SQUARE_STRESS_DEMOS[0],
    "shared-long-name": OG_SQUARE_STRESS_DEMOS[1]
} as const satisfies Record<OgPreview, OgContent>

export function isOgDemo(value: string | null): value is OgDemo {
    return value === "home" || value === "about" || value === "personas" || value === "shared"
}

export function isOgPreview(value: string | null): value is OgPreview {
    return isOgDemo(value) || value === "shared-long-question" || value === "shared-long-name"
}
