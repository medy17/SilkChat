"use node"

import { ChatError } from "@/lib/errors"
import type { ReasoningEffort } from "@/lib/model-store"
import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModelV4 } from "@ai-sdk/provider"
import { internal } from "../_generated/api"
import type { ActionCtx } from "../_generated/server"
import { getUserIdentity } from "../lib/identity"
import { type CoreProvider, MODELS_SHARED } from "../lib/models"
import { createProvider } from "../lib/provider_factory"
import {
    applyModelRouting,
    getOpenRouterRouting,
    getRoutedOpenRouterModelId
} from "../lib/model_routing"
import type { UserRegistry } from "../settings"
import type { ModelRoutingMode } from "../schema/model_routing"

const getInternalOpenRouterApiKey = () => process.env.OPENROUTER_API_KEY?.trim()
const getRegistryProviderId = (adapter: string) => adapter.slice(0, adapter.indexOf(":"))
const getRegistryModelId = (adapter: string) => adapter.slice(adapter.indexOf(":") + 1)

const getOpenRouterModelId = (modelId: string) =>
    getRegistryModelId(
        MODELS_SHARED.find((entry) => entry.id === modelId)?.adapters.find((adapter) =>
            adapter.startsWith("openrouter:")
        ) ?? ""
    ) || undefined

export const getModel = async (
    ctx: ActionCtx,
    modelId: string,
    options?: {
        internalOnly?: boolean
        openRouterByokOnly?: boolean
        reasoningEffort?: ReasoningEffort
        registry?: UserRegistry
        modelRouting?: ModelRoutingMode
    }
) => {
    const user = await getUserIdentity(ctx.auth, { allowAnons: false })
    if ("error" in user) throw new ChatError("unauthorized:chat")

    const registry: UserRegistry =
        options?.registry ??
        (await ctx.runQuery(internal.settings.getUserRegistryInternal, {
            userId: user.id
        }))

    if (!(modelId in registry.models)) return new ChatError("bad_model:api")

    const registeredModel = registry.models[modelId]
    if (!registeredModel) return new ChatError("bad_model:api")
    const mode = options?.modelRouting ?? registry.settings?.modelRouting ?? "silkchat"
    const model = applyModelRouting(registeredModel, mode)
    if (model.routingUnavailableReason)
        return new ChatError("bad_model:api", model.routingUnavailableReason)
    const routing = getOpenRouterRouting(mode, model.preferredOpenRouterProviders)
    if (model.mode === "text-to-speech")
        return new ChatError("bad_model:api", "Speech models cannot generate chat responses")
    if (model.mode === "decision")
        return new ChatError("bad_model:api", "Decision models cannot generate chat responses")
    if (!model.adapters.length) return new ChatError("bad_model:api", "No adapters found for model")

    const hasInternalOpenRouter = Boolean(getInternalOpenRouterApiKey())
    const adaptersToConsider = options?.openRouterByokOnly
        ? model.adapters.filter((adapter) => adapter.startsWith("openrouter:"))
        : options?.internalOnly
          ? model.adapters.filter(
                (adapter) =>
                    adapter.startsWith("i3-") ||
                    (adapter.startsWith("openrouter:") && hasInternalOpenRouter)
            )
          : model.adapters

    if (!adaptersToConsider.length) {
        return new ChatError("bad_model:api", "No internal adapters found for model")
    }

    const openRouterUsageMode = registry.providers.openrouter?.usageMode ?? "fallback"
    const isCustomModel = Boolean(model.customProviderId)
    const sortedAdapters = adaptersToConsider.sort((a, b) => {
        const providerA = getRegistryProviderId(a)
        const providerB = getRegistryProviderId(b)

        const getPriority = (provider: string) => {
            if (isCustomModel) {
                if (provider === model.customProviderId) return 1
                if (provider === "openrouter") return 2
                return 3
            }

            if (provider === "openrouter") {
                return options?.openRouterByokOnly || openRouterUsageMode === "priority" ? 1 : 2
            }
            if (provider.startsWith("i3-")) return 2
            return 3
        }

        return getPriority(providerA) - getPriority(providerB)
    })

    console.log("[getModel] model", model, "sortedAdapters", sortedAdapters)
    let finalModel: LanguageModelV4 | undefined
    let providerSource: "internal" | "openrouter" | "custom" | "unknown" = "unknown"
    let runtimeProvider: CoreProvider | "openrouter" | "custom" | "unknown" = "unknown"

    for (const adapter of sortedAdapters) {
        const providerIdRaw = model.customProviderId ?? getRegistryProviderId(adapter)
        const providerSpecificModelId = model.customProviderId
            ? model.id
            : getRegistryModelId(adapter)

        if (providerIdRaw.startsWith("i3-")) {
            if (!hasInternalOpenRouter) continue

            const openRouterModelId = getOpenRouterModelId(model.id)
            if (!openRouterModelId) continue

            const openRouterProvider = await createProvider("openrouter", "internal")
            finalModel = openRouterProvider.chat(
                getRoutedOpenRouterModelId(openRouterModelId, mode),
                { provider: routing }
            )
            providerSource = "internal"
            runtimeProvider = "openrouter"
            break
        }

        if (providerIdRaw === "openrouter") {
            const provider = registry.providers.openrouter
            const shouldUseInternal =
                !isCustomModel && !provider && !options?.openRouterByokOnly && hasInternalOpenRouter

            if (!provider && !shouldUseInternal) {
                console.error("Provider openrouter not found")
                continue
            }

            const sdkProvider = await createProvider(
                "openrouter",
                shouldUseInternal ? "internal" : provider.key,
                {
                    modelId: providerSpecificModelId
                }
            )
            finalModel = sdkProvider.chat(
                getRoutedOpenRouterModelId(providerSpecificModelId, mode),
                { provider: routing }
            )
            providerSource = shouldUseInternal ? "internal" : "openrouter"
            runtimeProvider = "openrouter"
            break
        }

        if (!model.customProviderId) {
            console.error(`Provider ${providerIdRaw} is not supported for built-in models`)
            continue
        }

        const provider = registry.providers[providerIdRaw]
        if (!provider) {
            console.error(`Provider ${providerIdRaw} not found`)
            continue
        }

        if (!provider.endpoint) {
            console.error(`Provider ${providerIdRaw} does not have a valid endpoint`)
            continue
        }

        const sdkProvider = createOpenAI({
            baseURL: provider.endpoint,
            apiKey: provider.key,
            name: provider.name
        })
        finalModel =
            provider.apiMode === "responses"
                ? sdkProvider.responses(providerSpecificModelId)
                : sdkProvider.chat(providerSpecificModelId)
        providerSource = "custom"
        runtimeProvider = "custom"
        break
    }

    if (!finalModel) return new ChatError("bad_model:api")

    Object.assign(finalModel, {
        modelType: "text"
    })

    return {
        model: finalModel as LanguageModelV4 & { modelType: "text" },
        abilities: model.abilities,
        useStrictCharts: model.useStrictCharts,
        registry,
        modelId: model.id,
        modelName: model.name ?? model.id,
        providerSource,
        runtimeProvider,
        routing,
        runtimeApiKey: undefined,
        availableToPickFor: model.availableToPickFor,
        availableToPickForReasoningEfforts: model.availableToPickForReasoningEfforts
    }
}
