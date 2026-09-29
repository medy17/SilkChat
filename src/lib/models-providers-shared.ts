import {
    ClaudeIcon,
    FalAIIcon,
    GeminiIcon,
    GroqIcon,
    OpenAIIcon,
    OpenRouterIcon,
    ReasoningHighIcon,
    ReasoningLowIcon,
    ReasoningMediumIcon,
    VercelIcon,
    XAIIcon
} from "@/components/brand-icons"
import { normalizeModelAbilities } from "@/convex/lib/model_abilities"
import { applyModelRouting } from "@/convex/lib/model_routing"
import type { CoreProvider, SharedModel } from "@/convex/lib/models"
import { isModelSunset, resolveModelReplacement } from "@/convex/lib/models/lifecycle"
import {
    getCustomModelReasoningFields,
    getNearestReasoningEffort,
    getAllowedReasoningEffortsForModel as getSharedAllowedReasoningEffortsForModel,
    getDefaultReasoningEffortForModel as getSharedDefaultReasoningEffortForModel
} from "@/convex/lib/models/reasoning"
import type { CustomModelCatalogStatus } from "@/convex/lib/openrouter_catalog"
import type { GoogleAuthMode, ModelAbility, UserSettings } from "@/convex/schema/settings"
import { optionalBrowserEnv } from "@/lib/browser-env"
import type { ReasoningEffort } from "@/lib/model-store"
import { useSharedModels } from "@/lib/shared-models"
import type { Infer } from "convex/values"
import { Brain, Eye, File, Key, SquareTerminal, Zap } from "lucide-react"

export type DisplayModel =
    | SharedModel
    | {
          id: string
          name: string
          abilities: ModelAbility[]
          isCustom: true
          providerId: string
          // The provider's model ID and the user's description of it.
          modelId?: string
          description?: string
          mode?: "text" | "image"
          reasoningEfforts?: ReasoningEffort[]
          supportsDisablingReasoning?: boolean
          defaultReasoningEffort?: ReasoningEffort
          // From the synced OpenRouter catalog: a scheduled removal date, or why the model
          // can't be used any more (it's greyed out rather than hidden).
          expirationDate?: string
          unavailableReason?: string
      }

export type CustomModelsRecord = Infer<typeof UserSettings>["customModels"]
export type CustomModelCatalog = Record<string, CustomModelCatalogStatus>
// What the settings query returns: stored settings plus custom models' catalog standing.
export type HydratedUserSettings = Infer<typeof UserSettings> & {
    customModelCatalog?: CustomModelCatalog
}

type CustomDisplayModel = Extract<DisplayModel, { isCustom: true }>

// One place turns a stored custom model into what the picker and composer use, including
// its reasoning levels, so the server registry and the client never disagree.
export const toCustomDisplayModel = (
    id: string,
    customModel: CustomModelsRecord[string],
    catalogStatus?: CustomModelCatalogStatus
): CustomDisplayModel => {
    const abilities = normalizeModelAbilities(
        customModel.abilities as Parameters<typeof normalizeModelAbilities>[0]
    )
    const { effortControl, ...reasoning } = getCustomModelReasoningFields({
        ...customModel,
        abilities
    })

    return {
        id,
        name: customModel.name || customModel.modelId,
        abilities:
            effortControl && !abilities.includes("effort_control")
                ? [...abilities, "effort_control"]
                : abilities,
        isCustom: true,
        providerId: customModel.providerId,
        modelId: customModel.modelId,
        description: customModel.description?.trim() || undefined,
        ...reasoning,
        expirationDate: catalogStatus?.expirationDate,
        unavailableReason: catalogStatus?.unavailableReason
    }
}

// The reasoning helpers take a SharedModel; custom models carry the same reasoning fields,
// so they can stand in and get the composer's level picker too.
export const getReasoningSourceModel = (
    model: DisplayModel | null | undefined
): SharedModel | undefined => {
    if (!model) return undefined
    if (!("isCustom" in model && model.isCustom)) return model as SharedModel

    return {
        id: model.id,
        name: model.name,
        adapters: [],
        abilities: model.abilities,
        reasoningEfforts: model.reasoningEfforts,
        supportsDisablingReasoning: model.supportsDisablingReasoning,
        defaultReasoningEffort: model.defaultReasoningEffort
    } as unknown as SharedModel
}

// Why a listed model can't be picked: a routing mode it isn't served under, or, for custom
// models, being retired or unserved on OpenRouter.
export const getModelRoutingDisabledReason = (model: DisplayModel) => {
    if ("isCustom" in model && model.isCustom) return model.unavailableReason
    return "routingUnavailableReason" in model ? model.routingUnavailableReason : undefined
}

export type CoreProviderInfo = {
    id: CoreProvider | "openrouter"
    name: string
    description: string
    placeholder: string
    icon: React.ComponentType<{ className?: string }> | string
    hidden?: boolean
    authModes?: {
        value: GoogleAuthMode
        label: string
        placeholder: string
        description: string
    }[]
}

export const CORE_PROVIDERS: CoreProviderInfo[] = [
    {
        id: "openrouter",
        name: "OpenRouter",
        description: "Use your own key for built-in models",
        placeholder: "sk-or-...",
        icon: OpenRouterIcon
    },
    {
        id: "gateway",
        name: "AI Gateway",
        description: "Access vendor models through Vercel AI Gateway",
        placeholder: "vercel_ai_...",
        icon: VercelIcon
    },
    {
        id: "openai",
        name: "OpenAI",
        description: "Access GPT-4, GPT-4o, o3, and other OpenAI models",
        placeholder: "sk-...",
        icon: OpenAIIcon
    },
    {
        id: "anthropic",
        name: "Anthropic",
        description: "Access Claude Sonnet, Opus, and other Anthropic models",
        placeholder: "sk-ant-...",
        icon: ClaudeIcon
    },
    {
        id: "google",
        name: "Google",
        description: "Access Gemini models with either AI Studio keys or Vertex credentials",
        placeholder: "AIza...",
        icon: GeminiIcon,
        authModes: [
            {
                value: "ai-studio",
                label: "AI Studio",
                placeholder: "AIza...",
                description: "Use a Google AI Studio API key"
            },
            {
                value: "vertex",
                label: "Vertex AI",
                placeholder: '{"type":"service_account",...}',
                description: "Use a Google Cloud service account JSON key"
            }
        ]
    },
    {
        id: "xai",
        name: "xAI",
        description: "Access Grok models through xAI",
        placeholder: "xai-...",
        icon: XAIIcon
    },
    {
        id: "groq",
        name: "Groq",
        description: "Access Llama, Speech-to-text, and other models with ultra-fast inference",
        placeholder: "gsk_...",
        icon: GroqIcon,
        hidden: true
    },
    {
        id: "fal",
        name: "Fal AI",
        description: "Access open-souce image generation models",
        placeholder: "key_secret:key_id",
        icon: FalAIIcon,
        hidden: true
    }
]

const LEGACY_DIRECT_INFERENCE_PROVIDER_IDS = new Set<CoreProvider>([
    "openai",
    "anthropic",
    "google",
    "xai",
    "groq",
    "fal"
])

export const legacyDirectInferenceProvidersEnabled =
    optionalBrowserEnv("VITE_ENABLE_LEGACY_DIRECT_INFERENCE_PROVIDERS") === "true"

export const isLegacyDirectInferenceProvider = (providerId: string) =>
    LEGACY_DIRECT_INFERENCE_PROVIDER_IDS.has(providerId as CoreProvider)

export const shouldShowCoreInferenceProvider = (provider: CoreProviderInfo) =>
    provider.id === "openrouter" || (legacyDirectInferenceProvidersEnabled && !provider.hidden)

const HIDDEN_PROVIDER_IDS = new Set(["groq", "fal", "i3-groq", "i3-fal"])
const enabledProviderEntries = new Set(
    (optionalBrowserEnv("VITE_ENABLED_INTERNAL_PROVIDERS") || "openrouter")
        .split(",")
        .map((provider) => provider.trim())
        .filter(Boolean)
        .map((provider) => provider.toLowerCase())
)
const enabledInternalProviders = new Set<CoreProvider>(
    [...enabledProviderEntries].filter((provider) =>
        ["openai", "anthropic", "google", "xai", "groq", "fal", "gateway"].includes(provider)
    ) as CoreProvider[]
)

const getOpenRouterModelSlug = (adapter: string) => {
    if (!adapter.startsWith("openrouter:")) return undefined
    return adapter.slice("openrouter:".length).split(":")[0]
}

const slugifyProviderToken = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

const compactProviderToken = (value: string) => value.replace(/[^a-z0-9]+/g, "")

const getOpenRouterVisibilityAliases = (model: SharedModel) => {
    const aliases = new Set<string>()

    for (const adapter of model.adapters ?? []) {
        const slug = getOpenRouterModelSlug(adapter)
        if (!slug) continue

        const vendor = slug.split("/")[0]
        if (!vendor) continue

        const vendorSlug = slugifyProviderToken(vendor)
        const vendorCompact = compactProviderToken(vendor)
        if (vendorSlug) aliases.add(vendorSlug)
        if (vendorCompact) aliases.add(vendorCompact)

        if (vendorSlug.endsWith("-ai")) {
            aliases.add(vendorSlug.slice(0, -3))
        }
        if (vendorCompact.endsWith("ai")) {
            aliases.add(vendorCompact.slice(0, -2))
        }
    }

    const developer = model.developer?.trim()
    if (developer) {
        const developerSlug = slugifyProviderToken(developer)
        const developerCompact = compactProviderToken(developer.toLowerCase())
        if (developerSlug) aliases.add(developerSlug)
        if (developerCompact) aliases.add(developerCompact)

        if (developerSlug.endsWith("-ai")) {
            aliases.add(developerSlug.slice(0, -3))
        }
        if (developerCompact.endsWith("ai")) {
            aliases.add(developerCompact.slice(0, -2))
        }
    }

    aliases.delete("")
    return [...aliases]
}

export const isOpenRouterOnlySharedModel = (model: SharedModel) => {
    const adapters = model.adapters ?? []
    return adapters.length > 0 && adapters.every((adapter) => adapter.startsWith("openrouter:"))
}

export const hasOpenRouterAdapter = (model: SharedModel) =>
    (model.adapters ?? []).some((adapter) => adapter.startsWith("openrouter:"))

export const isOpenRouterModelEnabledInBrowser = (
    model: SharedModel,
    enabledEntries: ReadonlySet<string> = enabledProviderEntries
) => {
    if (!isOpenRouterOnlySharedModel(model)) return true
    if (enabledEntries.has("openrouter")) return true

    return getOpenRouterVisibilityAliases(model).some((alias) =>
        enabledEntries.has(`openrouter-${alias}`)
    )
}

const isOpenRouterAdapterEnabledInBrowser = (
    model: SharedModel,
    enabledEntries: ReadonlySet<string> = enabledProviderEntries
) => {
    if (!hasOpenRouterAdapter(model)) return false
    if (enabledEntries.has("openrouter")) return true

    return getOpenRouterVisibilityAliases(model).some((alias) =>
        enabledEntries.has(`openrouter-${alias}`)
    )
}

export const hasBuiltInOpenRouterProvider = (
    model: SharedModel,
    enabledEntries: ReadonlySet<string> = enabledProviderEntries
) => isOpenRouterAdapterEnabledInBrowser(model, enabledEntries)

export const isInternalProviderEnabled = (providerId: string) => {
    if (!providerId.startsWith("i3-")) return false

    const coreProvider = providerId.slice(3) as CoreProvider
    return !HIDDEN_PROVIDER_IDS.has(providerId) && enabledInternalProviders.has(coreProvider)
}

export const isSupportedCustomModelCoreProvider = (providerId: string) =>
    providerId === "openrouter"

export const isCustomModelProviderAvailable = (
    providerId: string,
    currentProviders: {
        core: Record<string, { enabled?: boolean }>
        custom: Record<string, { enabled?: boolean }>
    }
) =>
    (isSupportedCustomModelCoreProvider(providerId) &&
        currentProviders.core.openrouter?.enabled === true) ||
    currentProviders.custom[providerId]?.enabled === true

export const getDefaultModelId = (sharedModels: SharedModel[]) => {
    const activeModels = sharedModels.filter((model) => !isModelSunset(model))
    const hasInternalProvider = (model: SharedModel) =>
        model.adapters.some(
            (adapter) =>
                isInternalProviderEnabled(adapter.split(":")[0]) ||
                (adapter.startsWith("openrouter:") && enabledProviderEntries.has("openrouter"))
        )

    const preferredResolution = resolveModelReplacement("gpt-5.6-luna", sharedModels, {
        isCandidateAllowed: (model) => !isModelSunset(model) && hasInternalProvider(model)
    })

    return (
        preferredResolution.resolvedId ??
        activeModels.find((model) => hasInternalProvider(model))?.id ??
        activeModels.find((model) =>
            model.adapters.some((adapter) => !HIDDEN_PROVIDER_IDS.has(adapter.split(":")[0]))
        )?.id
    )
}

export const useDefaultModelId = () => {
    const { models } = useSharedModels()
    return getDefaultModelId(models)
}

export const isImageGenerationCapableModel = (model: DisplayModel) => {
    if (model.mode === "image") return true
    if (!("supportedImageResolutions" in model)) return false
    return (model.supportedImageResolutions?.length ?? 0) > 0
}

export const resolveSelectedDisplayModel = (
    selectedModelId: string | null | undefined,
    sharedModels: readonly SharedModel[],
    customModels: CustomModelsRecord | undefined
): DisplayModel | undefined => {
    if (!selectedModelId) return undefined

    const sharedModel = sharedModels.find((model) => model.id === selectedModelId)
    if (sharedModel) return sharedModel

    const customModel = customModels?.[selectedModelId]
    if (!customModel?.enabled) return undefined

    return toCustomDisplayModel(selectedModelId, customModel)
}

const buildFallbackModelDescription = (model: DisplayModel) => {
    if (isImageGenerationCapableModel(model)) {
        return "Image generation"
    }

    if (model.mode === "speech-to-text") return "Speech to text"
    if (model.mode === "text-to-speech") return "Text to speech"

    const abilityLabels = model.abilities
        .filter((ability) => ability !== "effort_control")
        .slice(0, 3)
        .map((ability) => getAbilityLabel(ability))

    return abilityLabels.length > 0 ? abilityLabels.join(" • ") : "General purpose chat"
}

export const getModelShortDescription = (model: DisplayModel) => {
    // Custom models: the user's description, else the provider's model ID. Their abilities
    // already show as icons, so listing them again adds nothing.
    if ("isCustom" in model && model.isCustom) {
        return model.description || model.modelId || model.name
    }

    if ("shortDescription" in model && typeof model.shortDescription === "string") {
        const description = model.shortDescription.trim()
        if (description) return description
    }

    return buildFallbackModelDescription(model)
}

export const getModelDescription = (model: DisplayModel) => {
    if ("description" in model && typeof model.description === "string") {
        const description = model.description.trim()
        if (description) return description
    }

    return getModelShortDescription(model)
}

export const getRequiredPlanToPickModel = (
    model: DisplayModel,
    reasoningEffort: ReasoningEffort = "off"
): "free" | "pro" => {
    if ("isCustom" in model && model.isCustom) {
        return "pro"
    }

    const sharedModel = model as SharedModel
    const basePlan = sharedModel.availableToPickFor ?? "pro"
    return sharedModel.availableToPickForReasoningEfforts?.[reasoningEffort] ?? basePlan
}

export const isAdminOnlyModel = (model: DisplayModel) =>
    !("isCustom" in model && model.isCustom) && (model as SharedModel).requiredRole === "admin"

export const getAllowedReasoningEffortsForModel = (
    model: SharedModel | null | undefined
): ReasoningEffort[] => getSharedAllowedReasoningEffortsForModel(model)

export const getSelectableReasoningEffortsForPlan = (
    model: SharedModel | null | undefined,
    creditPlan: "free" | "pro" | null | undefined
): ReasoningEffort[] => {
    const allowedEfforts = getAllowedReasoningEffortsForModel(model)

    if (creditPlan !== "free" || !model) {
        return allowedEfforts
    }

    return allowedEfforts.filter((effort) => getRequiredPlanToPickModel(model, effort) === "free")
}

export const getReasoningEffortForPlan = (
    model: SharedModel | null | undefined,
    reasoningEffort: ReasoningEffort,
    creditPlan: "free" | "pro" | null | undefined
): ReasoningEffort | null => {
    const allowedEfforts = getAllowedReasoningEffortsForModel(model)
    const selectableEfforts = getSelectableReasoningEffortsForPlan(model, creditPlan)

    if (selectableEfforts.includes(reasoningEffort)) {
        return reasoningEffort
    }

    const requestedEffortIsInvalidForModel = !allowedEfforts.includes(reasoningEffort)
    const defaultEffort = getSharedDefaultReasoningEffortForModel(model)
    if (
        requestedEffortIsInvalidForModel &&
        defaultEffort &&
        selectableEfforts.includes(defaultEffort)
    ) {
        return defaultEffort
    }

    return getNearestReasoningEffort(reasoningEffort, selectableEfforts)
}

export const getReasoningEffortLabelForModel = (
    model: SharedModel | null | undefined,
    effort: ReasoningEffort
) => {
    if (
        effort === "off" ||
        (effort === "minimal" && !getAllowedReasoningEffortsForModel(model).includes("off"))
    ) {
        return "Instant"
    }

    const allowedEfforts = getAllowedReasoningEffortsForModel(model)
    const isToggleOnlyReasoningModel =
        allowedEfforts.length === 2 && allowedEfforts[0] === "off" && allowedEfforts[1] === "medium"
    const isAlwaysOnReasoningModel = allowedEfforts.length === 1 && allowedEfforts[0] === "medium"

    if (isToggleOnlyReasoningModel) {
        return "Thinking"
    }

    if (isAlwaysOnReasoningModel) {
        return "Thinking"
    }

    if (effort === "xhigh") return "Extra high"

    return effort.charAt(0).toUpperCase() + effort.slice(1)
}

export const isInstantReasoningEffortForModel = (
    model: SharedModel | null | undefined,
    effort: ReasoningEffort
) =>
    effort === "off" ||
    (effort === "minimal" && !getAllowedReasoningEffortsForModel(model).includes("off"))

export const getReasoningEffortIcon = (effort: ReasoningEffort, model?: SharedModel | null) => {
    switch (effort) {
        case "off":
            return Zap
        case "minimal":
            return isInstantReasoningEffortForModel(model, effort) ? Zap : ReasoningLowIcon
        case "low":
            return ReasoningLowIcon
        case "medium":
            return ReasoningMediumIcon
        case "high":
        case "xhigh":
        case "max":
            return ReasoningHighIcon
    }
}

export function useAvailableModels(userSettings: HydratedUserSettings | undefined) {
    const { models: sharedModels } = useSharedModels()
    const currentProviders = {
        core: userSettings?.coreAIProviders || {},
        custom: userSettings?.customAIProviders || {}
    }

    const availableModels: DisplayModel[] = []
    const unavailableModels: DisplayModel[] = []
    const pickerModels: DisplayModel[] = []

    // Add shared models
    sharedModels
        .map((model) => applyModelRouting(model, userSettings?.modelRouting))
        .filter(
            (model) =>
                !isModelSunset(model) &&
                model.mode !== "decision" &&
                isOpenRouterModelEnabledInBrowser(model) &&
                model.adapters.some((adapter) => !HIDDEN_PROVIDER_IDS.has(adapter.split(":")[0]))
        )
        .forEach((model) => {
            const hasInternalProvider = model.adapters.some((adapter) => {
                const providerId = adapter.split(":")[0]
                return providerId.startsWith("i3-") && isInternalProviderEnabled(providerId)
            })
            const hasInternalOpenRouterProvider = hasBuiltInOpenRouterProvider(model)

            const hasOpenRouterProvider = model.adapters.some((adapter) => {
                const providerId = adapter.split(":")[0]
                return (
                    providerId === "openrouter" &&
                    currentProviders.core.openrouter?.enabled &&
                    isOpenRouterModelEnabledInBrowser(model)
                )
            })

            const hasLegacyDirectProvider =
                legacyDirectInferenceProvidersEnabled &&
                model.adapters.some((adapter) => {
                    const providerId = adapter.split(":")[0]
                    if (HIDDEN_PROVIDER_IDS.has(providerId)) return false
                    if (providerId.startsWith("i3-") || providerId === "openrouter") return false
                    return currentProviders.core[providerId as CoreProvider]?.enabled
                })

            const hasProvider =
                hasInternalProvider ||
                hasInternalOpenRouterProvider ||
                hasOpenRouterProvider ||
                hasLegacyDirectProvider

            if (hasProvider) pickerModels.push(model)
            if (hasProvider && !model.routingUnavailableReason) {
                availableModels.push(model)
            } else {
                unavailableModels.push(model)
            }
        })

    // Add custom models
    Object.entries(userSettings?.customModels || {}).forEach(([id, customModel]) => {
        if (!customModel.enabled) return

        const hasProvider = isCustomModelProviderAvailable(customModel.providerId, currentProviders)

        const modelData = toCustomDisplayModel(
            id,
            customModel,
            userSettings?.customModelCatalog?.[id]
        )

        // Retired or unserved custom models stay in the picker, greyed out with the reason,
        // so a user's own entry never silently disappears.
        if (hasProvider) pickerModels.push(modelData)
        if (hasProvider && !modelData.unavailableReason) {
            availableModels.push(modelData)
        } else {
            unavailableModels.push(modelData)
        }
    })

    return { availableModels, unavailableModels, pickerModels, currentProviders }
}

export const getAbilityIcon = (ability: ModelAbility | "pdf") => {
    switch (ability === "pdf" ? "native_pdf" : ability) {
        case "vision":
            return Eye
        case "reasoning":
            return Brain
        case "function_calling":
            return SquareTerminal
        case "native_pdf":
            return File
        default:
            return Key
    }
}

export const getAbilityLabel = (ability: ModelAbility | "pdf") => {
    switch (ability === "pdf" ? "native_pdf" : ability) {
        case "function_calling":
            return "Function Calling"
        case "vision":
            return "Vision"
        case "reasoning":
            return "Reasoning"
        case "native_pdf":
            return "Native PDF"
        default:
            return ability
    }
}

export const getProviderDisplayName = (
    providerId: string,
    currentProviders: {
        core: Record<
            string,
            {
                enabled: boolean
                encryptedKey: string
                usageMode?: "priority" | "fallback"
                authMode?: GoogleAuthMode
            }
        >
        custom: Record<
            string,
            { name: string; enabled: boolean; endpoint: string; encryptedKey: string }
        >
    }
) => {
    // Check if it's a core provider
    const coreProvider = CORE_PROVIDERS.find((p) => p.id === providerId)
    if (coreProvider) {
        if (providerId === "google") {
            const authMode = currentProviders.core.google?.authMode
            if (authMode === "vertex") {
                return "Google Vertex"
            }
            if (authMode === "ai-studio") {
                return "Google AI Studio"
            }
        }
        return coreProvider.name
    }

    // Check if it's a custom provider
    const customProvider = currentProviders.custom[providerId]
    if (customProvider) {
        return customProvider.name
    }

    return providerId
}

export type CustomModelFormData = {
    name: string
    modelId: string
    providerId: string
    contextLength: number
    maxTokens: number
    abilities: ModelAbility[]
    enabled: boolean
    description?: string
    reasoningEfforts?: ReasoningEffort[]
    defaultReasoningEffort?: ReasoningEffort
}
