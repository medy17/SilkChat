import type { UserModelMessage } from "@ai-sdk/provider-utils"
import { R2 } from "@convex-dev/r2"
import type {
    AssistantContent,
    AssistantModelMessage,
    ModelMessage,
    ToolCallPart,
    ToolContent,
    ToolModelMessage,
    UserContent
} from "ai"
import type { Infer } from "convex/values"
import { components } from "../_generated/api"
import type { Message } from "../schema/message"
import type { ModelAbility } from "../schema/settings"
import {
    LONG_ATTACHMENT_REFERENCE_TOKEN_THRESHOLD,
    MAX_INLINE_TEXT_ATTACHMENT_TOKENS_WITHOUT_EXECUTION,
    estimateTokenCount,
    getFileTypeInfo
} from "./file_constants"
import { supportsNativePdf } from "./model_abilities"

export type CoreMessage = ModelMessage & {
    messageId: string
}
const r2 = new R2(components.r2)

const isExternalFileReference = (value: string) =>
    value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "")
const trimLeadingSlash = (value: string) => value.replace(/^\/+/, "")

export const normalizeAttachmentReferer = (value?: string | null) => {
    if (!value) return undefined

    try {
        const url = new URL(value)
        if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
        return `${url.origin}/`
    } catch {
        return undefined
    }
}

const encodeKeyPath = (key: string) =>
    trimLeadingSlash(key)
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")

const buildDirectPublicAssetUrl = (key: string, publicAssetBaseUrl?: string) => {
    if (!publicAssetBaseUrl) {
        throw new Error(
            `R2_PUBLIC_BASE_URL is required to resolve model-facing attachment URLs for ${key}`
        )
    }

    return `${trimTrailingSlash(publicAssetBaseUrl)}/${encodeKeyPath(key)}`
}

const MODEL_FACING_STORAGE_KEY_PREFIXES = ["attachments/", "generations/"]

const isModelFacingStorageKey = (value: string) =>
    MODEL_FACING_STORAGE_KEY_PREFIXES.some((prefix) => value.startsWith(prefix))

const sanitizeToolResultForModel = (toolName: string, result: unknown) => {
    if (toolName !== "prepareImageGeneration" || typeof result !== "object" || result === null) {
        return result ?? null
    }

    const { referenceSources, ...safeResult } = result as Record<string, unknown>
    return safeResult
}

const extractProxyKeyFromUrl = (value: string) => {
    if (!value.startsWith("http://") && !value.startsWith("https://")) {
        return null
    }

    try {
        const parsed = new URL(value)
        const key = parsed.searchParams.get("key")
        const isLegacyProxyPath = parsed.pathname === "/r2" || parsed.pathname.endsWith("/r2")

        if (!isLegacyProxyPath || !key || !isModelFacingStorageKey(key)) {
            return null
        }

        return key
    } catch {
        return null
    }
}

export const dbMessagesToCore = async (
    messages: Infer<typeof Message>[],
    modelAbilities: ModelAbility[],
    options?: {
        publicAssetBaseUrl?: string
        resolveGeneratedImageContextUrl?: (storageKey: string) => Promise<{
            url: string
            mediaType?: string
        }>
        referenceLongTextAttachments?: boolean
        maxInlineTextAttachmentTokens?: number
        attachmentReferer?: string
    }
): Promise<CoreMessage[]> => {
    const mapped_messages: CoreMessage[] = []
    const maxInlineTextAttachmentTokens =
        options?.maxInlineTextAttachmentTokens ??
        MAX_INLINE_TEXT_ATTACHMENT_TOKENS_WITHOUT_EXECUTION
    for await (const message of messages) {
        const to_commit_messages: CoreMessage[] = []
        if (message.role === "user") {
            const mapped_content: UserContent = []

            const failedFileFetch = (type: "image" | "text" | "pdf", filename: string) => {
                mapped_content.push({
                    type: "text",
                    text: `<internal-system-error>Failed to fetch ${type} file ${filename}. Maybe there was an issue or the file was deleted.</internal-system-error>`
                })
            }

            for (const p of message.parts) {
                if (p.type === "text") {
                    mapped_content.push({ type: "text", text: p.text })
                }
                if (p.type === "file") {
                    const _extract = p.data.startsWith("attachments/")
                        ? (p.data.split("/").pop() ?? "")
                        : ""
                    const extractedFileName = _extract.length > 51 ? _extract.slice(51) : _extract

                    const filename = p.filename || extractedFileName
                    const fileTypeInfo = getFileTypeInfo(filename, p.mimeType)
                    const proxiedKey = isExternalFileReference(p.data)
                        ? extractProxyKeyFromUrl(p.data)
                        : null
                    const fileUrl = proxiedKey
                        ? buildDirectPublicAssetUrl(proxiedKey, options?.publicAssetBaseUrl)
                        : isExternalFileReference(p.data)
                          ? p.data
                          : buildDirectPublicAssetUrl(p.data, options?.publicAssetBaseUrl)

                    if (fileTypeInfo.isVisionImage && !fileTypeInfo.isSvg) {
                        try {
                            mapped_content.push({
                                type: "image",
                                image: fileUrl,
                                mediaType: p.mimeType || "image/*"
                            })
                        } catch (error) {
                            console.warn(
                                `[cvx][chat] Error processing image file ${p.data}:`,
                                error
                            )
                            failedFileFetch("image", filename)
                        }
                    } else if (fileTypeInfo.isText && !fileTypeInfo.isImage) {
                        try {
                            const data = await fetch(fileUrl)

                            if (data.ok) {
                                const text = await data.text()
                                const estimatedTokens = estimateTokenCount(text)

                                if (
                                    options?.referenceLongTextAttachments &&
                                    estimatedTokens > LONG_ATTACHMENT_REFERENCE_TOKEN_THRESHOLD
                                ) {
                                    const attachmentReferer = normalizeAttachmentReferer(
                                        options.attachmentReferer
                                    )
                                    const requestHeaders = {
                                        "User-Agent": "Mozilla/5.0",
                                        Accept: "text/plain,*/*",
                                        ...(attachmentReferer ? { Referer: attachmentReferer } : {})
                                    }
                                    mapped_content.push({
                                        type: "text",
                                        text: `<long-attachment>${JSON.stringify({
                                            filename,
                                            mediaType: p.mimeType || "text/plain",
                                            url: fileUrl,
                                            estimatedTokens,
                                            requestHeaders
                                        })}\nUse code execution to fetch and inspect this attachment programmatically. Do not print the entire file into the conversation.</long-attachment>`
                                    })
                                } else if (estimatedTokens > maxInlineTextAttachmentTokens) {
                                    mapped_content.push({
                                        type: "text",
                                        text: `<internal-system-error>The text attachment "${filename}" is too large to inline safely (${estimatedTokens.toLocaleString()} estimated tokens), and code execution is unavailable. Ask the user to enable code execution or choose a function-calling model before analyzing this file.</internal-system-error>`
                                    })
                                } else {
                                    mapped_content.push({
                                        type: "text",
                                        text: `<file name="${filename}">\n${text}\n</file>`
                                    })
                                }
                            } else {
                                console.warn(
                                    `[cvx][chat] Failed to fetch text file ${p.data}: ${data.status} ${data.statusText}`
                                )
                                failedFileFetch("text", filename)
                            }
                        } catch (error) {
                            console.warn(`[cvx][chat] Error processing text file ${p.data}:`, error)
                            failedFileFetch("text", filename)
                        }
                    } else if (fileTypeInfo.isPdf && supportsNativePdf(modelAbilities)) {
                        mapped_content.push({
                            type: "file",
                            mediaType: "application/pdf",
                            filename,
                            data: fileUrl
                        })
                    } else {
                        mapped_content.push({
                            type: "text",
                            text: fileTypeInfo.isPdf
                                ? "<internal-system-error>Native PDF input is not supported by this model. Please try again with a different model.</internal-system-error>"
                                : `<internal-system-error>Unsupported file type: ${filename} (${p.mimeType})</internal-system-error>`
                        })
                    }
                }
            }

            if (mapped_content.length === 0) {
                console.log(`[cvx][chat] Skipping message with no content: ${message.messageId}`)
                continue
            }

            const lastMessage = mapped_messages[mapped_messages.length - 1]
            if (
                lastMessage &&
                lastMessage.role === "user" &&
                typeof lastMessage.content === "object"
            ) {
                lastMessage.content.push(...mapped_content)
            } else {
                to_commit_messages.unshift({
                    role: "user",
                    messageId: message.messageId,
                    content: mapped_content
                } satisfies UserModelMessage & { messageId: string })
            }
        } else if (message.role === "assistant") {
            const mapped_content: AssistantContent = []
            const tool_calls: ToolCallPart[] = []
            const tool_results: ToolContent = []
            const generated_image_content: UserContent = []

            // First pass: collect all content and tool results separately
            for (const p of message.parts) {
                if (p.type === "text") {
                    mapped_content.push({ type: "text", text: p.text })
                } else if (p.type === "file") {
                    if (p.mimeType?.startsWith("image/") && p.data.startsWith("generations/")) {
                        const fileUrl = await r2.getUrl(p.data)
                        const data = await fetch(fileUrl)
                        const blob = await data.blob()
                        mapped_content.push({
                            type: "file",
                            mediaType: p.mimeType || "image/png",
                            filename: p.filename || "",
                            data: await blob.arrayBuffer()
                        })
                    } else {
                        mapped_content.push({
                            type: "file",
                            mediaType: p.mimeType || "application/octet-stream",
                            filename: p.filename || "",
                            data: p.data || ""
                        })
                    }
                } else if (p.type === "tool-invocation") {
                    if (
                        p.toolInvocation.toolName === "prepareImageGeneration" &&
                        p.toolInvocation.state === "result" &&
                        typeof p.toolInvocation.result === "object" &&
                        p.toolInvocation.result !== null &&
                        modelAbilities.includes("vision")
                    ) {
                        const result = p.toolInvocation.result as {
                            assets?: Array<{
                                storageKey?: string
                                imageUrl?: string
                            }>
                            prompt?: string
                        }
                        for (const asset of result.assets ?? []) {
                            const storageKey = asset.storageKey ?? asset.imageUrl
                            if (!storageKey?.startsWith("generations/")) continue
                            if (generated_image_content.length === 0) {
                                generated_image_content.push({
                                    type: "text",
                                    text: result.prompt
                                        ? `SilkScreen generated this image from the prompt: ${result.prompt}`
                                        : "SilkScreen generated this image."
                                })
                            }
                            let resolvedContextImage:
                                | {
                                      url: string
                                      mediaType?: string
                                  }
                                | undefined
                            try {
                                resolvedContextImage =
                                    await options?.resolveGeneratedImageContextUrl?.(storageKey)
                            } catch (error) {
                                console.warn(
                                    "[cvx][chat] Failed to prepare compressed generated image context",
                                    error
                                )
                            }
                            generated_image_content.push({
                                type: "image",
                                image:
                                    resolvedContextImage?.url ??
                                    buildDirectPublicAssetUrl(
                                        storageKey,
                                        options?.publicAssetBaseUrl
                                    ),
                                mediaType: resolvedContextImage?.mediaType || "image/png"
                            })
                        }
                    }

                    tool_calls.push({
                        type: "tool-call",
                        toolCallId: p.toolInvocation.toolCallId,
                        toolName: p.toolInvocation.toolName,
                        input: p.toolInvocation.args
                    })
                    // Collect tool results separately
                    tool_results.push({
                        type: "tool-result",
                        toolCallId: p.toolInvocation.toolCallId,
                        toolName: p.toolInvocation.toolName,
                        output: {
                            type: "json",
                            value: sanitizeToolResultForModel(
                                p.toolInvocation.toolName,
                                p.toolInvocation.result
                            ) as never
                        }
                    })
                } else if (p.type === "reasoning") {
                    mapped_content.push({
                        type: "reasoning",
                        text: p.reasoning
                    })
                }
            }

            if (mapped_content.length === 0 && tool_calls.length === 0) {
                continue
            }

            // Check if we should merge with the last assistant message
            const lastMessage = mapped_messages[mapped_messages.length - 1]

            if (
                lastMessage &&
                lastMessage.role === "assistant" &&
                tool_calls.length === 0 && // Don't merge if current message has tool results
                typeof lastMessage.content === "object"
            ) {
                // Merge with previous assistant message
                lastMessage.content.push(...mapped_content)
            } else {
                if (tool_calls.length > 0) {
                    to_commit_messages.unshift({
                        role: "assistant",
                        messageId: `${message.messageId}-tool-call`,
                        content: tool_calls
                    } satisfies AssistantModelMessage & { messageId: string })
                    to_commit_messages.unshift({
                        role: "tool",
                        messageId: `${message.messageId}-tool-result`,
                        content: tool_results
                    } satisfies ToolModelMessage & { messageId: string })
                }

                if (mapped_content.length > 0) {
                    // Create new assistant message
                    to_commit_messages.unshift({
                        role: "assistant",
                        messageId: message.messageId,
                        content: mapped_content
                    } satisfies AssistantModelMessage & { messageId: string })
                }

                if (generated_image_content.length > 0) {
                    to_commit_messages.unshift({
                        role: "user",
                        messageId: `${message.messageId}-generated-image-context`,
                        content: generated_image_content
                    } satisfies UserModelMessage & { messageId: string })
                }
            }
        }

        mapped_messages.push(...to_commit_messages)
    }

    mapped_messages.reverse()

    // console.log("[cvx][chat] mapped_messages", mapped_messages.length)
    // for (let i = 0; i < mapped_messages.length; i++) {
    //     const m = mapped_messages[i]
    //     const roughContent =
    //         typeof m.content === "object"
    //             ? m.content
    //                   .map((c) => (c.type === "text" ? c.text.slice(0, 100) : `[${c.type}]`))
    //                   .join(",")
    //             : m.content
    //     console.log(` History[${i}](${m.role}) ${roughContent}`)
    // }
    return mapped_messages
}
