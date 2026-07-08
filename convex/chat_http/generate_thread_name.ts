"use node"

import { ChatError } from "@/lib/errors"
import { type ModelMessage, generateText } from "ai"
import type { GenericActionCtx } from "convex/server"
import type { Infer } from "convex/values"
import { internal } from "../_generated/api"
import type { DataModel, Id } from "../_generated/dataModel"
import { MODELS_SHARED, resolveModelReplacement } from "../lib/models"
import type { UserSettings } from "../schema"
import { getModel } from "./get_model"

const TITLE_MODEL_PREFERRED = "gpt-5.4-mini"

const TITLE_MODEL_FALLBACKS = [
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview",
    "gpt-4.1-mini",
    "gpt-4o-mini"
] as const
const TITLE_CONTEXT_START_MESSAGE_LIMIT = 2
const TITLE_CONTEXT_RECENT_MESSAGE_LIMIT = 4
const TITLE_CONTEXT_CHARS_PER_MESSAGE = 1200
const TITLE_CONTEXT_TOTAL_CHARS =
    (TITLE_CONTEXT_START_MESSAGE_LIMIT + TITLE_CONTEXT_RECENT_MESSAGE_LIMIT) *
    TITLE_CONTEXT_CHARS_PER_MESSAGE
const TRUNCATED_CONTEXT_MARKER = " ... [truncated] ... "
const INLINE_FILE_OPEN_TAG = '<file name="'
const INLINE_FILE_CLOSE_TAG = "</file>"

type TitlePromptMessage = {
    section: "start" | "recent"
    messageNumber: number
    role: "user" | "assistant"
    content: string
}

const normalizeTitle = (title: string) =>
    title
        .replace(/[\r\n]+/g, " ")
        .replace(/^["'`]+|["'`]+$/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 100)

const fileMarker = (filename: string) => (filename ? `[file: ${filename}]` : "[file]")

const standaloneInlineFileMarker = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed.startsWith(INLINE_FILE_OPEN_TAG) || !trimmed.endsWith(INLINE_FILE_CLOSE_TAG)) {
        return null
    }

    const filenameStart = INLINE_FILE_OPEN_TAG.length
    const filenameEnd = trimmed.indexOf('">', filenameStart)
    if (filenameEnd === -1) return null

    return fileMarker(trimmed.slice(filenameStart, filenameEnd))
}

const compactInlineFileWrappers = (text: string) => {
    let compacted = ""
    let position = 0

    while (position < text.length) {
        const openIndex = text.indexOf(INLINE_FILE_OPEN_TAG, position)
        if (openIndex === -1) {
            compacted += text.slice(position)
            break
        }

        const filenameStart = openIndex + INLINE_FILE_OPEN_TAG.length
        const filenameEnd = text.indexOf('">', filenameStart)
        if (filenameEnd === -1) {
            compacted += text.slice(position)
            break
        }

        const contentStart = filenameEnd + 2
        const nextOpenIndex = text.indexOf(INLINE_FILE_OPEN_TAG, contentStart)
        const closeSearchEnd = nextOpenIndex === -1 ? text.length : nextOpenIndex
        const closeIndex = text.lastIndexOf(INLINE_FILE_CLOSE_TAG, closeSearchEnd)
        if (closeIndex < contentStart) {
            compacted += text.slice(position, contentStart)
            position = contentStart
            continue
        }

        compacted += text.slice(position, openIndex)
        compacted += fileMarker(text.slice(filenameStart, filenameEnd))
        position = closeIndex + INLINE_FILE_CLOSE_TAG.length
    }

    return compacted
}

const compactTitleContextText = (text: string) =>
    compactInlineFileWrappers(text)
        .replace(/```([^\n`]*)\n[\s\S]*?```/g, (_match, language: string) =>
            language?.trim() ? `[code block: ${language.trim()}]` : "[code block]"
        )
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()

const compactTitleTextPart = (text: string) =>
    standaloneInlineFileMarker(text) ?? compactTitleContextText(text)

const contentToTitleContextText = (content: ModelMessage["content"]): string => {
    if (typeof content === "string") {
        return compactTitleContextText(content)
    }

    if (Array.isArray(content)) {
        return compactTitleContextText(
            content
                .map((part) => {
                    if (part.type === "text") {
                        return compactTitleTextPart(part.text)
                    }
                    if (part.type === "image") {
                        return "[image]"
                    }
                    if (part.type === "file") {
                        return fileMarker(part.filename || "unknown")
                    }
                    if (part.type === "tool-call") {
                        return `[tool: ${part.toolName}]`
                    }
                    if (part.type === "tool-result") {
                        return `[tool result: ${part.toolName}]`
                    }
                    if (part.type === "reasoning") {
                        return `[reasoning: ${part.text}]`
                    }
                    return ""
                })
                .join(" ")
        )
    }

    return ""
}

export const fallbackTitleFromMessages = (messages: ModelMessage[]) => {
    const firstUserMessage = messages.find((message) => message.role === "user")
    const rawTitle = normalizeTitle(contentToTitleContextText(firstUserMessage?.content ?? ""))

    if (!rawTitle) return "New Chat"

    const words = rawTitle.split(" ")
    return normalizeTitle(words.slice(0, 6).join(" "))
}

const truncateTitleContextText = (text: string, limit: number) => {
    if (text.length <= limit) return text
    if (limit <= TRUNCATED_CONTEXT_MARKER.length) return text.slice(0, limit)

    const availableChars = limit - TRUNCATED_CONTEXT_MARKER.length
    const headChars = Math.ceil(availableChars / 2)
    const tailChars = Math.floor(availableChars / 2)

    return `${text.slice(0, headChars).trimEnd()}${TRUNCATED_CONTEXT_MARKER}${text
        .slice(text.length - tailChars)
        .trimStart()}`
}

const titlePromptSectionLabel = (section: TitlePromptMessage["section"]) =>
    section === "start" ? "Conversation start" : "Recent conversation"

const renderTitlePromptMessages = (messages: TitlePromptMessage[]) => {
    const sections: TitlePromptMessage["section"][] = ["start", "recent"]

    return sections
        .map((section) => {
            const sectionMessages = messages.filter((message) => message.section === section)
            if (sectionMessages.length === 0) return ""

            return `${titlePromptSectionLabel(section)}:
${sectionMessages
    .map((message) => `[${message.messageNumber}] ${message.role}: ${message.content}`)
    .join("\n")}`
        })
        .filter(Boolean)
        .join("\n\n")
}

export const getTitlePromptMessages = (messages: ModelMessage[]) => {
    const candidateMessages = messages
        .map((message, index) => ({
            message,
            messageNumber: index + 1,
            content: contentToTitleContextText(message.content)
        }))
        .filter(
            (
                candidate
            ): candidate is {
                message: ModelMessage & { role: "user" | "assistant" }
                messageNumber: number
                content: string
            } =>
                (candidate.message.role === "user" || candidate.message.role === "assistant") &&
                Boolean(candidate.content)
        )

    const selectedMessages = new Map<number, TitlePromptMessage>()

    for (const candidate of candidateMessages.slice(0, TITLE_CONTEXT_START_MESSAGE_LIMIT)) {
        selectedMessages.set(candidate.messageNumber, {
            section: "start",
            messageNumber: candidate.messageNumber,
            role: candidate.message.role,
            content: candidate.content
        })
    }

    for (const candidate of candidateMessages.slice(-TITLE_CONTEXT_RECENT_MESSAGE_LIMIT)) {
        if (selectedMessages.has(candidate.messageNumber)) continue

        selectedMessages.set(candidate.messageNumber, {
            section: "recent",
            messageNumber: candidate.messageNumber,
            role: candidate.message.role,
            content: candidate.content
        })
    }

    const titleMessages = Array.from(selectedMessages.values()).sort(
        (a, b) => a.messageNumber - b.messageNumber
    )
    let remainingChars = TITLE_CONTEXT_TOTAL_CHARS

    return titleMessages.map((message) => {
        const limit = Math.min(TITLE_CONTEXT_CHARS_PER_MESSAGE, remainingChars)
        const truncatedContent = truncateTitleContextText(message.content, limit)
        remainingChars -= truncatedContent.length
        return {
            ...message,
            content: truncatedContent
        }
    })
}

const getAvailableTitleModelId = async (
    ctx: GenericActionCtx<DataModel>,
    userId: string,
    preferredModelId: string
) => {
    const registry = await ctx.runQuery(internal.settings.getUserRegistryInternal, {
        userId
    })

    const preferredReplacement = resolveModelReplacement(preferredModelId, MODELS_SHARED).resolvedId
    const candidates = [
        TITLE_MODEL_PREFERRED,
        preferredReplacement,
        preferredModelId,
        ...TITLE_MODEL_FALLBACKS
    ].filter((candidate): candidate is string => Boolean(candidate))

    return candidates.find((candidate, index) => {
        if (candidates.indexOf(candidate) !== index) return false
        return registry.models[candidate]?.adapters.some(
            (adapter) => adapter.startsWith("i3-") || adapter.startsWith("openrouter:")
        )
    })
}

export const generateThreadName = async (
    ctx: GenericActionCtx<DataModel>,
    threadId: Id<"threads">,
    messages: ModelMessage[],
    userId: string,
    settings: Infer<typeof UserSettings>
) => {
    const relevantMessages = getTitlePromptMessages(messages)
    const fallbackTitle = fallbackTitleFromMessages(messages)

    if (relevantMessages.length === 0) {
        await ctx.runMutation(internal.threads.updateThreadName, {
            threadId,
            name: fallbackTitle
        })
        return fallbackTitle
    }

    const titleModelId = await getAvailableTitleModelId(ctx, userId, settings.titleGenerationModel)

    if (!titleModelId) {
        await ctx.runMutation(internal.threads.updateThreadName, {
            threadId,
            name: fallbackTitle
        })
        return fallbackTitle
    }

    try {
        const modelData = await getModel(ctx, titleModelId, { internalOnly: true })
        if (modelData instanceof ChatError) {
            throw new Error(modelData.message)
        }

        const { model } = modelData
        if (model.modelType === "image") {
            throw new Error("Title generation model resolved to an image model")
        }

        const result = await generateText({
            model,
            messages: [
                {
                    role: "system",
                    content: `
You are tasked with generating a concise, descriptive title for a chat conversation based on numbered excerpts from the conversation. The title should:

1. Be 2-6 words long
2. Capture the main topic or question being discussed
3. Be clear and specific
4. Use title case (capitalize first letter of each major word)
5. Not include quotation marks or special characters
6. Be professional and appropriate

The excerpts may include both the conversation start and recent messages. Use the message numbers to understand chronology. Prefer a title that represents the thread as a whole, and let recent messages update the title when the conversation has clearly shifted topics.

Examples of good titles:
- "Python Data Analysis Help"
- "React Component Design"
- "Travel Planning Italy"
- "Budget Spreadsheet Formula"
- "Career Change Advice"

Generate a title that accurately represents what this conversation is about based on the messages provided.`
                },
                {
                    role: "user",
                    content: `Here are bounded excerpts from the conversation:

${renderTitlePromptMessages(relevantMessages)}

Generate a title that accurately represents what this conversation is about based on the messages provided.`
                }
            ]
        })

        const generatedTitle = normalizeTitle(result.text) || fallbackTitle
        await ctx.runMutation(internal.threads.updateThreadName, {
            threadId,
            name: generatedTitle
        })

        return generatedTitle
    } catch (error) {
        console.error("[cvx][chat][thread-name] Title generation failed, using fallback:", error)
        await ctx.runMutation(internal.threads.updateThreadName, {
            threadId,
            name: fallbackTitle
        })
        return fallbackTitle
    }
}
