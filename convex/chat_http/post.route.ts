"use node"

import { ChatError } from "@/lib/errors"
import type { ReasoningEffort } from "@/lib/model-store"
import { clampToolCallLimitPerTurn } from "@/lib/tool-call-limit"
import type { OpenRouterProviderOptions } from "@openrouter/ai-sdk-provider"
import {
    JsonToSseTransformStream,
    type ModelMessage,
    type Tool,
    UI_MESSAGE_STREAM_HEADERS,
    createUIMessageStream,
    smoothStream,
    stepCountIs,
    streamText
} from "ai"
import type { Infer } from "convex/values"
import { internal } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { type ActionCtx, httpAction } from "../_generated/server"
import { r2 } from "../attachments"
import { getAccountDeletionBlockerForAction } from "../lib/account_deletion_gate"
import {
    type ContextLimitViolation,
    type SuggestedModel,
    computeSuggestedModels,
    estimateHttpMessageTokens,
    estimateModelMessagesTokens,
    getContextLimitViolation,
    resolveContextLimits
} from "../lib/context_limits"
import {
    resolvePrototypeCreditCharge,
    resolvePrototypeToolCreditCharge,
    resolveRequiredPlanForModelAccess
} from "../lib/credits"
import { dbMessagesToCore } from "../lib/db_to_core_messages"
import { getUserIdentity } from "../lib/identity"
import {
    type PreparedImageReference,
    getImageModelMaxPerMessage,
    getReferenceSourceForKey,
    getSelectableImageModels,
    getSupportedAspectRatiosForImageModel,
    getSupportedResolutionsForImageModel
} from "../lib/image_generation/shared"
import { type CoreProvider, MODELS_SHARED, type SharedModel } from "../lib/models"
import {
    getAllowedReasoningEffortsForModel as getSharedAllowedReasoningEffortsForModel,
    resolveReasoningEffortForModel
} from "../lib/models/reasoning"
import { type CompiledPersonaSnapshot, compilePersonaSnapshot } from "../lib/personas"
import { getResumableStreamContext } from "../lib/resumable_stream_context"
import {
    type AbilityId,
    type ToolFundingSource,
    getToolkit,
    resolveToolAvailability,
    sanitizeEnabledTools
} from "../lib/toolkit"
import {
    PREPARE_IMAGE_GENERATION_TOOL_NAME,
    getPrepareImageGenerationTool
} from "../lib/tools/image_generation"
import {
    estimateOpenRouterReservationMicrousd,
    getConfiguredToolUsageMicrousd,
    usdToMicrousd
} from "../lib/usage_metering"
import { getBuiltInPersonaDefinition } from "../personas"
import type { HTTPAIMessage, Message } from "../schema/message"
import type { ErrorUIPart } from "../schema/parts"
import { generateThreadName } from "./generate_thread_name"
import { getModel } from "./get_model"
import { manualStreamTransform } from "./manual_stream_transform"
import { buildPrompt, buildTemporalContext } from "./prompt"

type OpenRouterRequestProviderOptions = OpenRouterProviderOptions & {
    extraBody?: Record<string, unknown>
    plugins?: Array<{
        id: string
        pdf?: {
            engine: string
        }
    }>
}

const OPENROUTER_ONLY_REASONING_CONTROL_MODEL_IDS = new Set(["grok-4.3"])

const normalizeDisplayProvider = (providerId: string | undefined) => {
    switch (providerId) {
        case "x-ai":
            return "xai"
        case "google":
        case "openai":
        case "anthropic":
        case "xai":
        case "groq":
        case "fal":
        case "openrouter":
            return providerId
        default:
            return providerId
    }
}

const resolveDisplayProvider = (
    modelId: string,
    runtimeProvider: CoreProvider | "openrouter" | "custom" | "unknown"
) => {
    const sharedModel = MODELS_SHARED.find((candidate) => candidate.id === modelId)
    if (!sharedModel) {
        if (runtimeProvider === "custom" || runtimeProvider === "unknown") {
            return undefined
        }
        return normalizeDisplayProvider(runtimeProvider)
    }

    if (sharedModel.customIcon) {
        return normalizeDisplayProvider(sharedModel.customIcon)
    }

    const providerAdapter = sharedModel.adapters.find((adapter) => {
        const providerId = adapter.split(":")[0]
        return providerId.startsWith("i3-") || providerId === "openrouter" || providerId === "xai"
    })

    if (providerAdapter) {
        const [providerId, providerModelId] = providerAdapter.split(":")
        if (providerId === "openrouter") {
            return normalizeDisplayProvider(providerModelId.split("/")[0])
        }

        if (providerId.startsWith("i3-")) {
            return normalizeDisplayProvider(providerId.slice(3))
        }

        return normalizeDisplayProvider(providerId)
    }

    if (runtimeProvider === "custom" || runtimeProvider === "unknown") {
        return undefined
    }

    return normalizeDisplayProvider(runtimeProvider)
}

const buildOpenRouterProviderOptions = (
    modelId: string,
    reasoningEffort: ReasoningEffort,
    supportsEffortControl = false,
    supportsReasoningToggle = false,
    supportsReasoning = false,
    sessionId?: string
): OpenRouterProviderOptions => {
    const options: OpenRouterRequestProviderOptions = {}
    const isGoogleModel = modelId.startsWith("gemini-")
    const isXaiPinnedReasoningModel = modelId === "grok-4.3"
    const isDeepSeekModel = modelId.startsWith("deepseek-")
    const shouldForceReasoningForVariant =
        modelId.endsWith("-reasoning") || modelId.endsWith("-thinking")
    const isAlwaysOnReasoningModel = supportsReasoning && !supportsReasoningToggle

    if (isGoogleModel) {
        options.plugins = [
            {
                id: "file-parser",
                pdf: {
                    engine: "native"
                }
            }
        ]
    }

    const baseProviderConfig = isXaiPinnedReasoningModel
        ? {
              only: ["x-ai"],
              allow_fallbacks: true,
              require_parameters: true
          }
        : isDeepSeekModel
          ? {
                only: ["deepseek"],
                allow_fallbacks: false,
                require_parameters: true
            }
          : {
                require_parameters: true
            }
    const applySharedExtraBody = () => {
        if (!sessionId) return
        options.extraBody = {
            ...options.extraBody,
            session_id: sessionId
        }
    }

    if (reasoningEffort === "off" && !isAlwaysOnReasoningModel) {
        options.reasoning = {
            enabled: false,
            exclude: true,
            effort: "none"
        }
        options.extraBody = {
            provider: baseProviderConfig,
            include_reasoning: false,
            usage: {
                include: true
            }
        }
        applySharedExtraBody()
        return options
    }

    if (
        (supportsReasoningToggle || isAlwaysOnReasoningModel) &&
        !supportsEffortControl &&
        !shouldForceReasoningForVariant
    ) {
        options.reasoning = {
            enabled: true
        } as OpenRouterRequestProviderOptions["reasoning"]
        options.extraBody = {
            provider: baseProviderConfig,
            include_reasoning: true,
            usage: {
                include: true
            }
        }
        applySharedExtraBody()
        return options
    }

    if (!supportsEffortControl && !shouldForceReasoningForVariant) {
        options.extraBody = {
            provider: baseProviderConfig,
            usage: {
                include: true
            }
        }
        applySharedExtraBody()
        return options
    }

    options.reasoning = {
        enabled: true,
        effort: reasoningEffort === "off" ? "medium" : reasoningEffort
    }
    options.extraBody = {
        provider: baseProviderConfig,
        include_reasoning: true,
        usage: {
            include: true
        }
    }
    applySharedExtraBody()

    return options
}

const resolveEffectiveReasoningEffort = (
    modelId: string,
    selectedModel: SharedModel | null | undefined,
    requestedReasoningEffort?: ReasoningEffort,
    supportsEffortControl = false
): ReasoningEffort => {
    const reasoningEffort = requestedReasoningEffort ?? "medium"
    const isForcedReasoningVariant = modelId.endsWith("-reasoning") || modelId.endsWith("-thinking")
    const allowedReasoningEfforts = getSharedAllowedReasoningEffortsForModel(selectedModel)
    const supportsReasoningToggle = allowedReasoningEfforts.includes("off")
    const supportsReasoning = allowedReasoningEfforts.length > 0
    const isToggleOnlyReasoningModel = supportsReasoningToggle && !supportsEffortControl
    const isAlwaysOnReasoningModel = supportsReasoning && !supportsReasoningToggle

    if (isForcedReasoningVariant && reasoningEffort === "off") {
        return supportsEffortControl ? "low" : "medium"
    }

    if (isAlwaysOnReasoningModel) {
        return (
            resolveReasoningEffortForModel(selectedModel, requestedReasoningEffort) ??
            (supportsEffortControl ? "low" : "medium")
        )
    }

    if (isToggleOnlyReasoningModel) {
        return reasoningEffort === "off" ? "off" : "medium"
    }

    return reasoningEffort
}

const createSafeResumableSseStream = ({
    stream,
    threadId,
    streamId
}: {
    stream: ReadableStream<string>
    threadId: Id<"threads">
    streamId: string
}) => {
    let reader: ReadableStreamDefaultReader<string> | null = null

    return new ReadableStream<string>({
        async start(controller) {
            reader = stream.getReader()

            try {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    controller.enqueue(value)
                }
            } catch (error) {
                console.error("[cvx][chat][stream] Resumable SSE source failed", {
                    threadId,
                    streamId,
                    error
                })
                controller.enqueue(
                    `data: ${JSON.stringify({ type: "error", errorText: "Stream error occurred" })}\n\n`
                )
                controller.enqueue("data: [DONE]\n\n")
            } finally {
                try {
                    controller.close()
                } catch {
                    // Ignore close races after downstream cancellation.
                }
                reader.releaseLock()
                reader = null
            }
        },
        async cancel(reason) {
            await reader?.cancel(reason)
        }
    })
}

type PersonaSelection = {
    source: "default" | "builtin" | "user"
    id?: string
}

const fetchPersonaDocumentText = async (key: string) => {
    const fileUrl = await r2.getUrl(key)
    const response = await fetch(fileUrl)

    if (!response.ok) {
        throw new Error(`Failed to fetch persona knowledge document: ${key}`)
    }

    return await response.text()
}

const resolvePersonaSnapshotForRequest = async (
    ctx: ActionCtx,
    userId: string,
    selection?: PersonaSelection
): Promise<CompiledPersonaSnapshot | null | ChatError> => {
    if (!selection || selection.source === "default") {
        return null
    }

    if (selection.source === "builtin") {
        const persona = getBuiltInPersonaDefinition(selection.id ?? "")
        if (!persona) {
            return new ChatError("bad_request:chat", "Persona not found.")
        }

        return compilePersonaSnapshot({
            source: "builtin",
            sourceId: persona.id,
            name: persona.name,
            shortName: persona.shortName,
            description: persona.description,
            instructions: persona.instructions,
            defaultModelId: persona.defaultModelId,
            conversationStarters: persona.conversationStarters,
            avatarKind: "builtin",
            avatarValue: persona.avatarPath,
            knowledgeDocs: persona.knowledgeDocs.map((doc) => ({
                fileName: doc.fileName,
                content: doc.content
            }))
        })
    }

    if (!selection.id) {
        return new ChatError("bad_request:chat", "Persona not found.")
    }

    const persona = await ctx.runQuery(internal.personas.getUserPersonaByIdInternal, {
        personaId: selection.id as Id<"userPersonas">
    })

    if (!persona || persona.authorId !== userId) {
        return new ChatError("forbidden:chat", "Persona not found.")
    }

    const knowledgeDocs = await Promise.all(
        persona.knowledgeDocs.map(async (doc: { key: string; fileName: string }) => ({
            fileName: doc.fileName,
            content: await fetchPersonaDocumentText(doc.key)
        }))
    )

    return compilePersonaSnapshot({
        source: "user",
        sourceId: String(persona._id),
        name: persona.name,
        shortName: persona.shortName || persona.name.slice(0, 10),
        description: persona.description,
        instructions: persona.instructions,
        defaultModelId: persona.defaultModelId,
        conversationStarters: persona.conversationStarters,
        avatarKind: persona.avatarKey ? "r2" : undefined,
        avatarValue: persona.avatarKey,
        avatarMimeType: persona.avatarMimeType,
        knowledgeDocs
    })
}

type StoredMessage = Infer<typeof Message>

const extractReferenceKey = (value: string): string | null => {
    if (getReferenceSourceForKey(value)) return value
    if (value.startsWith("data:")) return null

    try {
        const parsed = new URL(value)
        const queryKey = parsed.searchParams.get("key")
        if (queryKey && getReferenceSourceForKey(queryKey)) return queryKey

        const decodedPath = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""))
        for (const prefix of ["attachments/", "generations/", "references/"]) {
            const prefixIndex = decodedPath.indexOf(prefix)
            if (prefixIndex !== -1) return decodedPath.slice(prefixIndex)
        }
    } catch {
        return null
    }

    return null
}

const getFileLabelFromKey = (key: string, fallback: string) => {
    const lastSegment = key.split("/").pop()?.trim()
    if (!lastSegment) return fallback
    const withoutPrefix = lastSegment.replace(/^\d+-[0-9a-f-]+-/i, "")
    return withoutPrefix || fallback
}

export const buildPreparedImageReferences = (
    messages: StoredMessage[]
): PreparedImageReference[] => {
    const references: PreparedImageReference[] = []
    const seenKeys = new Set<string>()
    let assistantMessageIndex = 0

    const addReference = (reference: Omit<PreparedImageReference, "id">) => {
        if (seenKeys.has(reference.key)) return
        seenKeys.add(reference.key)
        references.push({
            ...reference,
            id: `image_ref_${references.length + 1}`
        })
    }

    for (const message of sortMessagesChronologically(messages)) {
        if (message.role === "assistant") assistantMessageIndex++

        for (const part of message.parts ?? []) {
            if (part.type === "file" && part.mimeType?.startsWith("image/")) {
                const key = extractReferenceKey(part.data)
                if (!key) continue
                const source = getReferenceSourceForKey(key)
                if (!source) continue
                addReference({
                    key,
                    source,
                    label: part.filename ?? getFileLabelFromKey(key, "Attached image"),
                    mimeType: part.mimeType
                })
                continue
            }

            if (
                part.type !== "tool-invocation" ||
                part.toolInvocation.toolName !== PREPARE_IMAGE_GENERATION_TOOL_NAME ||
                part.toolInvocation.state !== "result" ||
                typeof part.toolInvocation.result !== "object" ||
                part.toolInvocation.result === null
            ) {
                continue
            }

            const result = part.toolInvocation.result as {
                assets?: Array<{
                    storageKey?: string
                    imageUrl?: string
                    generatedImageId?: Id<"generatedImages">
                    variantIndex?: number
                }>
                prompt?: string
                modelName?: string
                aspectRatio?: string
                resolution?: string
                variants?: number
            }
            const modelLabel = result.modelName ? `, ${result.modelName}` : ""
            const sizeLabel =
                result.aspectRatio || result.resolution
                    ? `, ${[result.aspectRatio, result.resolution].filter(Boolean).join(" ")}`
                    : ""
            const assets = result.assets ?? []
            const variantCount = Math.max(result.variants ?? 1, assets.length, 1)

            for (const [assetIndex, asset] of assets.entries()) {
                const key = extractReferenceKey(asset.storageKey ?? asset.imageUrl ?? "")
                if (!key) continue
                const source = getReferenceSourceForKey(key)
                if (!source) continue
                const displayIndex = asset.variantIndex ?? assetIndex + 1
                const variantLabel =
                    variantCount > 1
                        ? `variant ${displayIndex} of ${variantCount}`
                        : `image ${displayIndex}`
                addReference({
                    key,
                    source,
                    generatedImageId: asset.generatedImageId,
                    label: `SilkScreen generation from assistant message ${assistantMessageIndex}, ${variantLabel}${modelLabel}${sizeLabel}`,
                    mimeType: "image/png"
                })
            }
        }
    }

    return references
}

type ContextRoutingMetadata = {
    mode: "byok_fallback"
    reason: "message" | "thread"
    limitType: "hosted"
    estimatedTokens: number
    limitTokens: number
}

const sortMessagesChronologically = (messages: StoredMessage[]) =>
    [...messages].sort((left, right) => {
        const createdDiff = left.createdAt - right.createdAt
        if (createdDiff !== 0) return createdDiff
        return left.messageId.localeCompare(right.messageId)
    })

const toPendingUserMessage = ({
    threadId,
    message
}: {
    threadId?: string
    message: Infer<typeof HTTPAIMessage>
}): StoredMessage => {
    const timestamp = Date.now()
    return {
        threadId: (threadId ?? "pending-thread") as Id<"threads">,
        messageId: message.messageId ?? "pending-user-message",
        role: message.role,
        parts: message.parts,
        createdAt: timestamp,
        updatedAt: timestamp,
        metadata: {}
    }
}

const buildProspectiveMessages = ({
    existingMessages,
    threadId,
    userMessage,
    targetFromMessageId,
    targetMode
}: {
    existingMessages: StoredMessage[]
    threadId?: string
    userMessage: Infer<typeof HTTPAIMessage>
    targetFromMessageId?: string
    targetMode?: "normal" | "edit" | "retry"
}) => {
    const pendingUserMessage = toPendingUserMessage({
        threadId,
        message: userMessage
    })

    if (!targetFromMessageId) {
        return [pendingUserMessage, ...existingMessages]
    }

    const chronologicalMessages = sortMessagesChronologically(existingMessages)
    const targetMessageIndex = chronologicalMessages.findIndex(
        (message) => message.messageId === targetFromMessageId
    )

    if (targetMessageIndex === -1) {
        return existingMessages
    }

    const keptMessages = chronologicalMessages.slice(0, targetMessageIndex + 1)
    if (targetMode === "edit") {
        const targetMessage = keptMessages[targetMessageIndex]
        keptMessages[targetMessageIndex] = {
            ...targetMessage,
            parts: userMessage.parts,
            updatedAt: Date.now()
        }
    }

    return keptMessages.reverse()
}

const getContextLimitErrorMessage = (violation: ContextLimitViolation) =>
    violation.limitType === "hosted"
        ? "This thread is too long. Edit your message, start a new chat, or switch to BYOK."
        : "This thread is too long for the selected model. Edit your message, start a new chat, or pick a model that supports longer chats."

const SHARED_MODELS_BY_ID = new Map(MODELS_SHARED.map((model) => [model.id, model]))

const getContextLimitErrorPart = (
    violation: ContextLimitViolation,
    suggestedModels: SuggestedModel[]
): Infer<typeof ErrorUIPart> => ({
    type: "error",
    error: {
        code: "context_limit_exceeded",
        message: getContextLimitErrorMessage(violation),
        detail: {
            kind: "context_limit_exceeded",
            limitType: violation.limitType,
            estimatedTokens: violation.estimatedTokens,
            limitTokens: violation.limitTokens,
            modelId: violation.modelId,
            canUseByok: violation.canUseByok,
            ...(suggestedModels.length > 0 ? { suggestedModels } : {})
        }
    }
})

/**
 * Pick cheaper/larger models that would accept this thread, joining the
 * (metadata-overlaid) per-user registry with static fields the registry omits
 * (developer/releaseOrder/legacy). Returns [] on any failure — suggestions are
 * a nicety, never a reason to fail the rejection response.
 */
const resolveSuggestedModels = async (
    ctx: ActionCtx,
    {
        userId,
        currentModelId,
        registryModels,
        estimatedTokens
    }: {
        userId: string
        currentModelId: string
        registryModels: Record<string, SharedModel & { customProviderId?: string }>
        estimatedTokens: number
    }
): Promise<SuggestedModel[]> => {
    try {
        const userPlan = await ctx.runQuery(internal.credits.getUserCreditPlanInternal, { userId })
        const currentModel = registryModels[currentModelId]
        return computeSuggestedModels({
            currentModelId,
            currentModelAbilities: currentModel?.abilities ?? [],
            currentModelDeveloper: SHARED_MODELS_BY_ID.get(currentModelId)?.developer,
            estimatedTokens,
            userPlan,
            candidates: Object.values(registryModels).map((model) => {
                const shared = SHARED_MODELS_BY_ID.get(model.id)
                return {
                    id: model.id,
                    name: model.name,
                    abilities: model.abilities ?? [],
                    mode: model.mode,
                    runnable: (model.adapters?.length ?? 0) > 0,
                    requiredPlan: model.availableToPickFor ?? "pro",
                    contextLength: model.contextLength,
                    maxTokens: model.maxTokens,
                    inputUsdPer1MTokens: model.inputUsdPer1MTokens,
                    outputUsdPer1MTokens: model.outputUsdPer1MTokens,
                    hostedContextLength: model.hostedContextLength,
                    prototypeCreditTier: model.prototypeCreditTier,
                    developer: shared?.developer,
                    releaseOrder: shared?.releaseOrder,
                    legacy: shared?.legacy
                }
            })
        })
    } catch (error) {
        console.error("[cvx][chat][context-limit] Failed to resolve suggested models:", error)
        return []
    }
}

export const chatPOST = httpAction(async (ctx, req) => {
    type ChatRequestBody = {
        id?: string
        message: Infer<typeof HTTPAIMessage>
        model: string
        proposedNewAssistantId: string
        enabledTools: AbilityId[]
        targetFromMessageId?: string
        targetMode?: "normal" | "edit" | "retry"
        mcpOverrides?: Record<string, boolean>
        folderId?: Id<"projects">
        reasoningEffort?: ReasoningEffort
        personaSelection?: PersonaSelection
        clientId?: string
        devContextOverride?: { hostedInputLimit?: number; modelInputLimit?: number }
    }

    let body: ChatRequestBody
    try {
        const rawBody = await req.text()
        if (!rawBody.trim()) {
            console.error("[cvx][chat] Empty request body", {
                contentLength: req.headers.get("content-length")
            })
            return new ChatError("bad_request:chat").toResponse()
        }

        body = JSON.parse(rawBody) as ChatRequestBody
    } catch (error) {
        console.error("[cvx][chat] Invalid request body", error)
        return new ChatError("bad_request:chat").toResponse()
    }

    if (!body.message || !body.model || !body.proposedNewAssistantId) {
        return new ChatError("bad_request:chat").toResponse()
    }

    if (body.targetFromMessageId && !body.id) {
        return new ChatError("bad_request:chat").toResponse()
    }

    const user = await getUserIdentity(ctx.auth, { allowAnons: true })
    if ("error" in user) return new ChatError("unauthorized:chat").toResponse()

    const deletionBlocker = await getAccountDeletionBlockerForAction(ctx, user.id)
    if (deletionBlocker) {
        return new ChatError(
            "forbidden:chat",
            "Account deletion is in progress. New messages are disabled for this account."
        ).toResponse()
    }

    if (
        MODELS_SHARED.some(
            (sharedModel) => sharedModel.id === body.model && sharedModel.mode === "image"
        )
    ) {
        return new ChatError(
            "bad_model:api",
            "Image models are not available through chat. Use the image library generator."
        ).toResponse()
    }

    let modelData = await getModel(ctx, body.model, {
        reasoningEffort: body.reasoningEffort
    })
    if (modelData instanceof ChatError) return modelData.toResponse()
    let { model, modelName } = modelData
    let displayProvider = resolveDisplayProvider(body.model, modelData.runtimeProvider)
    const configuredMaxTokens = modelData.registry.models[body.model]?.maxTokens
    const selectedRegistryModel = modelData.registry.models[body.model]
    const allowedReasoningEfforts = getSharedAllowedReasoningEffortsForModel(selectedRegistryModel)
    const supportsReasoningToggle = allowedReasoningEfforts.includes("off")
    const supportsReasoning = allowedReasoningEfforts.length > 0
    const supportsEffortControl =
        modelData.abilities.includes("effort_control") &&
        (!OPENROUTER_ONLY_REASONING_CONTROL_MODEL_IDS.has(body.model) ||
            modelData.runtimeProvider === "openrouter")
    let maxTokens =
        typeof configuredMaxTokens === "number" && configuredMaxTokens > 0
            ? configuredMaxTokens
            : 16096
    // Dev-only, request-scoped context-limit override. Ignored entirely in production —
    // the env flag is unset there, so a crafted body field is a no-op.
    const devContextOverride =
        process.env.DEV_CREDIT_LAB_ENABLED === "1" ? body.devContextOverride : undefined
    const contextLimits = resolveContextLimits(selectedRegistryModel, devContextOverride)
    const immediateEstimatedTokens = estimateHttpMessageTokens(body.message)
    let estimatedPromptTokens = immediateEstimatedTokens
    const immediateContextViolation = getContextLimitViolation({
        estimatedTokens: immediateEstimatedTokens,
        limits: contextLimits,
        providerSource: modelData.providerSource,
        modelId: body.model
    })
    const effectiveReasoningEffort = resolveEffectiveReasoningEffort(
        body.model,
        selectedRegistryModel,
        body.reasoningEffort,
        supportsEffortControl
    )
    const requiredPlanForModel = resolveRequiredPlanForModelAccess({
        reasoningEffort: effectiveReasoningEffort,
        availableToPickFor: modelData.availableToPickFor,
        availableToPickForReasoningEfforts: modelData.availableToPickForReasoningEfforts
    })

    let modelCreditCharge = resolvePrototypeCreditCharge({
        providerSource: modelData.providerSource,
        modelMode: model.modelType,
        enabledTools: body.enabledTools,
        reasoningEffort: effectiveReasoningEffort,
        prototypeCreditTier: modelData.prototypeCreditTier,
        prototypeCreditTierWithReasoning: modelData.prototypeCreditTierWithReasoning
    })

    const personaSnapshot = !body.id
        ? await resolvePersonaSnapshotForRequest(ctx, user.id, body.personaSelection)
        : null

    if (personaSnapshot instanceof ChatError) {
        return personaSnapshot.toResponse()
    }

    const assistantRequestMessageId = body.proposedNewAssistantId
    const modelCreditMessageKey = `${assistantRequestMessageId}:model`
    const toolBudgetMessageKey = `${assistantRequestMessageId}:tool-budget`
    const toolCallMessageKeyPrefix = `${assistantRequestMessageId}:tool`
    const settings = await ctx.runQuery(internal.settings.getUserSettingsInternal, {
        userId: user.id
    })
    const filteredSettings = {
        ...settings,
        mcpServers: settings.mcpServers?.filter((server: { name: string; enabled?: boolean }) => {
            if (server.enabled === false) return false
            const overrideValue = body.mcpOverrides?.[server.name]
            return overrideValue !== false
        })
    }
    const requestedEnabledTools = Array.from(new Set(body.enabledTools))
    if ((filteredSettings.mcpServers ?? []).length > 0) {
        requestedEnabledTools.push("mcp")
    }
    const toolAvailability = resolveToolAvailability(filteredSettings)
    const resolvedEnabledTools = sanitizeEnabledTools(requestedEnabledTools, toolAvailability)
    const getToolFundingSource = (toolName: string): ToolFundingSource => {
        if (toolName === "web_search") return toolAvailability.web_search.fundingSource
        return "byok"
    }
    const hasPaidCallableTools =
        modelData.abilities.includes("function_calling") && resolvedEnabledTools.length > 0
    const hasInternalImagePreparationTool =
        modelData.abilities.includes("function_calling") && modelData.abilities.includes("vision")
    const hasCallableTools = hasPaidCallableTools || hasInternalImagePreparationTool
    const effectiveToolCallLimitPerTurn = clampToolCallLimitPerTurn(settings.toolCallLimitPerTurn, {
        hasEnabledTools: hasPaidCallableTools
    })
    const reservedToolMicrousd =
        hasPaidCallableTools &&
        resolvedEnabledTools.includes("web_search") &&
        toolAvailability.web_search.fundingSource === "deployment"
            ? effectiveToolCallLimitPerTurn * getConfiguredToolUsageMicrousd("web_search")
            : 0
    const resolveGeneratedImageContext = (storageKey: string) =>
        ctx.runAction(
            internal.lib.image_generation.context_images_node.resolveGeneratedImageContext,
            {
                userId: user.id,
                storageKey,
                publicAssetBaseUrl: process.env.R2_PUBLIC_BASE_URL
            }
        )

    let contextViolation = immediateContextViolation
    let contextViolationReason: "message" | "thread" | undefined =
        immediateContextViolation?.limitType === "hosted" ? "message" : undefined
    if (!contextViolation || contextViolation.limitType === "hosted") {
        try {
            const persistedPersonaSnapshot =
                personaSnapshot ??
                (body.id
                    ? await ctx.runQuery(internal.personas.getThreadPersonaSnapshotInternal, {
                          threadId: body.id as Id<"threads">
                      })
                    : null)
            const existingMessages = body.id
                ? await ctx.runQuery(internal.messages.getMessagesByThreadId, {
                      threadId: body.id as Id<"threads">
                  })
                : []
            const prospectiveMessages = buildProspectiveMessages({
                existingMessages,
                threadId: body.id,
                userMessage: body.message,
                targetFromMessageId: body.targetFromMessageId,
                targetMode: body.targetMode
            })
            const prospectiveMappedMessages = await dbMessagesToCore(
                prospectiveMessages,
                modelData.abilities,
                {
                    publicAssetBaseUrl: process.env.R2_PUBLIC_BASE_URL,
                    resolveGeneratedImageContextUrl: resolveGeneratedImageContext
                }
            )
            const promptMessages: ModelMessage[] = [
                {
                    role: "system",
                    content: buildPrompt({
                        enabledTools: resolvedEnabledTools,
                        toolCallLimitPerTurn: effectiveToolCallLimitPerTurn,
                        userSettings: settings,
                        personaPrompt: persistedPersonaSnapshot?.compiledPrompt,
                        includeTemporalContext: false
                    })
                },
                ...prospectiveMappedMessages,
                {
                    role: "system",
                    content: buildTemporalContext()
                }
            ]

            estimatedPromptTokens = estimateModelMessagesTokens(promptMessages)
            const prospectiveContextViolation = getContextLimitViolation({
                estimatedTokens: estimatedPromptTokens,
                limits: contextLimits,
                providerSource: modelData.providerSource,
                modelId: body.model
            })
            contextViolation = prospectiveContextViolation
            contextViolationReason =
                prospectiveContextViolation?.limitType === "hosted"
                    ? (contextViolationReason ?? "thread")
                    : undefined
        } catch (error) {
            console.error("[cvx][chat] Failed to estimate request context", error)
            return new ChatError("bad_request:chat").toResponse()
        }
    }

    let contextRouting: ContextRoutingMetadata | undefined
    if (contextViolation?.limitType === "hosted") {
        const fallbackModelData = await getModel(ctx, body.model, {
            reasoningEffort: body.reasoningEffort,
            openRouterByokOnly: true
        })

        if (!(fallbackModelData instanceof ChatError)) {
            const fallbackViolation = getContextLimitViolation({
                estimatedTokens: contextViolation.estimatedTokens,
                limits: contextLimits,
                providerSource: fallbackModelData.providerSource,
                modelId: body.model
            })

            if (!fallbackViolation) {
                modelData = fallbackModelData
                model = modelData.model
                modelName = modelData.modelName
                displayProvider = resolveDisplayProvider(body.model, modelData.runtimeProvider)
                maxTokens =
                    typeof modelData.registry.models[body.model]?.maxTokens === "number" &&
                    modelData.registry.models[body.model]?.maxTokens > 0
                        ? modelData.registry.models[body.model].maxTokens
                        : 16096
                modelCreditCharge = resolvePrototypeCreditCharge({
                    providerSource: modelData.providerSource,
                    modelMode: model.modelType,
                    enabledTools: body.enabledTools,
                    reasoningEffort: effectiveReasoningEffort,
                    prototypeCreditTier: modelData.prototypeCreditTier,
                    prototypeCreditTierWithReasoning: modelData.prototypeCreditTierWithReasoning
                })
                contextRouting = {
                    mode: "byok_fallback",
                    reason: contextViolationReason ?? "thread",
                    limitType: "hosted",
                    estimatedTokens: contextViolation.estimatedTokens,
                    limitTokens: contextViolation.limitTokens
                }
                contextViolation = null
            }
        }
    }

    const createMutationResult = async () => {
        try {
            return await ctx.runMutation(internal.threads.createThreadOrInsertMessages, {
                threadId: body.id as Id<"threads">,
                authorId: user.id,
                userMessage: "message" in body ? body.message : undefined,
                proposedNewAssistantId: body.proposedNewAssistantId,
                targetFromMessageId: body.targetFromMessageId,
                targetMode: body.targetMode,
                folderId: body.folderId,
                personaSnapshot: personaSnapshot ?? undefined
            })
        } catch (error) {
            console.error("[cvx][chat] Failed to create or append messages", error)
            return new ChatError("bad_request:chat")
        }
    }

    if (contextViolation) {
        const mutationResult = await createMutationResult()
        if (mutationResult instanceof ChatError) {
            return mutationResult.toResponse()
        }
        if (!mutationResult) {
            return new ChatError("bad_request:chat").toResponse()
        }

        const suggestedModels = await resolveSuggestedModels(ctx, {
            userId: user.id,
            currentModelId: body.model,
            registryModels: modelData.registry.models,
            estimatedTokens: contextViolation.estimatedTokens
        })
        const errorPart = getContextLimitErrorPart(contextViolation, suggestedModels)
        await ctx.runMutation(internal.messages.patchMessage, {
            threadId: mutationResult.threadId,
            messageId: mutationResult.assistantMessageId,
            parts: [errorPart],
            metadata: {
                modelId: body.model,
                modelName,
                displayProvider,
                runtimeProvider: modelData.runtimeProvider,
                reasoningEffort: effectiveReasoningEffort,
                creditProviderSource: modelData.providerSource,
                creditBucket: "none",
                creditFeature: model.modelType === "image" ? "image" : "chat",
                creditUnits: 0,
                creditCounted: false
            }
        })

        const stream = createUIMessageStream({
            execute: ({ writer }) => {
                const textId = `${mutationResult.assistantMessageId}:context-limit`
                writer.write({
                    type: "text-start",
                    id: textId
                })
                writer.write({
                    type: "text-delta",
                    id: textId,
                    delta: errorPart.error.message
                })
                writer.write({
                    type: "text-end",
                    id: textId
                })
                writer.write({
                    type: "finish",
                    finishReason: "error",
                    messageMetadata: {
                        threadId: mutationResult.threadId,
                        modelId: body.model,
                        modelName,
                        displayProvider,
                        runtimeProvider: modelData.runtimeProvider,
                        reasoningEffort: effectiveReasoningEffort,
                        creditProviderSource: modelData.providerSource,
                        creditBucket: "none",
                        creditFeature: model.modelType === "image" ? "image" : "chat",
                        creditUnits: 0,
                        creditCounted: false,
                        contextLimit: contextViolation
                    }
                })
            },
            onError: (error) => {
                console.error("[cvx][chat][context-limit] Failed to stream rejection:", error)
                return "Context limit reached"
            }
        })

        return new Response(
            stream.pipeThrough(new JsonToSseTransformStream()).pipeThrough(new TextEncoderStream()),
            {
                headers: UI_MESSAGE_STREAM_HEADERS
            }
        )
    }

    const getUsageReservationMicrousd = () =>
        modelData.providerSource === "internal"
            ? estimateOpenRouterReservationMicrousd({
                  estimatedInputTokens: estimatedPromptTokens,
                  maxOutputTokens: maxTokens,
                  inputUsdPer1MTokens: selectedRegistryModel?.inputUsdPer1MTokens,
                  outputUsdPer1MTokens: selectedRegistryModel?.outputUsdPer1MTokens
              })
            : undefined

    let creditReservation = await ctx.runMutation(internal.credits.reserveCreditForMessage, {
        userId: user.id,
        threadId: body.id as Id<"threads"> | undefined,
        messageId: assistantRequestMessageId,
        messageKey: modelCreditMessageKey,
        modelId: body.model,
        providerSource: modelData.providerSource,
        feature: modelCreditCharge.feature,
        bucket: modelCreditCharge.bucket,
        units: modelCreditCharge.units,
        counted: modelCreditCharge.counted,
        ...(getUsageReservationMicrousd() !== undefined
            ? {
                  reservedMicrousd: getUsageReservationMicrousd(),
                  pricingSource: "openrouter_estimate" as const
              }
            : {}),
        requiredPlan: requiredPlanForModel
    })

    if (!creditReservation.allowed) {
        if (creditReservation.reason === "plan") {
            return new ChatError("forbidden:chat", "Pro plan required for the selected model.", {
                kind: "plan_required",
                requiredPlan: creditReservation.requiredPlan ?? "pro",
                currentPlan: creditReservation.plan,
                feature: modelCreditCharge.feature
            }).toResponse()
        }

        if (modelData.providerSource === "internal") {
            const fallbackModelData = await getModel(ctx, body.model, {
                reasoningEffort: body.reasoningEffort,
                openRouterByokOnly: true
            })

            if (fallbackModelData && !(fallbackModelData instanceof ChatError)) {
                const fallbackViolation = getContextLimitViolation({
                    estimatedTokens: immediateEstimatedTokens,
                    limits: contextLimits,
                    providerSource: fallbackModelData.providerSource,
                    modelId: body.model
                })

                if (!fallbackViolation) {
                    modelData = fallbackModelData
                    model = modelData.model
                    modelName = modelData.modelName
                    displayProvider = resolveDisplayProvider(body.model, modelData.runtimeProvider)
                    maxTokens =
                        typeof modelData.registry.models[body.model]?.maxTokens === "number" &&
                        modelData.registry.models[body.model]?.maxTokens > 0
                            ? modelData.registry.models[body.model].maxTokens
                            : 16096
                    modelCreditCharge = resolvePrototypeCreditCharge({
                        providerSource: modelData.providerSource,
                        modelMode: model.modelType,
                        enabledTools: body.enabledTools,
                        reasoningEffort: effectiveReasoningEffort,
                        prototypeCreditTier: modelData.prototypeCreditTier,
                        prototypeCreditTierWithReasoning: modelData.prototypeCreditTierWithReasoning
                    })
                    creditReservation = await ctx.runMutation(
                        internal.credits.reserveCreditForMessage,
                        {
                            userId: user.id,
                            threadId: body.id as Id<"threads"> | undefined,
                            messageId: assistantRequestMessageId,
                            messageKey: modelCreditMessageKey,
                            modelId: body.model,
                            providerSource: modelData.providerSource,
                            feature: modelCreditCharge.feature,
                            bucket: modelCreditCharge.bucket,
                            units: modelCreditCharge.units,
                            counted: modelCreditCharge.counted,
                            ...(getUsageReservationMicrousd() !== undefined
                                ? {
                                      reservedMicrousd: getUsageReservationMicrousd(),
                                      pricingSource: "openrouter_estimate" as const
                                  }
                                : {}),
                            requiredPlan: requiredPlanForModel
                        }
                    )
                }
            }
        }

        if (!creditReservation.allowed) {
            if (creditReservation.reason === "usage") {
                return new ChatError(
                    "rate_limit:chat",
                    "Included usage limit reached for the selected request.",
                    {
                        kind: "usage_limit_exceeded",
                        window: creditReservation.window,
                        usedUsd: creditReservation.usedUsd,
                        limitUsd: creditReservation.limitUsd,
                        remainingUsd: creditReservation.remainingUsd,
                        recoversAt: creditReservation.recoversAt ?? undefined
                    }
                ).toResponse()
            }
            return new ChatError(
                "rate_limit:chat",
                "Monthly plan limit reached for the selected request.",
                {
                    kind: "credits_exhausted",
                    bucket: creditReservation.bucket,
                    used: creditReservation.used,
                    limit: creditReservation.limit,
                    remaining: creditReservation.remaining
                }
            ).toResponse()
        }
    }

    let toolBudgetReservation: {
        allowed: boolean
        bypassed?: boolean
        existing?: boolean
        reservedCalls?: number
        reason?: "usage"
        window?: "five_hour" | "monthly"
        usedUsd?: number
        limitUsd?: number
        remainingUsd?: number
        recoversAt?: number | null
    } | null = null
    if (hasPaidCallableTools && effectiveToolCallLimitPerTurn > 0) {
        try {
            toolBudgetReservation = await ctx.runMutation(internal.credits.reserveToolCallBudget, {
                userId: user.id,
                threadId: body.id as Id<"threads"> | undefined,
                messageId: assistantRequestMessageId,
                messageKey: toolBudgetMessageKey,
                reservedCalls: effectiveToolCallLimitPerTurn,
                reservedMicrousd: reservedToolMicrousd
            })
        } catch (error) {
            console.error("[cvx][chat] Failed to reserve tool budget", error)
            await ctx
                .runMutation(internal.credits.releaseReservedCreditForMessage, {
                    userId: user.id,
                    messageKey: modelCreditMessageKey
                })
                .catch((releaseError) =>
                    console.error(
                        "Failed to release model reservation after tool budget error:",
                        releaseError
                    )
                )
            return new ChatError("bad_request:chat").toResponse()
        }
    }

    if (toolBudgetReservation && !toolBudgetReservation.allowed) {
        await ctx.runMutation(internal.credits.releaseReservedCreditForMessage, {
            userId: user.id,
            messageKey: modelCreditMessageKey
        })
        return new ChatError(
            "rate_limit:chat",
            "Included usage limit reached for the selected request.",
            {
                kind: "usage_limit_exceeded",
                window: toolBudgetReservation.window ?? "five_hour",
                usedUsd: toolBudgetReservation.usedUsd,
                limitUsd: toolBudgetReservation.limitUsd,
                remainingUsd: toolBudgetReservation.remainingUsd,
                recoversAt: toolBudgetReservation.recoversAt ?? undefined
            }
        ).toResponse()
    }

    const releaseSetupReservations = async () => {
        await Promise.allSettled([
            ctx.runMutation(internal.credits.releaseReservedCreditForMessage, {
                userId: user.id,
                messageKey: modelCreditMessageKey
            }),
            toolBudgetReservation
                ? ctx.runMutation(internal.credits.finalizeToolCallBudget, {
                      userId: user.id,
                      messageKey: toolBudgetMessageKey
                  })
                : Promise.resolve(null)
        ])
    }

    const mutationResult = await createMutationResult()

    if (mutationResult instanceof ChatError) {
        await releaseSetupReservations()
        return mutationResult.toResponse()
    }
    if (!mutationResult) {
        await releaseSetupReservations()
        return new ChatError("bad_request:chat").toResponse()
    }

    const promptToolCallLimitPerTurn =
        toolBudgetReservation?.bypassed === true ? undefined : effectiveToolCallLimitPerTurn
    const streamSetup = await (async () => {
        try {
            const persistedPersonaSnapshot =
                personaSnapshot ??
                (await ctx.runQuery(internal.personas.getThreadPersonaSnapshotInternal, {
                    threadId: mutationResult.threadId
                }))
            const dbMessages = await ctx.runQuery(internal.messages.getMessagesByThreadId, {
                threadId: mutationResult.threadId
            })
            const normalizedDbMessages = Array.isArray(dbMessages) ? dbMessages : []
            const imageReferences = buildPreparedImageReferences(normalizedDbMessages)
            const streamId = await ctx.runMutation(internal.streams.appendStreamId, {
                threadId: mutationResult.threadId,
                ...(body.clientId ? { ownerClientId: body.clientId } : {})
            })
            const mapped_messages = await dbMessagesToCore(
                normalizedDbMessages,
                modelData.abilities,
                {
                    publicAssetBaseUrl: process.env.R2_PUBLIC_BASE_URL,
                    resolveGeneratedImageContextUrl: resolveGeneratedImageContext
                }
            )

            return {
                persistedPersonaSnapshot,
                streamId,
                mapped_messages,
                imageReferences
            }
        } catch (error) {
            console.error("[cvx][chat] Failed to prepare stream context", error)
            return new ChatError("bad_request:chat")
        }
    })()

    if (streamSetup instanceof ChatError) {
        await releaseSetupReservations()
        return streamSetup.toResponse()
    }
    const { persistedPersonaSnapshot, streamId, mapped_messages, imageReferences } = streamSetup

    const streamStartTime = Date.now()

    // Deliberately not tied to req.signal: generation must survive the sending
    // client disconnecting so other clients can resume. Only an explicit stop
    // request (chatDELETE -> Redis STOPPED state) aborts it.
    const generationAbort = new AbortController()

    const parts: Array<
        | { type: "text"; text: string }
        | { type: "reasoning"; reasoning: string; duration?: number; details?: [] }
        | {
              type: "tool-invocation"
              toolInvocation: {
                  state: "call" | "result" | "partial-call"
                  args?: unknown
                  result?: unknown
                  toolCallId: string
                  toolName: string
              }
          }
        | { type: "file"; data: string; filename?: string; mimeType?: string }
        | Infer<typeof ErrorUIPart>
    > = []

    const uploadPromises: Promise<void>[] = []

    // Track token usage
    const totalTokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: undefined as number | undefined,
        estimatedPromptCostUsd: undefined as number | undefined,
        estimatedCompletionCostUsd: undefined as number | undefined
    }
    const streamMetrics: {
        firstVisibleAtMs?: number
    } = {}
    const getTimeToFirstVisibleMs = () =>
        streamMetrics.firstVisibleAtMs !== undefined
            ? Math.max(0, streamMetrics.firstVisibleAtMs - streamStartTime)
            : undefined
    let modelCreditCommitted = false
    let shouldChargeModelReservation = false
    const markFirstVisible = () => {
        if (streamMetrics.firstVisibleAtMs !== undefined) return
        streamMetrics.firstVisibleAtMs = Date.now()
    }
    const commitModelCreditReservation = async () => {
        const result = await ctx.runMutation(internal.credits.commitReservedCreditForMessage, {
            userId: user.id,
            messageKey: modelCreditMessageKey,
            threadId: mutationResult.threadId,
            messageId: mutationResult.assistantMessageId,
            ...(totalTokenUsage.estimatedCostUsd !== undefined
                ? {
                      settledMicrousd: usdToMicrousd(totalTokenUsage.estimatedCostUsd),
                      pricingSource: "openrouter_reported" as const
                  }
                : {})
        })
        modelCreditCommitted = modelCreditCommitted || result.committed
    }
    const settleModelCreditReservation = async () => {
        if (shouldChargeModelReservation || totalTokenUsage.estimatedCostUsd !== undefined) {
            try {
                await commitModelCreditReservation()
                return
            } catch (error) {
                console.error("Failed to commit model credit reservation:", error)
            }
        }

        if (modelCreditCommitted) {
            return
        }

        try {
            await ctx.runMutation(internal.credits.releaseReservedCreditForMessage, {
                userId: user.id,
                messageKey: modelCreditMessageKey
            })
        } catch (error) {
            console.error("Failed to release model credit reservation:", error)
        }
    }
    const finalizeToolBudgetReservation = async () => {
        if (!toolBudgetReservation) {
            return
        }

        try {
            await ctx.runMutation(internal.credits.finalizeToolCallBudget, {
                userId: user.id,
                messageKey: toolBudgetMessageKey
            })
        } catch (error) {
            console.error("Failed to finalize tool budget:", error)
        }
    }
    const cloneStreamParts = () =>
        (typeof structuredClone === "function"
            ? structuredClone(parts)
            : JSON.parse(JSON.stringify(parts))) as typeof parts
    let livePersistTimeout: ReturnType<typeof setTimeout> | null = null
    let livePersistInFlight: Promise<void> | null = null
    let livePersistQueued = false
    let lastLivePersistAt = 0
    let lastLivePersistSignature = ""

    const persistLiveAssistantMessage = async (force = false): Promise<void> => {
        if (parts.length === 0) return

        const now = Date.now()
        const throttleMs = 250
        const remainingThrottleMs = throttleMs - (now - lastLivePersistAt)

        if (!force && remainingThrottleMs > 0) {
            if (!livePersistTimeout) {
                livePersistTimeout = setTimeout(() => {
                    livePersistTimeout = null
                    void persistLiveAssistantMessage()
                }, remainingThrottleMs)
            }
            return
        }

        if (livePersistInFlight) {
            livePersistQueued = true
            return
        }

        const partsSnapshot = cloneStreamParts()
        const signature = JSON.stringify(partsSnapshot)

        if (signature === lastLivePersistSignature) {
            return
        }

        livePersistInFlight = ctx
            .runMutation(internal.messages.patchMessage, {
                threadId: mutationResult.threadId,
                messageId: mutationResult.assistantMessageId,
                parts: partsSnapshot,
                metadata: {
                    serverDurationMs: Date.now() - streamStartTime,
                    timeToFirstVisibleMs: getTimeToFirstVisibleMs()
                }
            })
            .then(() => {
                lastLivePersistSignature = signature
                lastLivePersistAt = Date.now()
            })
            .catch((error) => {
                console.error("[cvx][chat][stream] Failed to persist live assistant parts", {
                    threadId: mutationResult.threadId,
                    messageId: mutationResult.assistantMessageId,
                    error
                })
            })
            .finally(async () => {
                livePersistInFlight = null

                if (livePersistQueued) {
                    livePersistQueued = false
                    await persistLiveAssistantMessage(force)
                }
            })

        await livePersistInFlight
    }

    const scheduleLiveAssistantPersist = () => {
        void persistLiveAssistantMessage()
    }
    const forwardStreamToWriter = async (
        sourceStream: ReadableStream<unknown>,
        writer: { write: (chunk: unknown) => void | Promise<void> }
    ) => {
        const reader = sourceStream.getReader()

        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            await writer.write(value)
        }
    }

    const stream = createUIMessageStream({
        execute: async ({ writer }) => {
            await ctx.runMutation(internal.threads.updateThreadStreamingState, {
                threadId: mutationResult.threadId,
                isLive: true,
                streamStartedAt: streamStartTime,
                currentStreamId: streamId,
                ...(body.clientId ? { currentStreamOwnerClientId: body.clientId } : {})
            })

            let nameGenerationPromise: Promise<string | ChatError> | undefined
            if (!body.id) {
                nameGenerationPromise = generateThreadName(
                    ctx,
                    mutationResult.threadId,
                    mapped_messages,
                    user.id,
                    settings
                )
            }

            writer.write({
                type: "start",
                messageId: mutationResult.assistantMessageId,
                messageMetadata: {
                    threadId: mutationResult.threadId,
                    streamId,
                    modelId: body.model,
                    modelName,
                    displayProvider,
                    runtimeProvider: modelData.runtimeProvider,
                    creditProviderSource: modelData.providerSource,
                    reasoningEffort: effectiveReasoningEffort,
                    ...(contextRouting ? { contextRouting } : {})
                }
            })

            const usesOpenRouter = modelData.runtimeProvider === "openrouter"
            const paidTools = hasPaidCallableTools
                ? await getToolkit(ctx, resolvedEnabledTools, filteredSettings, {
                      consumeToolCall: async ({ toolName, toolCallId }) => {
                          const toolCreditCharge = resolvePrototypeToolCreditCharge({
                              fundingSource: getToolFundingSource(toolName)
                          })

                          return await ctx.runMutation(internal.credits.consumeReservedToolCall, {
                              userId: user.id,
                              threadId: mutationResult.threadId,
                              reservationMessageKey: toolBudgetMessageKey,
                              messageId: mutationResult.assistantMessageId,
                              messageKey: `${toolCallMessageKeyPrefix}:${toolCallId}`,
                              toolCallId,
                              toolName,
                              modelId: body.model,
                              providerSource: toolCreditCharge.providerSource,
                              feature: toolCreditCharge.feature,
                              bucket: toolCreditCharge.bucket,
                              units: toolCreditCharge.units,
                              counted: toolCreditCharge.counted,
                              ...(toolCreditCharge.counted
                                  ? { chargedMicrousd: getConfiguredToolUsageMicrousd(toolName) }
                                  : {})
                          })
                      }
                  })
                : {}
            const internalTools = getPrepareImageGenerationTool({
                enabled: hasInternalImagePreparationTool,
                references: imageReferences,
                defaults: settings.imageGenerationDefaults
            }) as Record<string, Tool>
            const availableImageSelectionLabels = hasInternalImagePreparationTool
                ? getSelectableImageModels().map((imageModel) => {
                      const aspectRatios = getSupportedAspectRatiosForImageModel(imageModel)
                      const resolutions = getSupportedResolutionsForImageModel(imageModel)
                      return [
                          `${imageModel.id} (${imageModel.name})`,
                          `aspect ratios: ${aspectRatios.join(", ") || "default"}`,
                          `resolutions: ${resolutions.join(", ") || "default"}`,
                          imageModel.supportsReferenceImages
                              ? `references: up to ${imageModel.maxReferenceImages ?? "the model limit"}`
                              : "references: none",
                          `max variants: ${getImageModelMaxPerMessage(imageModel)}`
                      ].join("; ")
                  })
                : []
            const tools: Record<string, Tool> = {
                ...paidTools,
                ...internalTools
            }
            const result = streamText({
                model: model,
                maxOutputTokens: maxTokens,
                stopWhen: stepCountIs(100),
                abortSignal: generationAbort.signal,
                experimental_transform: smoothStream(),
                tools: Object.keys(tools).length > 0 ? tools : undefined,
                messages: [
                    {
                        role: "system",
                        content: buildPrompt({
                            enabledTools: resolvedEnabledTools,
                            toolCallLimitPerTurn: promptToolCallLimitPerTurn,
                            userSettings: settings,
                            personaPrompt: persistedPersonaSnapshot?.compiledPrompt,
                            includeTemporalContext: false,
                            imageGenerationTool: hasInternalImagePreparationTool
                                ? {
                                      enabled: true,
                                      availableImageSelectionLabels,
                                      availableReferenceLabels: imageReferences.map(
                                          (reference) => `${reference.id}: ${reference.label}`
                                      )
                                  }
                                : undefined
                        })
                    },
                    ...mapped_messages,
                    {
                        role: "system",
                        content: buildTemporalContext()
                    }
                ],
                providerOptions: usesOpenRouter
                    ? {
                          openrouter: buildOpenRouterProviderOptions(
                              modelData.modelId,
                              effectiveReasoningEffort,
                              supportsEffortControl,
                              supportsReasoningToggle,
                              supportsReasoning,
                              String(mutationResult.threadId)
                          )
                      }
                    : undefined
            })

            const transformedStream = result.fullStream.pipeThrough(
                manualStreamTransform(
                    parts,
                    totalTokenUsage,
                    uploadPromises,
                    user.id,
                    ctx,
                    streamMetrics,
                    {
                        allowReasoning: effectiveReasoningEffort !== "off",
                        onPartsChanged: scheduleLiveAssistantPersist,
                        onFirstVisible: () => {
                            shouldChargeModelReservation = true
                        }
                    }
                )
            )

            await forwardStreamToWriter(transformedStream, writer)

            await Promise.allSettled(uploadPromises)

            writer.write({
                type: "finish",
                finishReason: await result.finishReason,
                messageMetadata: {
                    threadId: mutationResult.threadId,
                    streamId,
                    modelId: body.model,
                    modelName,
                    displayProvider,
                    runtimeProvider: modelData.runtimeProvider,
                    creditProviderSource: modelData.providerSource,
                    reasoningEffort: effectiveReasoningEffort,
                    promptTokens: totalTokenUsage.promptTokens,
                    completionTokens: totalTokenUsage.completionTokens,
                    reasoningTokens: totalTokenUsage.reasoningTokens,
                    totalTokens: totalTokenUsage.totalTokens,
                    estimatedCostUsd: totalTokenUsage.estimatedCostUsd,
                    estimatedPromptCostUsd: totalTokenUsage.estimatedPromptCostUsd,
                    estimatedCompletionCostUsd: totalTokenUsage.estimatedCompletionCostUsd,
                    serverDurationMs: Date.now() - streamStartTime,
                    timeToFirstVisibleMs: getTimeToFirstVisibleMs(),
                    ...(contextRouting ? { contextRouting } : {})
                }
            })
            console.log()

            if (livePersistTimeout) {
                clearTimeout(livePersistTimeout)
                livePersistTimeout = null
            }
            await persistLiveAssistantMessage(true)

            await ctx.runMutation(internal.messages.patchMessage, {
                threadId: mutationResult.threadId,
                messageId: mutationResult.assistantMessageId,
                parts:
                    parts.length > 0
                        ? parts
                        : [
                              {
                                  type: "error",
                                  error: {
                                      code: "no-response",
                                      message:
                                          "The model did not generate a response. Please try again."
                                  }
                              }
                          ],
                metadata: {
                    modelId: body.model,
                    modelName,
                    displayProvider,
                    runtimeProvider: modelData.runtimeProvider,
                    reasoningEffort: effectiveReasoningEffort,
                    promptTokens: totalTokenUsage.promptTokens,
                    completionTokens: totalTokenUsage.completionTokens,
                    reasoningTokens: totalTokenUsage.reasoningTokens,
                    totalTokens: totalTokenUsage.totalTokens,
                    estimatedCostUsd: totalTokenUsage.estimatedCostUsd,
                    estimatedPromptCostUsd: totalTokenUsage.estimatedPromptCostUsd,
                    estimatedCompletionCostUsd: totalTokenUsage.estimatedCompletionCostUsd,
                    creditProviderSource: modelData.providerSource,
                    creditBucket: modelCreditCharge.bucket,
                    creditFeature: modelCreditCharge.feature,
                    creditUnits: modelCreditCharge.units,
                    creditCounted: modelCreditCharge.counted,
                    serverDurationMs: Date.now() - streamStartTime,
                    timeToFirstVisibleMs: getTimeToFirstVisibleMs(),
                    ...(contextRouting ? { contextRouting } : {})
                }
            })

            await finalizeToolBudgetReservation()
            await settleModelCreditReservation()

            if (nameGenerationPromise) {
                try {
                    await nameGenerationPromise
                } catch (error) {
                    console.error("[cvx][chat][thread-name] Failed to generate thread name:", error)
                }
            }

            await ctx
                .runMutation(internal.threads.updateThreadStreamingState, {
                    threadId: mutationResult.threadId,
                    isLive: false,
                    currentStreamId: undefined
                })
                .catch((err) => console.error("Failed to update thread state:", err))
        },
        onError: (error) => {
            console.error("[cvx][chat][stream] Fatal error:", error)
            void settleModelCreditReservation()
            void finalizeToolBudgetReservation()
            // Mark thread as not live on error
            ctx.runMutation(internal.threads.updateThreadStreamingState, {
                threadId: mutationResult.threadId,
                isLive: false
            }).catch((err) => console.error("Failed to update thread state:", err))
            return "Stream error occurred"
        }
    })

    const streamContext = getResumableStreamContext()

    if (streamContext) {
        const sseStream = stream.pipeThrough(new JsonToSseTransformStream())
        const [clientStream, resumableStream] = sseStream.tee()

        try {
            await streamContext.createNewResumableStream(
                streamId,
                () =>
                    createSafeResumableSseStream({
                        stream: resumableStream,
                        threadId: mutationResult.threadId,
                        streamId
                    }),
                { onStop: () => generationAbort.abort("Stream stopped by user") }
            )
        } catch (error) {
            console.error("[cvx][chat][stream] Failed to register resumable stream", {
                threadId: mutationResult.threadId,
                streamId,
                error
            })
        }

        return new Response(clientStream.pipeThrough(new TextEncoderStream()), {
            headers: UI_MESSAGE_STREAM_HEADERS
        })
    }

    return new Response(
        stream.pipeThrough(new JsonToSseTransformStream()).pipeThrough(new TextEncoderStream()),
        {
            headers: UI_MESSAGE_STREAM_HEADERS
        }
    )
})
