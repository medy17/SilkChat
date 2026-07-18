import { beforeEach, describe, expect, it, vi } from "vitest"

const {
    buildPromptMock,
    buildTemporalContextMock,
    createUIMessageStreamMock,
    dbMessagesToCoreMock,
    generateThreadNameMock,
    getModelMock,
    getResumableStreamContextMock,
    getToolkitMock,
    getUserIdentityMock,
    manualStreamTransformMock,
    resolveGeneratedImageContextUrlMock,
    smoothStreamMock,
    stepCountIsMock,
    streamTextMock
} = vi.hoisted(() => ({
    buildPromptMock: vi.fn(),
    buildTemporalContextMock: vi.fn(),
    createUIMessageStreamMock: vi.fn(),
    dbMessagesToCoreMock: vi.fn(),
    generateThreadNameMock: vi.fn(),
    getUserIdentityMock: vi.fn(),
    getModelMock: vi.fn(),
    getResumableStreamContextMock: vi.fn(),
    getToolkitMock: vi.fn(),
    manualStreamTransformMock: vi.fn(),
    resolveGeneratedImageContextUrlMock: vi.fn(),
    smoothStreamMock: vi.fn(),
    stepCountIsMock: vi.fn(),
    streamTextMock: vi.fn()
}))

vi.mock("ai", () => ({
    JsonToSseTransformStream: class {
        readable: ReadableStream<string>
        writable: WritableStream<unknown>

        constructor() {
            const stream = new TransformStream<unknown, string>({
                transform(chunk, controller) {
                    controller.enqueue(`${JSON.stringify(chunk)}\n`)
                }
            })

            this.readable = stream.readable
            this.writable = stream.writable
        }
    },
    UI_MESSAGE_STREAM_HEADERS: {},
    createUIMessageStream: createUIMessageStreamMock,
    smoothStream: smoothStreamMock,
    stepCountIs: stepCountIsMock,
    streamText: streamTextMock
}))

vi.mock("../../convex/_generated/server", () => ({
    action: (config: unknown) => config,
    httpAction: (handler: unknown) => handler,
    internalMutation: (config: unknown) => config,
    internalQuery: (config: unknown) => config,
    mutation: (config: unknown) => config,
    query: (config: unknown) => config
}))

vi.mock("../../convex/_generated/api", () => ({
    internal: {
        account_deletion: {
            getAccountDeletionBlockerInternal: "getAccountDeletionBlockerInternal"
        },
        credits: {
            reserveCreditForMessage: "reserveCreditForMessage",
            commitReservedCreditForMessage: "commitReservedCreditForMessage",
            releaseReservedCreditForMessage: "releaseReservedCreditForMessage",
            reserveToolCallBudget: "reserveToolCallBudget",
            consumeReservedToolCall: "consumeReservedToolCall",
            finalizeToolCallBudget: "finalizeToolCallBudget"
        },
        messages: {
            getMessagesByThreadId: "getMessagesByThreadId",
            patchMessage: "patchMessage"
        },
        settings: {
            getUserSettingsInternal: "getUserSettingsInternal"
        },
        personas: {
            getThreadPersonaSnapshotInternal: "getThreadPersonaSnapshotInternal"
        },
        streams: {
            appendStreamId: "appendStreamId"
        },
        threads: {
            createThreadOrInsertMessages: "createThreadOrInsertMessages",
            updateThreadStreamingState: "updateThreadStreamingState"
        }
    }
}))

vi.mock("../../convex/attachments", () => ({
    r2: {
        getUrl: vi.fn()
    }
}))

vi.mock("../../convex/lib/identity", () => ({
    getUserIdentity: getUserIdentityMock
}))

vi.mock("../../convex/lib/account_deletion_gate", () => ({
    getAccountDeletionBlockerForAction: vi.fn().mockResolvedValue(null)
}))

vi.mock("../../convex/chat_http/get_model", () => ({
    getModel: getModelMock
}))

vi.mock("../../convex/lib/resumable_stream_context", () => ({
    getResumableStreamContext: getResumableStreamContextMock
}))

vi.mock("../../convex/lib/db_to_core_messages", () => ({
    dbMessagesToCore: dbMessagesToCoreMock
}))

vi.mock("../../convex/lib/image_generation/context_images_node", () => ({
    resolveGeneratedImageContextUrl: resolveGeneratedImageContextUrlMock
}))

vi.mock("../../convex/lib/toolkit", () => ({
    getToolkit: getToolkitMock,
    enforceToolIdentityPolicy: (
        enabledTools: string[],
        { isAnonymous }: { isAnonymous: boolean }
    ) => (isAnonymous ? enabledTools.filter((tool) => tool !== "code_execution") : enabledTools),
    resolveToolAvailability: (
        settings: Record<
            string,
            | string
            | Array<{ enabled?: boolean }>
            | Record<string, { enabled?: boolean; encryptedKey?: string } | undefined>
            | undefined
        >
    ) => {
        const generalProviders = settings.generalProviders as
            | Record<string, { enabled?: boolean; encryptedKey?: string } | undefined>
            | undefined
        const hasSearchDeployment = Boolean(process.env.PERPLEXITY_API_KEY)

        return {
            web_search: {
                enabled: hasSearchDeployment,
                fundingSource: hasSearchDeployment ? "deployment" : "none"
            },
            supermemory: {
                enabled:
                    generalProviders?.supermemory?.enabled === true &&
                    Boolean(generalProviders.supermemory.encryptedKey),
                fundingSource: "byok"
            },
            mcp: {
                enabled: Array.isArray(settings.mcpServers) && settings.mcpServers.length > 0,
                fundingSource: "byok"
            }
        }
    },
    sanitizeEnabledTools: (
        enabledTools: string[],
        availability: Record<string, { enabled?: boolean }>
    ) => Array.from(new Set(enabledTools)).filter((tool) => availability[tool]?.enabled)
}))

vi.mock("../../convex/chat_http/generate_thread_name", () => ({
    generateThreadName: generateThreadNameMock
}))

vi.mock("../../convex/chat_http/manual_stream_transform", () => ({
    manualStreamTransform: manualStreamTransformMock
}))

vi.mock("../../convex/chat_http/prompt", () => ({
    buildPrompt: buildPromptMock,
    buildTemporalContext: buildTemporalContextMock
}))

vi.mock("../../convex/lib/models", () => ({
    MODELS_SHARED: []
}))

import { ChatError } from "@/lib/errors"
import {
    buildPreparedImageReferences,
    chatPOST,
    resolvePersonaOpeningForRequest
} from "../../convex/chat_http/post.route"

const chatPOSTHandler = chatPOST as unknown as (
    ctx: {
        auth: Record<string, never>
        runMutation: ReturnType<typeof vi.fn>
        runQuery: ReturnType<typeof vi.fn>
    },
    request: Request
) => Promise<Response>

type ChatPostCtx = Parameters<typeof chatPOSTHandler>[0]

describe("resolvePersonaOpeningForRequest", () => {
    it("resolves an authored opening by stable id instead of trusting client text", async () => {
        const opening = await resolvePersonaOpeningForRequest(
            {} as Parameters<typeof resolvePersonaOpeningForRequest>[0],
            "user-1",
            { source: "builtin", id: "elara-adventurer" },
            { openingId: "summoned-arrival", messageId: "opening-message-1" },
            "assistant-1"
        )

        expect(opening).toEqual({
            role: "assistant",
            messageId: "opening-message-1",
            parts: [
                {
                    type: "text",
                    text: "*A winged woman drops out of a tree, entirely too pleased.* You're one of them, aren't you? A summoned one."
                }
            ]
        })
    })

    it("rejects an unknown authored opening id", async () => {
        const opening = await resolvePersonaOpeningForRequest(
            {} as Parameters<typeof resolvePersonaOpeningForRequest>[0],
            "user-1",
            { source: "builtin", id: "elara-adventurer" },
            { openingId: "not-authored", messageId: "opening-message-1" },
            "assistant-1"
        )

        expect(opening).toBeInstanceOf(ChatError)
    })
})

describe("buildPreparedImageReferences", () => {
    it("labels generated SilkScreen variants distinctly", () => {
        const references = buildPreparedImageReferences([
            {
                messageId: "assistant-1",
                role: "assistant",
                createdAt: 1,
                updatedAt: 1,
                metadata: {},
                parts: [
                    {
                        type: "tool-invocation",
                        toolInvocation: {
                            toolName: "prepareImageGeneration",
                            toolCallId: "call-image",
                            state: "result",
                            result: {
                                success: true,
                                kind: "prepared_image_generation",
                                status: "completed",
                                variants: 2,
                                modelName: "GPT Image 2",
                                aspectRatio: "16:9",
                                resolution: "1K",
                                assets: [
                                    {
                                        storageKey: "generations/user-1/variant-1.png",
                                        generatedImageId: "generated-image-1"
                                    },
                                    {
                                        storageKey: "generations/user-1/variant-2.png",
                                        generatedImageId: "generated-image-2"
                                    }
                                ]
                            }
                        }
                    }
                ]
            }
        ] as never)

        expect(references.map((reference) => `${reference.id}: ${reference.label}`)).toEqual([
            "image_ref_1: SilkScreen generation from assistant message 1, variant 1 of 2, GPT Image 2, 16:9 1K",
            "image_ref_2: SilkScreen generation from assistant message 1, variant 2 of 2, GPT Image 2, 16:9 1K"
        ])
    })
})

const createObjectStream = (chunks: unknown[]) =>
    new ReadableStream({
        start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(chunk)
            }
            controller.close()
        }
    })

const createRequest = (body: unknown) =>
    new Request("https://example.com/chat", {
        method: "POST",
        body: typeof body === "string" ? body : JSON.stringify(body)
    })

const createAbortableRequest = (body: unknown, signal: AbortSignal) =>
    new Request("https://example.com/chat", {
        method: "POST",
        body: typeof body === "string" ? body : JSON.stringify(body),
        signal
    })

const createCtx = () =>
    ({
        auth: {},
        runMutation: vi.fn(),
        runQuery: vi.fn().mockResolvedValue(null)
    }) as ChatPostCtx

describe("chatPOST", () => {
    beforeEach(() => {
        buildPromptMock.mockReset().mockReturnValue("system prompt")
        buildTemporalContextMock.mockReset().mockReturnValue("temporal context")
        createUIMessageStreamMock.mockReset().mockImplementation(
            ({
                execute,
                onError
            }: {
                execute: (args: { writer: unknown }) => Promise<void>
                onError?: (error: unknown) => string
            }) =>
                new ReadableStream({
                    async start(controller) {
                        const mergeTasks: Promise<void>[] = []
                        const writer = {
                            write(chunk: unknown) {
                                controller.enqueue(chunk)
                            },
                            merge(stream: ReadableStream<unknown>) {
                                const mergeTask = (async () => {
                                    const reader = stream.getReader()
                                    while (true) {
                                        const result = await reader.read()
                                        if (result.done) break
                                        controller.enqueue(result.value)
                                    }
                                })()
                                mergeTasks.push(mergeTask)
                            }
                        }

                        try {
                            await execute({ writer })
                            await Promise.all(mergeTasks)
                            controller.close()
                        } catch (error) {
                            const errorText = onError?.(error) ?? "Stream error occurred"
                            controller.enqueue({ type: "error", errorText })
                            controller.close()
                        }
                    }
                })
        )
        dbMessagesToCoreMock.mockReset().mockResolvedValue([
            {
                role: "user",
                content: "hello from the user"
            }
        ])
        generateThreadNameMock.mockReset().mockResolvedValue("hello thread")
        getUserIdentityMock.mockReset()
        getModelMock.mockReset()
        getResumableStreamContextMock.mockReset().mockReturnValue(null)
        getToolkitMock.mockReset().mockResolvedValue({
            web_search: {
                description: "Search"
            }
        })
        resolveGeneratedImageContextUrlMock.mockReset().mockResolvedValue({
            url: "https://r2.example.com/references/user-1/generated-context/context.webp",
            mediaType: "image/webp"
        })
        manualStreamTransformMock.mockReset().mockImplementation(
            (
                parts: Array<{ type: string; text?: string }>,
                totalTokenUsage: {
                    promptTokens: number
                    completionTokens: number
                    reasoningTokens: number
                    totalTokens: number
                    estimatedCostUsd?: number
                    estimatedPromptCostUsd?: number
                    estimatedCompletionCostUsd?: number
                },
                _uploadPromises: Promise<void>[],
                _userId: string,
                _ctx: unknown,
                _streamMetrics?: { firstVisibleAtMs?: number },
                options?: { onPartsChanged?: () => void }
            ) =>
                new TransformStream({
                    transform(
                        chunk: {
                            type: string
                            text?: string
                            usage?: {
                                inputTokens?: number
                                outputTokens?: number
                                outputTokenDetails?: { reasoningTokens?: number }
                                totalTokens?: number
                                raw?: {
                                    cost_details?: {
                                        upstream_inference_cost?: number
                                        upstream_inference_prompt_cost?: number
                                        upstream_inference_completions_cost?: number
                                    }
                                }
                            }
                        },
                        controller
                    ) {
                        if (chunk.type === "text-delta" && chunk.text) {
                            parts.push({
                                type: "text",
                                text: chunk.text
                            })
                            options?.onPartsChanged?.()
                        }

                        if (chunk.type === "finish-step") {
                            totalTokenUsage.promptTokens += chunk.usage?.inputTokens ?? 0
                            totalTokenUsage.completionTokens += chunk.usage?.outputTokens ?? 0
                            totalTokenUsage.reasoningTokens +=
                                chunk.usage?.outputTokenDetails?.reasoningTokens ?? 0
                            totalTokenUsage.totalTokens +=
                                chunk.usage?.totalTokens ??
                                (chunk.usage?.inputTokens ?? 0) + (chunk.usage?.outputTokens ?? 0)
                            totalTokenUsage.estimatedCostUsd =
                                (totalTokenUsage.estimatedCostUsd ?? 0) +
                                (chunk.usage?.raw?.cost_details?.upstream_inference_cost ?? 0)
                            totalTokenUsage.estimatedPromptCostUsd =
                                (totalTokenUsage.estimatedPromptCostUsd ?? 0) +
                                (chunk.usage?.raw?.cost_details?.upstream_inference_prompt_cost ??
                                    0)
                            totalTokenUsage.estimatedCompletionCostUsd =
                                (totalTokenUsage.estimatedCompletionCostUsd ?? 0) +
                                (chunk.usage?.raw?.cost_details
                                    ?.upstream_inference_completions_cost ?? 0)
                        }

                        controller.enqueue(chunk)
                    }
                })
        )
        smoothStreamMock.mockReset().mockReturnValue("smooth-transform")
        stepCountIsMock.mockReset().mockReturnValue("stop-after-100")
        streamTextMock.mockReset()
        Reflect.deleteProperty(process.env, "PERPLEXITY_API_KEY")
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    it("rejects an empty request body", async () => {
        const response = await chatPOSTHandler(
            createCtx(),
            new Request("https://example.com/chat", {
                method: "POST",
                body: "   "
            })
        )

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toMatchObject({
            code: "bad_request:chat"
        })
    })

    it("rejects invalid JSON payloads", async () => {
        const response = await chatPOSTHandler(createCtx(), createRequest("{not-json"))

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toMatchObject({
            code: "bad_request:chat"
        })
    })

    it("rejects missing required fields", async () => {
        const response = await chatPOSTHandler(createCtx(), createRequest({ model: "shared-text" }))

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toMatchObject({
            code: "bad_request:chat"
        })
    })

    it("rejects edit/retry requests without a thread id", async () => {
        const response = await chatPOSTHandler(
            createCtx(),
            createRequest({
                model: "shared-text",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: "hello" }]
                },
                enabledTools: [],
                targetFromMessageId: "msg-1"
            })
        )

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toMatchObject({
            code: "bad_request:chat"
        })
    })

    it("rejects unauthorized users before model resolution", async () => {
        getUserIdentityMock.mockResolvedValueOnce({ error: "Unauthorized" })

        const response = await chatPOSTHandler(
            createCtx(),
            createRequest({
                model: "shared-text",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: "hello" }]
                },
                enabledTools: []
            })
        )

        expect(response.status).toBe(401)
        await expect(response.json()).resolves.toMatchObject({
            code: "unauthorized:chat"
        })
        expect(getModelMock).not.toHaveBeenCalled()
    })

    it("forwards model-resolution errors", async () => {
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        getModelMock.mockResolvedValueOnce(new ChatError("bad_model:api"))

        const response = await chatPOSTHandler(
            createCtx(),
            createRequest({
                model: "missing-model",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: "hello" }]
                },
                enabledTools: []
            })
        )

        expect(response.status).toBe(500)
        await expect(response.json()).resolves.toMatchObject({
            code: "bad_model:api"
        })
    })

    it("rejects free users when the selected model requires pro", async () => {
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        getModelMock.mockResolvedValueOnce({
            model: { modelType: "text" },
            modelName: "Shared Text",
            providerSource: "internal",
            abilities: [],
            registry: {
                models: {
                    "shared-text": {
                        abilities: []
                    }
                }
            },
            availableToPickFor: "pro"
        })

        const ctx = createCtx()
        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "reserveCreditForMessage":
                    return {
                        allowed: false,
                        reason: "plan"
                    }
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getUserSettingsInternal":
                    return {
                        userId: "user-1",
                        searchProvider: "firecrawl",
                        searchIncludeSourcesByDefault: false,
                        toolCallLimitPerTurn: 3,
                        generalProviders: {},
                        mcpServers: []
                    }
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        const response = await chatPOSTHandler(
            ctx,
            createRequest({
                model: "shared-text",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: "hello" }]
                },
                enabledTools: [],
                reasoningEffort: "off"
            })
        )

        expect(response.status).toBe(403)
        await expect(response.json()).resolves.toMatchObject({
            code: "forbidden:chat",
            cause: "Pro plan required for the selected model."
        })
        expect(ctx.runMutation).not.toHaveBeenCalledWith(
            "createThreadOrInsertMessages",
            expect.anything()
        )
    })

    it("returns rate_limit when monthly included usage is exhausted", async () => {
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        getModelMock.mockResolvedValueOnce({
            model: { modelType: "text" },
            modelName: "Shared Text",
            providerSource: "internal",
            abilities: [],
            registry: {
                models: {
                    "shared-text": {
                        abilities: []
                    }
                }
            }
        })

        const ctx = createCtx()
        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "reserveCreditForMessage":
                    return {
                        allowed: false,
                        reason: "usage",
                        window: "monthly",
                        usedUsd: 10,
                        limitUsd: 10,
                        remainingUsd: 0
                    }
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getUserSettingsInternal":
                    return {
                        userId: "user-1",
                        searchProvider: "firecrawl",
                        searchIncludeSourcesByDefault: false,
                        toolCallLimitPerTurn: 3,
                        generalProviders: {},
                        mcpServers: []
                    }
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        const response = await chatPOSTHandler(
            ctx,
            createRequest({
                model: "shared-text",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: "hello" }]
                },
                enabledTools: [],
                reasoningEffort: "off"
            })
        )

        expect(response.status).toBe(429)
        await expect(response.json()).resolves.toMatchObject({
            code: "rate_limit:chat",
            cause: "Included usage limit reached for the selected request."
        })
        expect(ctx.runMutation).not.toHaveBeenCalledWith(
            "createThreadOrInsertMessages",
            expect.anything()
        )
    })

    it("persists hosted context-limit rejections without reserving credits or calling the model", async () => {
        const largeText = "x".repeat(24_000)
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        getModelMock
            .mockResolvedValueOnce({
                model: { modelType: "text" },
                modelId: "shared-text",
                modelName: "Shared Text",
                runtimeProvider: "openrouter",
                providerSource: "internal",
                abilities: [],
                registry: {
                    models: {
                        "shared-text": {
                            abilities: [],
                            contextLength: 100_000,
                            maxTokens: 10_000,
                            inputUsdPer1MTokens: 200
                        }
                    }
                }
            })
            .mockResolvedValueOnce(new ChatError("bad_model:api"))
        dbMessagesToCoreMock.mockResolvedValueOnce([
            {
                role: "user",
                content: largeText
            }
        ])

        const ctx = createCtx()
        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "createThreadOrInsertMessages":
                    return {
                        threadId: "thread-1",
                        assistantMessageId: "assistant-1",
                        assistantMessageConvexId: 42
                    }
                case "patchMessage":
                    return null
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getUserSettingsInternal":
                    return {
                        userId: "user-1",
                        searchProvider: "firecrawl",
                        searchIncludeSourcesByDefault: false,
                        toolCallLimitPerTurn: 3,
                        generalProviders: {},
                        mcpServers: []
                    }
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        const response = await chatPOSTHandler(
            ctx,
            createRequest({
                model: "shared-text",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: largeText }]
                },
                enabledTools: [],
                reasoningEffort: "off"
            })
        )

        expect(response.status).toBe(200)
        const responseText = await response.text()
        expect(responseText).toContain("switch to BYOK")
        expect(responseText).toContain('"threadId":"thread-1"')
        expect(streamTextMock).not.toHaveBeenCalled()
        expect(ctx.runMutation).not.toHaveBeenCalledWith(
            "reserveCreditForMessage",
            expect.anything()
        )
        expect(ctx.runMutation).toHaveBeenCalledWith(
            "patchMessage",
            expect.objectContaining({
                threadId: "thread-1",
                messageId: "assistant-1",
                parts: [
                    expect.objectContaining({
                        type: "error",
                        error: expect.objectContaining({
                            code: "context_limit_exceeded"
                        })
                    })
                ],
                metadata: expect.objectContaining({
                    creditCounted: false,
                    creditUnits: 0
                })
            })
        )
    })

    it("falls back to OpenRouter BYOK when hosted context is exceeded but the model window is not", async () => {
        const largeText = "x".repeat(24_000)
        const ctx = createCtx()
        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "createThreadOrInsertMessages":
                    return {
                        threadId: "thread-1",
                        assistantMessageId: "assistant-1",
                        assistantMessageConvexId: 42
                    }
                case "appendStreamId":
                    return "stream-1"
                case "reserveCreditForMessage":
                    return {
                        allowed: true,
                        bypassed: false,
                        existing: false,
                        committed: false
                    }
                case "updateThreadStreamingState":
                case "patchMessage":
                case "releaseReservedCreditForMessage":
                    return null
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getMessagesByThreadId":
                    return []
                case "getUserSettingsInternal":
                    return {
                        userId: "user-1",
                        searchProvider: "firecrawl",
                        searchIncludeSourcesByDefault: false,
                        toolCallLimitPerTurn: 3,
                        generalProviders: {},
                        mcpServers: []
                    }
                case "getThreadPersonaSnapshotInternal":
                    return null
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        const registry = {
            models: {
                "shared-text": {
                    abilities: [],
                    contextLength: 100_000,
                    maxTokens: 10_000,
                    inputUsdPer1MTokens: 200
                }
            }
        }
        getModelMock
            .mockResolvedValueOnce({
                model: { modelType: "text" },
                modelId: "shared-text",
                modelName: "Shared Text",
                runtimeProvider: "openrouter",
                providerSource: "internal",
                abilities: [],
                registry
            })
            .mockResolvedValueOnce({
                model: { modelType: "text" },
                modelId: "shared-text",
                modelName: "Shared Text",
                runtimeProvider: "openrouter",
                providerSource: "openrouter",
                abilities: [],
                registry
            })
        dbMessagesToCoreMock
            .mockResolvedValueOnce([
                {
                    role: "user",
                    content: largeText
                }
            ])
            .mockResolvedValueOnce([
                {
                    role: "user",
                    content: largeText
                }
            ])
        manualStreamTransformMock.mockImplementationOnce(() => new TransformStream())
        streamTextMock.mockReturnValueOnce({
            fullStream: createObjectStream([]),
            finishReason: Promise.resolve("stop")
        })

        const response = await chatPOSTHandler(
            ctx,
            createRequest({
                model: "shared-text",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: largeText }]
                },
                enabledTools: [],
                reasoningEffort: "off"
            })
        )

        expect(response.status).toBe(200)
        const responseText = await response.text()
        expect(responseText).not.toContain("switch to BYOK")
        expect(streamTextMock).toHaveBeenCalled()
        expect(getModelMock).toHaveBeenLastCalledWith(
            expect.anything(),
            "shared-text",
            expect.objectContaining({ openRouterByokOnly: true })
        )
        expect(ctx.runMutation).toHaveBeenCalledWith(
            "reserveCreditForMessage",
            expect.objectContaining({
                providerSource: "openrouter",
                counted: false
            })
        )
        expect(responseText).toContain('"mode":"byok_fallback"')
        expect(responseText).toContain('"reason":"message"')
    })

    it("allows BYOK requests to bypass hosted context limits", async () => {
        const ctx = createCtx()
        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "createThreadOrInsertMessages":
                    return {
                        threadId: "thread-1",
                        assistantMessageId: "assistant-1",
                        assistantMessageConvexId: 42
                    }
                case "appendStreamId":
                    return "stream-1"
                case "reserveCreditForMessage":
                    return {
                        allowed: true,
                        bypassed: false,
                        existing: false,
                        committed: false
                    }
                case "updateThreadStreamingState":
                case "patchMessage":
                case "releaseReservedCreditForMessage":
                    return null
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getMessagesByThreadId":
                    return [{ _id: "db-message-1" }]
                case "getUserSettingsInternal":
                    return {
                        userId: "user-1",
                        searchProvider: "firecrawl",
                        searchIncludeSourcesByDefault: false,
                        toolCallLimitPerTurn: 3,
                        generalProviders: {},
                        mcpServers: []
                    }
                case "getThreadPersonaSnapshotInternal":
                    return null
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        getModelMock.mockResolvedValueOnce({
            model: { modelType: "text" },
            modelId: "shared-text",
            modelName: "Shared Text",
            runtimeProvider: "openrouter",
            providerSource: "openrouter",
            abilities: [],
            registry: {
                models: {
                    "shared-text": {
                        abilities: [],
                        contextLength: 100_000,
                        maxTokens: 10_000,
                        inputUsdPer1MTokens: 10
                    }
                }
            }
        })
        manualStreamTransformMock.mockImplementationOnce(() => new TransformStream())
        streamTextMock.mockReturnValueOnce({
            fullStream: createObjectStream([]),
            finishReason: Promise.resolve("stop")
        })

        const response = await chatPOSTHandler(
            ctx,
            createRequest({
                model: "shared-text",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: "x".repeat(24_000) }]
                },
                enabledTools: [],
                reasoningEffort: "off"
            })
        )

        expect(response.status).toBe(200)
        await response.text()
        expect(streamTextMock).toHaveBeenCalled()
    })

    it("persists model context-limit rejections for BYOK requests", async () => {
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        getModelMock.mockResolvedValueOnce({
            model: { modelType: "text" },
            modelId: "shared-text",
            modelName: "Shared Text",
            runtimeProvider: "openrouter",
            providerSource: "openrouter",
            abilities: [],
            registry: {
                models: {
                    "shared-text": {
                        abilities: [],
                        contextLength: 12_000,
                        maxTokens: 4_000,
                        inputUsdPer1MTokens: 10
                    }
                }
            }
        })

        const ctx = createCtx()
        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "createThreadOrInsertMessages":
                    return {
                        threadId: "thread-1",
                        assistantMessageId: "assistant-1",
                        assistantMessageConvexId: 42
                    }
                case "patchMessage":
                    return null
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getUserSettingsInternal":
                    return {
                        userId: "user-1",
                        searchProvider: "firecrawl",
                        searchIncludeSourcesByDefault: false,
                        toolCallLimitPerTurn: 3,
                        generalProviders: {},
                        mcpServers: []
                    }
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        const response = await chatPOSTHandler(
            ctx,
            createRequest({
                model: "shared-text",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: "x".repeat(20_000) }]
                },
                enabledTools: [],
                reasoningEffort: "off"
            })
        )

        expect(response.status).toBe(200)
        await expect(response.text()).resolves.toContain("too long for the selected model")
        expect(streamTextMock).not.toHaveBeenCalled()
        expect(ctx.runMutation).not.toHaveBeenCalledWith(
            "reserveCreditForMessage",
            expect.anything()
        )
    })

    it("releases the reserved model charge when tool budget reservation fails", async () => {
        process.env.PERPLEXITY_API_KEY = "server-perplexity-key"
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        getModelMock.mockResolvedValueOnce({
            model: { modelType: "text" },
            modelName: "Shared Text",
            providerSource: "internal",
            abilities: ["function_calling"],
            registry: {
                models: {
                    "shared-text": {
                        abilities: ["function_calling"]
                    }
                }
            }
        })

        const ctx = createCtx()
        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "reserveCreditForMessage":
                    return {
                        allowed: true,
                        bypassed: false,
                        existing: false,
                        committed: false
                    }
                case "reserveToolCallBudget":
                    return {
                        allowed: false,
                        reason: "quota"
                    }
                case "releaseReservedCreditForMessage":
                    return null
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getMessagesByThreadId":
                    return [{ _id: "db-message-1" }]
                case "getUserSettingsInternal":
                    return {
                        userId: "user-1",
                        searchProvider: "firecrawl",
                        searchIncludeSourcesByDefault: false,
                        toolCallLimitPerTurn: 3,
                        generalProviders: {},
                        mcpServers: []
                    }
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        const response = await chatPOSTHandler(
            ctx,
            createRequest({
                model: "shared-text",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: "hello" }]
                },
                enabledTools: ["web_search"],
                reasoningEffort: "off"
            })
        )

        expect(response.status).toBe(429)
        expect(ctx.runMutation).toHaveBeenCalledWith("releaseReservedCreditForMessage", {
            userId: "user-1",
            messageKey: "assistant-1:model"
        })
        expect(ctx.runMutation).not.toHaveBeenCalledWith(
            "createThreadOrInsertMessages",
            expect.anything()
        )
    })

    it("releases the reserved model charge and returns bad_request when reserving tool budget throws", async () => {
        process.env.PERPLEXITY_API_KEY = "server-perplexity-key"
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        getModelMock.mockResolvedValueOnce({
            model: { modelType: "text" },
            modelName: "Shared Text",
            providerSource: "internal",
            abilities: ["function_calling"],
            registry: {
                models: {
                    "shared-text": {
                        abilities: ["function_calling"]
                    }
                }
            }
        })

        const ctx = createCtx()
        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "reserveCreditForMessage":
                    return {
                        allowed: true,
                        bypassed: false,
                        existing: false,
                        committed: false
                    }
                case "reserveToolCallBudget":
                    throw new Error("tool budget failure")
                case "releaseReservedCreditForMessage":
                    return null
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getUserSettingsInternal":
                    return {
                        userId: "user-1",
                        searchProvider: "firecrawl",
                        searchIncludeSourcesByDefault: false,
                        toolCallLimitPerTurn: 3,
                        generalProviders: {},
                        mcpServers: []
                    }
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        const response = await chatPOSTHandler(
            ctx,
            createRequest({
                model: "shared-text",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: "hello" }]
                },
                enabledTools: ["web_search"],
                reasoningEffort: "off"
            })
        )

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toMatchObject({
            code: "bad_request:chat"
        })
        expect(ctx.runMutation).toHaveBeenCalledWith("releaseReservedCreditForMessage", {
            userId: "user-1",
            messageKey: "assistant-1:model"
        })
        expect(ctx.runMutation).not.toHaveBeenCalledWith(
            "createThreadOrInsertMessages",
            expect.anything()
        )
    })

    it("returns bad_request when message creation fails before streaming begins", async () => {
        const ctx = createCtx()
        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "reserveCreditForMessage":
                    return {
                        allowed: true,
                        bypassed: false,
                        existing: false,
                        committed: false
                    }
                case "createThreadOrInsertMessages":
                    throw new Error("db failure")
                case "releaseReservedCreditForMessage":
                    return null
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })

        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        getModelMock.mockResolvedValueOnce({
            model: { modelType: "text" },
            modelName: "Shared Text",
            providerSource: "internal",
            abilities: [],
            registry: {
                models: {
                    "shared-text": {
                        abilities: []
                    }
                }
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getUserSettingsInternal":
                    return {
                        userId: "user-1",
                        searchProvider: "firecrawl",
                        searchIncludeSourcesByDefault: false,
                        toolCallLimitPerTurn: 3,
                        generalProviders: {},
                        mcpServers: []
                    }
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        const response = await chatPOSTHandler(
            ctx,
            createRequest({
                model: "shared-text",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: "hello" }]
                },
                enabledTools: []
            })
        )

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toMatchObject({
            code: "bad_request:chat"
        })
        expect(ctx.runMutation).toHaveBeenCalledWith("releaseReservedCreditForMessage", {
            userId: "user-1",
            messageKey: "assistant-1:model"
        })
    })

    it("streams a text response, patches the assistant message, and records credits on the happy path", async () => {
        process.env.PERPLEXITY_API_KEY = "server-perplexity-key"
        const ctx = createCtx()
        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "createThreadOrInsertMessages":
                    return {
                        threadId: "thread-1",
                        assistantMessageId: "assistant-1",
                        assistantMessageConvexId: 42
                    }
                case "appendStreamId":
                    return "stream-1"
                case "reserveCreditForMessage":
                    return {
                        allowed: true,
                        bypassed: false,
                        existing: false,
                        committed: false
                    }
                case "reserveToolCallBudget":
                    return {
                        allowed: true,
                        existing: false,
                        bypassed: false,
                        reservedCalls: 3
                    }
                case "commitReservedCreditForMessage":
                    return {
                        committed: true
                    }
                case "updateThreadStreamingState":
                case "patchMessage":
                case "finalizeToolCallBudget":
                    return null
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getMessagesByThreadId":
                    return [{ _id: "db-message-1" }]
                case "getUserSettingsInternal":
                    return {
                        userId: "user-1",
                        searchProvider: "firecrawl",
                        searchIncludeSourcesByDefault: false,
                        toolCallLimitPerTurn: 3,
                        generalProviders: {},
                        mcpServers: []
                    }
                case "getThreadPersonaSnapshotInternal":
                    return null
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        const runtimeModel = { provider: "runtime-openai", modelType: "text" }
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1", creditPlan: "pro" })
        getModelMock.mockResolvedValueOnce({
            model: runtimeModel,
            modelId: "gpt-5.4-mini",
            modelName: "GPT 5.4 Mini",
            runtimeProvider: "openai",
            providerSource: "internal",
            abilities: ["function_calling", "effort_control"],
            registry: {
                models: {
                    "shared-text": {
                        abilities: [],
                        maxTokens: 2048
                    }
                }
            }
        })
        manualStreamTransformMock.mockImplementationOnce(
            (
                parts: Array<{ type: string; text?: string }>,
                totalTokenUsage: {
                    promptTokens: number
                    completionTokens: number
                    reasoningTokens: number
                    totalTokens: number
                    estimatedCostUsd?: number
                    estimatedPromptCostUsd?: number
                    estimatedCompletionCostUsd?: number
                },
                _uploadPromises: Promise<void>[],
                _userId: string,
                _ctx: unknown,
                streamMetrics?: {
                    firstVisibleAtMs?: number
                },
                options?: {
                    onToolCall?: (toolCall: { toolCallId: string; toolName: string }) => void
                    onFirstVisible?: () => void
                }
            ) => {
                options?.onToolCall?.({ toolCallId: "call-1", toolName: "web_search" })
                options?.onFirstVisible?.()
                parts.push({
                    type: "text",
                    text: "Hello world"
                })
                totalTokenUsage.promptTokens = 12
                totalTokenUsage.completionTokens = 34
                totalTokenUsage.reasoningTokens = 5
                totalTokenUsage.totalTokens = 46
                totalTokenUsage.estimatedCostUsd = 0.001552
                totalTokenUsage.estimatedPromptCostUsd = 0.000757
                totalTokenUsage.estimatedCompletionCostUsd = 0.000795
                if (streamMetrics) {
                    streamMetrics.firstVisibleAtMs = Date.now()
                }

                return new TransformStream()
            }
        )
        streamTextMock.mockReturnValueOnce({
            fullStream: createObjectStream([
                { type: "text-start", id: "text-1" },
                { type: "text-delta", id: "text-1", text: "Hello world" },
                {
                    type: "finish-step",
                    finishReason: "stop",
                    usage: {
                        inputTokens: 12,
                        outputTokens: 34,
                        outputTokenDetails: {
                            reasoningTokens: 5
                        }
                    }
                },
                { type: "text-end", id: "text-1" }
            ]),
            finishReason: Promise.resolve("stop")
        })

        const response = await chatPOSTHandler(
            ctx,
            createRequest({
                model: "shared-text",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: "hello" }]
                },
                enabledTools: ["web_search"],
                reasoningEffort: "medium",
                clientId: "client-1"
            })
        )

        expect(response.status).toBe(200)
        const responseText = await response.text()

        expect(generateThreadNameMock).toHaveBeenCalledTimes(1)
        expect(buildPromptMock).toHaveBeenCalledWith(
            expect.objectContaining({
                enabledTools: ["web_search"],
                toolCallLimitPerTurn: 3,
                userSettings: expect.objectContaining({
                    mcpServers: []
                }),
                personaPrompt: undefined,
                includeTemporalContext: false
            })
        )
        expect(getToolkitMock).toHaveBeenCalledWith(
            ctx,
            ["web_search"],
            expect.objectContaining({
                mcpServers: []
            }),
            expect.any(Object)
        )
        expect(stepCountIsMock).toHaveBeenCalledWith(100)
        expect(smoothStreamMock).toHaveBeenCalledTimes(1)
        expect(streamTextMock).toHaveBeenCalledWith(
            expect.objectContaining({
                model: runtimeModel,
                maxOutputTokens: 2048,
                stopWhen: "stop-after-100",
                experimental_transform: "smooth-transform",
                tools: {
                    web_search: {
                        description: "Search"
                    }
                },
                messages: [
                    {
                        role: "system",
                        content: "system prompt"
                    },
                    {
                        role: "user",
                        content: "hello from the user"
                    },
                    {
                        role: "system",
                        content: "temporal context"
                    }
                ]
            })
        )

        expect(ctx.runMutation).toHaveBeenCalledWith("updateThreadStreamingState", {
            threadId: "thread-1",
            isLive: true,
            streamStartedAt: expect.any(Number),
            currentStreamId: "stream-1",
            currentStreamOwnerClientId: "client-1"
        })
        expect(ctx.runMutation).toHaveBeenCalledWith("appendStreamId", {
            threadId: "thread-1",
            ownerClientId: "client-1"
        })
        expect(ctx.runMutation).toHaveBeenCalledWith("patchMessage", {
            threadId: "thread-1",
            messageId: "assistant-1",
            parts: [
                {
                    type: "text",
                    text: "Hello world"
                }
            ],
            metadata: expect.objectContaining({
                modelId: "shared-text",
                modelName: "GPT 5.4 Mini",
                promptTokens: 12,
                completionTokens: 34,
                reasoningTokens: 5,
                totalTokens: 46,
                estimatedCostUsd: 0.001552,
                estimatedPromptCostUsd: 0.000757,
                estimatedCompletionCostUsd: 0.000795,
                creditProviderSource: "internal",
                creditFeature: "chat",
                creditBucket: "none",
                creditUnits: 0,
                creditCounted: true,
                timeToFirstVisibleMs: expect.any(Number)
            })
        })
        expect(responseText).toContain('"totalTokens":46')
        expect(responseText).toContain('"estimatedCostUsd":0.001552')
        expect(responseText).toMatch(/"timeToFirstVisibleMs":\d+/)
        expect(ctx.runMutation).toHaveBeenCalledWith(
            "reserveCreditForMessage",
            expect.objectContaining({
                userId: "user-1",
                threadId: undefined,
                messageId: "assistant-1",
                messageKey: "assistant-1:model",
                modelId: "shared-text",
                providerSource: "internal",
                feature: "chat",
                counted: true,
                reservedMicrousd: expect.any(Number),
                pricingSource: "openrouter_estimate",
                requiredPlan: "pro"
            })
        )
        expect(ctx.runMutation).toHaveBeenCalledWith("commitReservedCreditForMessage", {
            userId: "user-1",
            messageKey: "assistant-1:model",
            threadId: "thread-1",
            messageId: "assistant-1",
            settledMicrousd: 1552,
            pricingSource: "openrouter_reported"
        })
        expect(ctx.runMutation).toHaveBeenCalledWith("reserveToolCallBudget", {
            userId: "user-1",
            threadId: undefined,
            messageId: "assistant-1",
            messageKey: "assistant-1:tool-budget",
            reservedCalls: 3,
            reservedMicrousd: 15_000
        })
        expect(ctx.runMutation).toHaveBeenCalledWith("finalizeToolCallBudget", {
            userId: "user-1",
            messageKey: "assistant-1:tool-budget"
        })
        expect(ctx.runMutation).toHaveBeenCalledWith("updateThreadStreamingState", {
            threadId: "thread-1",
            isLive: false,
            currentStreamId: undefined
        })
    })

    it("commits retry charges against the persisted assistant id while keeping the attempt-scoped message key", async () => {
        const ctx = createCtx()
        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "createThreadOrInsertMessages":
                    return {
                        threadId: "thread-1",
                        assistantMessageId: "assistant-original",
                        assistantMessageConvexId: 42
                    }
                case "appendStreamId":
                    return "stream-1"
                case "reserveCreditForMessage":
                    return {
                        allowed: true,
                        bypassed: false,
                        existing: false,
                        committed: false
                    }
                case "commitReservedCreditForMessage":
                    return {
                        committed: true
                    }
                case "updateThreadStreamingState":
                case "patchMessage":
                    return null
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getMessagesByThreadId":
                    return [{ _id: "db-message-1" }]
                case "getUserSettingsInternal":
                    return {
                        userId: "user-1",
                        searchProvider: "firecrawl",
                        searchIncludeSourcesByDefault: false,
                        toolCallLimitPerTurn: 3,
                        generalProviders: {},
                        mcpServers: []
                    }
                case "getThreadPersonaSnapshotInternal":
                    return null
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        getModelMock.mockResolvedValueOnce({
            model: { modelType: "text" },
            modelId: "shared-text",
            modelName: "Shared Text",
            runtimeProvider: "openai",
            providerSource: "internal",
            abilities: [],
            registry: {
                models: {
                    "shared-text": {
                        abilities: [],
                        maxTokens: 2048
                    }
                }
            }
        })
        manualStreamTransformMock.mockImplementationOnce(
            (
                parts: Array<{ type: string; text?: string }>,
                _totalTokenUsage: unknown,
                _uploadPromises: Promise<void>[],
                _userId: string,
                _ctx: unknown,
                streamMetrics?: {
                    firstVisibleAtMs?: number
                },
                options?: {
                    onFirstVisible?: () => void
                    onPartsChanged?: () => void
                }
            ) =>
                new TransformStream({
                    transform(
                        chunk: {
                            type: string
                            text?: string
                        },
                        controller
                    ) {
                        if (chunk.type === "text-delta" && chunk.text) {
                            options?.onFirstVisible?.()
                            parts.push({
                                type: "text",
                                text: chunk.text
                            })
                            options?.onPartsChanged?.()
                            if (streamMetrics) {
                                streamMetrics.firstVisibleAtMs = Date.now()
                            }
                        }

                        controller.enqueue(chunk)
                    }
                })
        )
        streamTextMock.mockReturnValueOnce({
            fullStream: createObjectStream([
                { type: "text-start", id: "text-1" },
                { type: "text-delta", id: "text-1", text: "retry response" },
                {
                    type: "finish-step",
                    usage: {
                        inputTokens: 1,
                        outputTokens: 1,
                        totalTokens: 2
                    }
                },
                { type: "text-end", id: "text-1" }
            ]),
            finishReason: Promise.resolve("stop")
        })

        const response = await chatPOSTHandler(
            ctx,
            createRequest({
                id: "thread-1",
                model: "shared-text",
                proposedNewAssistantId: "assistant-attempt",
                targetFromMessageId: "user-msg-1",
                targetMode: "retry",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: "hello again" }]
                },
                enabledTools: [],
                reasoningEffort: "off"
            })
        )

        expect(response.status).toBe(200)
        await response.text()

        expect(ctx.runMutation).toHaveBeenCalledWith(
            "reserveCreditForMessage",
            expect.objectContaining({
                userId: "user-1",
                threadId: "thread-1",
                messageId: "assistant-attempt",
                messageKey: "assistant-attempt:model",
                modelId: "shared-text"
            })
        )
        expect(ctx.runMutation).toHaveBeenCalledWith(
            "commitReservedCreditForMessage",
            expect.objectContaining({
                userId: "user-1",
                messageKey: "assistant-attempt:model",
                threadId: "thread-1",
                messageId: "assistant-original"
            })
        )
    })

    it("commits the model charge when visible output is followed by a fatal stream error", async () => {
        const ctx = createCtx()
        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "createThreadOrInsertMessages":
                    return {
                        threadId: "thread-1",
                        assistantMessageId: "assistant-1",
                        assistantMessageConvexId: 42
                    }
                case "appendStreamId":
                    return "stream-1"
                case "reserveCreditForMessage":
                    return {
                        allowed: true,
                        bypassed: false,
                        existing: false,
                        committed: false
                    }
                case "commitReservedCreditForMessage":
                    return {
                        committed: true
                    }
                case "updateThreadStreamingState":
                    return null
                case "releaseReservedCreditForMessage":
                case "finalizeToolCallBudget":
                    return null
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getMessagesByThreadId":
                    return [{ _id: "db-message-1" }]
                case "getUserSettingsInternal":
                    return {
                        userId: "user-1",
                        searchProvider: "firecrawl",
                        searchIncludeSourcesByDefault: false,
                        toolCallLimitPerTurn: 3,
                        generalProviders: {},
                        mcpServers: []
                    }
                case "getThreadPersonaSnapshotInternal":
                    return null
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        getModelMock.mockResolvedValueOnce({
            model: { modelType: "text" },
            modelId: "shared-text",
            modelName: "Shared Text",
            runtimeProvider: "openai",
            providerSource: "internal",
            abilities: [],
            registry: {
                models: {
                    "shared-text": {
                        abilities: [],
                        maxTokens: 2048
                    }
                }
            }
        })
        manualStreamTransformMock.mockImplementationOnce(
            (
                parts: Array<{ type: string; text?: string }>,
                _totalTokenUsage: unknown,
                _uploadPromises: Promise<void>[],
                _userId: string,
                _ctx: unknown,
                streamMetrics?: {
                    firstVisibleAtMs?: number
                },
                options?: {
                    onFirstVisible?: () => void
                }
            ) => {
                options?.onFirstVisible?.()
                parts.push({
                    type: "text",
                    text: "hello before failure"
                })
                if (streamMetrics) {
                    streamMetrics.firstVisibleAtMs = Date.now()
                }

                return new TransformStream()
            }
        )
        streamTextMock.mockReturnValueOnce({
            fullStream: createObjectStream([
                { type: "text-start", id: "text-1" },
                { type: "text-delta", id: "text-1", text: "hello before failure" },
                { type: "text-end", id: "text-1" }
            ]),
            finishReason: Promise.reject(new Error("finish failed"))
        })

        const response = await chatPOSTHandler(
            ctx,
            createRequest({
                model: "shared-text",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: "hello" }]
                },
                enabledTools: [],
                reasoningEffort: "off"
            })
        )

        expect(response.status).toBe(200)
        await response.text()
        await Promise.resolve()

        expect(ctx.runMutation).toHaveBeenCalledWith("commitReservedCreditForMessage", {
            userId: "user-1",
            messageKey: "assistant-1:model",
            threadId: "thread-1",
            messageId: "assistant-1"
        })
        expect(ctx.runMutation).not.toHaveBeenCalledWith("releaseReservedCreditForMessage", {
            userId: "user-1",
            messageKey: "assistant-1:model"
        })
    })

    it("persists partial assistant parts before the final stream patch", async () => {
        const ctx = createCtx()
        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "createThreadOrInsertMessages":
                    return {
                        threadId: "thread-1",
                        assistantMessageId: "assistant-1",
                        assistantMessageConvexId: 42
                    }
                case "appendStreamId":
                    return "stream-1"
                case "reserveCreditForMessage":
                    return {
                        allowed: true,
                        bypassed: false,
                        existing: false,
                        committed: false
                    }
                case "updateThreadStreamingState":
                case "patchMessage":
                case "reserveToolCallBudget":
                case "finalizeToolCallBudget":
                case "releaseReservedCreditForMessage":
                    return null
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getMessagesByThreadId":
                    return [{ _id: "db-message-1" }]
                case "getUserSettingsInternal":
                    return {
                        mcpServers: []
                    }
                case "getThreadPersonaSnapshotInternal":
                    return null
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1", creditPlan: "pro" })
        getModelMock.mockResolvedValueOnce({
            model: { modelType: "text" },
            modelId: "gpt-5.4-mini",
            modelName: "GPT 5.4 Mini",
            runtimeProvider: "openai",
            providerSource: "internal",
            abilities: [],
            registry: {
                models: {
                    "shared-text": {
                        abilities: []
                    }
                }
            }
        })

        streamTextMock.mockReturnValueOnce({
            fullStream: createObjectStream([
                { type: "text-start", id: "text-1" },
                { type: "text-delta", id: "text-1", text: "Hello" },
                { type: "text-end", id: "text-1" }
            ]),
            finishReason: Promise.resolve("stop")
        })

        const response = await chatPOSTHandler(
            ctx,
            createRequest({
                model: "shared-text",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: "hello" }]
                },
                enabledTools: []
            })
        )

        expect(response.status).toBe(200)
        await response.text()

        const patchCalls = ctx.runMutation.mock.calls.filter(([name]) => name === "patchMessage")
        const patchPayloads = patchCalls.map(([, payload]) => payload)
        const livePatch = patchPayloads.find(
            (payload) =>
                !("modelId" in ((payload as { metadata?: Record<string, unknown> }).metadata ?? {}))
        )
        const finalPatch = patchPayloads.find(
            (payload) =>
                "modelId" in ((payload as { metadata?: Record<string, unknown> }).metadata ?? {})
        )

        expect(patchCalls).toHaveLength(2)
        expect(livePatch).toEqual({
            threadId: "thread-1",
            messageId: "assistant-1",
            parts: [
                {
                    type: "text",
                    text: "Hello"
                }
            ],
            metadata: expect.objectContaining({
                serverDurationMs: expect.any(Number)
            })
        })
        expect((finalPatch as { threadId?: string } | undefined)?.threadId).toBe("thread-1")
        expect((finalPatch as { messageId?: string } | undefined)?.messageId).toBe("assistant-1")
        expect(
            (finalPatch as { parts?: Array<{ type?: string; text?: string }> } | undefined)?.parts
        ).toContainEqual({
            type: "text",
            text: "Hello"
        })
        expect(
            (finalPatch as { metadata?: { modelId?: string } } | undefined)?.metadata?.modelId
        ).toBe("shared-text")
    })

    it("keeps the provider stream alive when the incoming request aborts", async () => {
        const ctx = createCtx()
        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "createThreadOrInsertMessages":
                    return {
                        threadId: "thread-1",
                        assistantMessageId: "assistant-1",
                        assistantMessageConvexId: 42
                    }
                case "appendStreamId":
                    return "stream-1"
                case "reserveCreditForMessage":
                    return {
                        allowed: true,
                        bypassed: false,
                        existing: false,
                        committed: false
                    }
                case "updateThreadStreamingState":
                case "patchMessage":
                case "reserveToolCallBudget":
                case "finalizeToolCallBudget":
                case "releaseReservedCreditForMessage":
                    return null
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getMessagesByThreadId":
                    return [{ _id: "db-message-1" }]
                case "getUserSettingsInternal":
                    return {
                        mcpServers: []
                    }
                case "getThreadPersonaSnapshotInternal":
                    return null
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1", creditPlan: "pro" })
        getModelMock.mockResolvedValueOnce({
            model: { modelType: "text" },
            modelId: "gpt-5.4-mini",
            modelName: "GPT 5.4 Mini",
            runtimeProvider: "openai",
            providerSource: "internal",
            abilities: [],
            registry: {
                models: {
                    "shared-text": {
                        abilities: []
                    }
                }
            }
        })

        streamTextMock.mockImplementationOnce(() => ({
            fullStream: new ReadableStream({
                start(controller) {
                    controller.close()
                }
            }),
            finishReason: Promise.resolve("stop")
        }))

        const controller = new AbortController()
        const response = await chatPOSTHandler(
            ctx,
            createAbortableRequest(
                {
                    model: "shared-text",
                    proposedNewAssistantId: "assistant-1",
                    message: {
                        role: "user",
                        parts: [{ type: "text", text: "hello" }]
                    },
                    enabledTools: []
                },
                controller.signal
            )
        )

        controller.abort("user stop")
        await response.text()

        const generationSignal = streamTextMock.mock.calls[0]?.[0]?.abortSignal as
            | AbortSignal
            | undefined
        expect(generationSignal).toBeDefined()
        expect(generationSignal?.aborted).toBe(false)
    })

    it("serves the sender directly while registering a resumable side channel", async () => {
        const ctx = createCtx()
        const persistedChunks: string[] = []
        const createNewResumableStream = vi.fn(
            async (
                _streamId: string,
                makeStream: () => ReadableStream<string>,
                _options?: { onStop?: () => void }
            ) => {
                const sourceStream = makeStream()
                const reader = sourceStream.getReader()
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    persistedChunks.push(value)
                }
                return new ReadableStream<string>()
            }
        )

        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "createThreadOrInsertMessages":
                    return {
                        threadId: "thread-1",
                        assistantMessageId: "assistant-1",
                        assistantMessageConvexId: 42
                    }
                case "appendStreamId":
                    return "stream-1"
                case "reserveCreditForMessage":
                    return {
                        allowed: true,
                        bypassed: false,
                        existing: false,
                        committed: false
                    }
                case "updateThreadStreamingState":
                case "finalizeToolCallBudget":
                case "releaseReservedCreditForMessage":
                    return null
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getMessagesByThreadId":
                    return [{ _id: "db-message-1" }]
                case "getUserSettingsInternal":
                    return {
                        mcpServers: []
                    }
                case "getThreadPersonaSnapshotInternal":
                    return null
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1", creditPlan: "pro" })
        getModelMock.mockResolvedValueOnce({
            model: { modelType: "text" },
            modelId: "gpt-5.4-mini",
            modelName: "GPT 5.4 Mini",
            runtimeProvider: "openai",
            providerSource: "internal",
            abilities: [],
            registry: {
                models: {
                    "shared-text": {
                        abilities: []
                    }
                }
            }
        })
        getResumableStreamContextMock.mockReturnValueOnce({
            createNewResumableStream
        })
        createUIMessageStreamMock.mockImplementationOnce(
            () =>
                new ReadableStream({
                    start(controller) {
                        controller.enqueue({
                            type: "start",
                            messageId: "assistant-1"
                        })
                        controller.enqueue({
                            type: "finish",
                            finishReason: "stop"
                        })
                        controller.close()
                    }
                })
        )

        const response = await chatPOSTHandler(
            ctx,
            createRequest({
                model: "shared-text",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: "hello" }]
                },
                enabledTools: []
            })
        )

        expect(response.status).toBe(200)
        await expect(response.text()).resolves.toContain('{"type":"finish","finishReason":"stop"}')
        expect(persistedChunks.join("")).toContain('{"type":"finish","finishReason":"stop"}')
        expect(createNewResumableStream).toHaveBeenCalledWith(
            "stream-1",
            expect.any(Function),
            expect.objectContaining({ onStop: expect.any(Function) })
        )
    })

    it("enables OpenRouter reasoning for toggle-only models when thinking is selected", async () => {
        const ctx = createCtx()
        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "createThreadOrInsertMessages":
                    return {
                        threadId: "thread-1",
                        assistantMessageId: "assistant-1",
                        assistantMessageConvexId: 42
                    }
                case "appendStreamId":
                    return "stream-1"
                case "reserveCreditForMessage":
                    return {
                        allowed: true,
                        bypassed: false,
                        existing: false,
                        committed: false
                    }
                case "updateThreadStreamingState":
                case "patchMessage":
                case "reserveToolCallBudget":
                case "finalizeToolCallBudget":
                case "releaseReservedCreditForMessage":
                    return null
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getMessagesByThreadId":
                    return [{ _id: "db-message-1" }]
                case "getUserSettingsInternal":
                    return {
                        mcpServers: []
                    }
                case "getThreadPersonaSnapshotInternal":
                    return null
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1", creditPlan: "pro" })
        getModelMock.mockResolvedValueOnce({
            model: { provider: "runtime-openrouter", modelType: "text" },
            modelId: "deepseek-v3.2",
            modelName: "DeepSeek V3.2",
            runtimeProvider: "openrouter",
            providerSource: "openrouter",
            abilities: ["reasoning", "function_calling"],
            registry: {
                models: {
                    "deepseek-v3.2": {
                        abilities: ["reasoning", "function_calling"],
                        supportsDisablingReasoning: true
                    }
                }
            }
        })
        manualStreamTransformMock.mockImplementationOnce(() => new TransformStream())
        streamTextMock.mockReturnValueOnce({
            fullStream: createObjectStream([]),
            finishReason: Promise.resolve("stop")
        })

        const response = await chatPOSTHandler(
            ctx,
            createRequest({
                model: "deepseek-v3.2",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: "hello" }]
                },
                enabledTools: [],
                reasoningEffort: "medium"
            })
        )

        expect(response.status).toBe(200)
        await response.text()

        expect(streamTextMock).toHaveBeenCalledWith(
            expect.objectContaining({
                providerOptions: expect.objectContaining({
                    openrouter: expect.objectContaining({
                        reasoning: {
                            enabled: true
                        },
                        extraBody: expect.objectContaining({
                            include_reasoning: true,
                            session_id: "thread-1"
                        })
                    })
                })
            })
        )
    })

    it("pins Grok 4.3 reasoning control to x-ai when routed through OpenRouter", async () => {
        const ctx = createCtx()
        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "createThreadOrInsertMessages":
                    return {
                        threadId: "thread-1",
                        assistantMessageId: "assistant-1",
                        assistantMessageConvexId: 42
                    }
                case "appendStreamId":
                    return "stream-1"
                case "reserveCreditForMessage":
                    return {
                        allowed: true,
                        bypassed: false,
                        existing: false,
                        committed: false
                    }
                case "updateThreadStreamingState":
                case "patchMessage":
                case "reserveToolCallBudget":
                case "finalizeToolCallBudget":
                case "releaseReservedCreditForMessage":
                    return null
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getMessagesByThreadId":
                    return [{ _id: "db-message-1" }]
                case "getUserSettingsInternal":
                    return {
                        mcpServers: []
                    }
                case "getThreadPersonaSnapshotInternal":
                    return null
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1", creditPlan: "pro" })
        getModelMock.mockResolvedValueOnce({
            model: { provider: "runtime-openrouter", modelType: "text" },
            modelId: "grok-4.3",
            modelName: "Grok 4.3",
            runtimeProvider: "openrouter",
            providerSource: "openrouter",
            abilities: ["reasoning", "vision", "function_calling", "effort_control"],
            registry: {
                models: {
                    "grok-4.3": {
                        abilities: ["reasoning", "vision", "function_calling", "effort_control"],
                        supportsDisablingReasoning: true
                    }
                }
            }
        })
        manualStreamTransformMock.mockImplementationOnce(() => new TransformStream())
        streamTextMock.mockReturnValueOnce({
            fullStream: createObjectStream([]),
            finishReason: Promise.resolve("stop")
        })

        const response = await chatPOSTHandler(
            ctx,
            createRequest({
                model: "grok-4.3",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: "hello" }]
                },
                enabledTools: [],
                reasoningEffort: "high"
            })
        )

        expect(response.status).toBe(200)
        await response.text()

        expect(streamTextMock).toHaveBeenCalledWith(
            expect.objectContaining({
                providerOptions: expect.objectContaining({
                    openrouter: expect.objectContaining({
                        reasoning: {
                            enabled: true,
                            effort: "high"
                        },
                        extraBody: expect.objectContaining({
                            provider: expect.objectContaining({
                                only: ["x-ai"],
                                allow_fallbacks: true,
                                require_parameters: true
                            }),
                            include_reasoning: true
                        })
                    })
                })
            })
        )
    })

    it("uses OpenRouter native PDF parsing for Gemini models", async () => {
        const ctx = createCtx()
        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "createThreadOrInsertMessages":
                    return {
                        threadId: "thread-1",
                        assistantMessageId: "assistant-1",
                        assistantMessageConvexId: 42
                    }
                case "appendStreamId":
                    return "stream-1"
                case "reserveCreditForMessage":
                    return {
                        allowed: true,
                        bypassed: false,
                        existing: false,
                        committed: false
                    }
                case "updateThreadStreamingState":
                case "patchMessage":
                case "reserveToolCallBudget":
                case "finalizeToolCallBudget":
                case "releaseReservedCreditForMessage":
                    return null
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getMessagesByThreadId":
                    return [{ _id: "db-message-1" }]
                case "getUserSettingsInternal":
                    return {
                        mcpServers: []
                    }
                case "getThreadPersonaSnapshotInternal":
                    return null
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1", creditPlan: "pro" })
        getModelMock.mockResolvedValueOnce({
            model: { provider: "runtime-openrouter", modelType: "text" },
            modelId: "gemini-3.1-pro-preview",
            modelName: "Gemini 3.1 Pro",
            runtimeProvider: "openrouter",
            providerSource: "openrouter",
            abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
            registry: {
                models: {
                    "gemini-3.1-pro-preview": {
                        abilities: [
                            "reasoning",
                            "vision",
                            "function_calling",
                            "native_pdf",
                            "effort_control"
                        ],
                        reasoningEfforts: ["minimal", "low", "medium", "high"]
                    }
                }
            }
        })
        const pdfMappedMessages = [
            {
                role: "user",
                messageId: "message-1",
                content: [
                    {
                        type: "text",
                        text: "Review this PDF"
                    },
                    {
                        type: "file",
                        mediaType: "application/pdf",
                        filename: "paper.pdf",
                        data: "https://r2.example.com/attachments/user-1/paper.pdf"
                    }
                ]
            }
        ]
        dbMessagesToCoreMock
            .mockResolvedValueOnce(pdfMappedMessages)
            .mockResolvedValueOnce(pdfMappedMessages)
        manualStreamTransformMock.mockImplementationOnce(() => new TransformStream())
        streamTextMock.mockReturnValueOnce({
            fullStream: createObjectStream([]),
            finishReason: Promise.resolve("stop")
        })

        const response = await chatPOSTHandler(
            ctx,
            createRequest({
                model: "gemini-3.1-pro-preview",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [
                        { type: "text", text: "Review this PDF" },
                        {
                            type: "file",
                            data: "https://r2.example.com/attachments/user-1/paper.pdf",
                            filename: "paper.pdf",
                            mimeType: "application/pdf"
                        }
                    ]
                },
                enabledTools: [],
                reasoningEffort: "minimal"
            })
        )

        expect(response.status).toBe(200)
        await response.text()

        expect(streamTextMock).toHaveBeenCalledWith(
            expect.objectContaining({
                messages: expect.arrayContaining([
                    expect.objectContaining({
                        role: "user",
                        content: expect.arrayContaining([
                            expect.objectContaining({
                                type: "file",
                                mediaType: "application/pdf",
                                filename: "paper.pdf",
                                data: "https://r2.example.com/attachments/user-1/paper.pdf"
                            })
                        ])
                    })
                ]),
                providerOptions: expect.objectContaining({
                    openrouter: expect.objectContaining({
                        plugins: [
                            {
                                id: "file-parser",
                                pdf: {
                                    engine: "native"
                                }
                            }
                        ]
                    })
                })
            })
        )
    })

    it("falls back to medium reasoning for Grok 4.3 outside OpenRouter", async () => {
        const ctx = createCtx()
        ctx.runMutation.mockImplementation(async (name: string) => {
            switch (name) {
                case "createThreadOrInsertMessages":
                    return {
                        threadId: "thread-1",
                        assistantMessageId: "assistant-1",
                        assistantMessageConvexId: 42
                    }
                case "appendStreamId":
                    return "stream-1"
                case "reserveCreditForMessage":
                    return {
                        allowed: true,
                        bypassed: false,
                        existing: false,
                        committed: false
                    }
                case "updateThreadStreamingState":
                case "patchMessage":
                case "reserveToolCallBudget":
                case "finalizeToolCallBudget":
                case "releaseReservedCreditForMessage":
                    return null
                default:
                    throw new Error(`Unexpected mutation: ${name}`)
            }
        })
        ctx.runQuery.mockImplementation(async (name: string) => {
            switch (name) {
                case "getMessagesByThreadId":
                    return [{ _id: "db-message-1" }]
                case "getUserSettingsInternal":
                    return {
                        mcpServers: []
                    }
                case "getThreadPersonaSnapshotInternal":
                    return null
                default:
                    throw new Error(`Unexpected query: ${name}`)
            }
        })

        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1", creditPlan: "pro" })
        getModelMock.mockResolvedValueOnce({
            model: { provider: "runtime-xai", modelType: "text" },
            modelId: "grok-4.3",
            modelName: "Grok 4.3",
            runtimeProvider: "xai",
            providerSource: "byok",
            abilities: ["reasoning", "vision", "function_calling", "effort_control"],
            registry: {
                models: {
                    "grok-4.3": {
                        abilities: ["reasoning", "vision", "function_calling", "effort_control"],
                        supportsDisablingReasoning: true
                    }
                }
            }
        })
        manualStreamTransformMock.mockImplementationOnce(() => new TransformStream())
        streamTextMock.mockReturnValueOnce({
            fullStream: createObjectStream([]),
            finishReason: Promise.resolve("stop")
        })

        const response = await chatPOSTHandler(
            ctx,
            createRequest({
                model: "grok-4.3",
                proposedNewAssistantId: "assistant-1",
                message: {
                    role: "user",
                    parts: [{ type: "text", text: "hello" }]
                },
                enabledTools: [],
                reasoningEffort: "high"
            })
        )

        expect(response.status).toBe(200)
        await expect(response.text()).resolves.toContain('"reasoningEffort":"medium"')
    })
})
