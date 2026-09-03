import { type Infer, v } from "convex/values"
import { CoreProviders } from "../lib/models"

const CoreProvidersSchema = v.union(
    ...CoreProviders.map((p) => v.literal(p)),
    v.literal("openrouter")
)

export const CoreAIProvider = v.object({
    enabled: v.boolean(),
    encryptedKey: v.string(),
    usageMode: v.optional(v.union(v.literal("priority"), v.literal("fallback"))),
    authMode: v.optional(v.union(v.literal("ai-studio"), v.literal("vertex")))
})

const GoogleAuthModeSchema = v.union(v.literal("ai-studio"), v.literal("vertex"))
export type GoogleAuthMode = Infer<typeof GoogleAuthModeSchema>

export const CustomAIProvider = v.object({
    name: v.string(),
    enabled: v.boolean(),
    endpoint: v.string(),
    apiMode: v.optional(v.union(v.literal("chat"), v.literal("responses"))),
    encryptedKey: v.string()
})
export type CustomProviderApiMode = NonNullable<Infer<typeof CustomAIProvider>["apiMode"]>

export const UserCustomization = v.object({
    name: v.optional(v.string()),
    aiPersonality: v.optional(v.string()),
    additionalContext: v.optional(v.string())
})

export const ResponseStyleLevel = v.union(v.literal("less"), v.literal("more"))

export const ResponseStyle = v.object({
    warmth: v.optional(ResponseStyleLevel),
    enthusiasm: v.optional(ResponseStyleLevel),
    structure: v.optional(ResponseStyleLevel),
    emoji: v.optional(ResponseStyleLevel),
    profanity: v.optional(ResponseStyleLevel)
})

export const ImageResolutionSchema = v.union(v.literal("1K"), v.literal("2K"), v.literal("4K"))

// Per-user defaults for the SilkScreen image tool. These are soft preferences: they
// fill fields the model leaves empty, are overridden by an explicit model choice, and
// are always clamped to what the chosen model actually supports (see
// validatePreparedImageRequest).
export const ImageGenerationDefaults = v.object({
    resolution: v.optional(ImageResolutionSchema),
    variants: v.optional(v.number())
})

const ModelAbilitySchema = v.union(
    v.literal("reasoning"),
    v.literal("vision"),
    v.literal("function_calling"),
    v.literal("native_pdf"),
    v.literal("effort_control")
)
export type ModelAbility = Infer<typeof ModelAbilitySchema>
export const StoredModelAbilitySchema = v.union(ModelAbilitySchema, v.literal("pdf"))
export type StoredModelAbility = Infer<typeof StoredModelAbilitySchema>

export const CustomModel = v.object({
    enabled: v.boolean(),
    name: v.optional(v.string()),
    modelId: v.string(),
    providerId: v.union(CoreProvidersSchema, v.string()),
    contextLength: v.number(),
    maxTokens: v.number(),
    abilities: v.array(StoredModelAbilitySchema)
})

export const NonSensitiveUserSettings = v.object({
    userId: v.string(),
    // Transitional storage compatibility. Search is now deployment-funded through
    // Perplexity; these fields can be removed after existing settings are migrated.
    searchProvider: v.optional(
        v.union(
            v.literal("firecrawl"),
            v.literal("brave"),
            v.literal("tavily"),
            v.literal("serper")
        )
    ),
    searchIncludeSourcesByDefault: v.optional(v.boolean()),
    customModels: v.record(v.string(), CustomModel),
    titleGenerationModel: v.string(),
    toolCallLimitPerTurn: v.optional(v.number()),
    customThemes: v.optional(v.array(v.string())),
    invertSendNewlineBehavior: v.optional(v.boolean()),
    telemetryEnabled: v.optional(v.boolean()),
    customization: v.optional(UserCustomization),
    responseStyle: v.optional(ResponseStyle),
    imageGenerationDefaults: v.optional(ImageGenerationDefaults),
    onboardingCompleted: v.optional(v.boolean())
})

export const GeneralProviderConfig = v.object({
    enabled: v.boolean(),
    encryptedKey: v.string()
})

export const BraveProviderConfig = v.object({
    enabled: v.boolean(),
    encryptedKey: v.string(),
    country: v.optional(v.string()),
    searchLang: v.optional(v.string()),
    safesearch: v.optional(v.union(v.literal("off"), v.literal("moderate"), v.literal("strict")))
})

export const SerperProviderConfig = v.object({
    enabled: v.boolean(),
    encryptedKey: v.string(),
    language: v.optional(v.string()), // language
    country: v.optional(v.string()) // country
})

export const UserSettings = v.object({
    ...NonSensitiveUserSettings.fields,
    coreAIProviders: v.record(v.string(), CoreAIProvider),
    customAIProviders: v.record(v.string(), CustomAIProvider),
    generalProviders: v.object({
        // Transitional storage compatibility for retired per-user Supermemory keys.
        supermemory: v.optional(GeneralProviderConfig),
        // Transitional storage compatibility for retired search BYOK keys.
        firecrawl: v.optional(GeneralProviderConfig),
        tavily: v.optional(GeneralProviderConfig),
        brave: v.optional(BraveProviderConfig),
        serper: v.optional(SerperProviderConfig)
    })
})
