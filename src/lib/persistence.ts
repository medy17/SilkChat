import { ABILITIES } from "@/lib/tool-abilities"
import { z } from "zod"

const AIConfigSchema = z.object({
    selectedModel: z.string().nullable(),
    enabledTools: z.array(z.enum(ABILITIES)).default([]),
    selectedImageSize: z.string().optional().default("1:1"),
    selectedImageResolution: z.string().optional().default("1K"),
    reasoningEffort: z.enum(["off", "minimal", "low", "medium", "high"]).default("off")
})

export type AIConfig = z.infer<typeof AIConfigSchema>

const AI_CONFIG_KEY = "ai-config"
const MODEL_STORAGE_KEY = "model-storage"
const USER_INPUT_KEY = "user-input"
const LUNA_DEFAULT_MODEL_ID = "gpt-5.6-luna"
export const LUNA_DEFAULT_MODEL_MIGRATION_KEY = "default-model-gpt-5.6-luna:v1"
const LEGACY_REASONING_VARIANT_MODEL_IDS: Record<
    string,
    {
        modelId: string
        reasoningEffort: AIConfig["reasoningEffort"]
    }
> = {
    "deepseek-v3.2-thinking": { modelId: "deepseek-v3.2", reasoningEffort: "medium" },
    "glm-5-thinking": { modelId: "glm-5", reasoningEffort: "medium" },
    "glm-5v-turbo-thinking": { modelId: "glm-5v-turbo", reasoningEffort: "medium" },
    "kimi-k2.5-thinking": { modelId: "kimi-k2.5", reasoningEffort: "medium" },
    "grok-4-1-fast-reasoning": { modelId: "grok-4-1-fast", reasoningEffort: "medium" },
    "grok-4-1-fast-non-reasoning": { modelId: "grok-4-1-fast", reasoningEffort: "off" },
    "grok-4.20-0309-reasoning": { modelId: "grok-4.20-0309", reasoningEffort: "medium" },
    "grok-4.20-0309-non-reasoning": { modelId: "grok-4.20-0309", reasoningEffort: "off" }
}

const safeRemoveItem = (key: string): void => {
    if (typeof window === "undefined") return
    try {
        localStorage.removeItem(key)
    } catch {}
}

const defaultAIConfig = (): AIConfig => ({
    selectedModel: null,
    enabledTools: [],
    selectedImageSize: "1:1",
    selectedImageResolution: "1K",
    reasoningEffort: "off"
})

export const setDefaultModelToLunaOnce = (storage: Storage): void => {
    try {
        if (storage.getItem(LUNA_DEFAULT_MODEL_MIGRATION_KEY) === "true") return

        const storedConfig = storage.getItem(AI_CONFIG_KEY)
        const storedModelState = storage.getItem(MODEL_STORAGE_KEY)

        if (!storedConfig && !storedModelState) {
            storage.setItem(LUNA_DEFAULT_MODEL_MIGRATION_KEY, "true")
            return
        }

        const config = storedConfig
            ? { ...defaultAIConfig(), ...JSON.parse(storedConfig) }
            : defaultAIConfig()
        config.selectedModel = LUNA_DEFAULT_MODEL_ID
        storage.setItem(AI_CONFIG_KEY, JSON.stringify(AIConfigSchema.parse(config)))

        const modelState = storedModelState ? JSON.parse(storedModelState) : {}
        storage.setItem(
            MODEL_STORAGE_KEY,
            JSON.stringify({
                ...modelState,
                state: {
                    ...(modelState.state ?? {}),
                    selectedModel: LUNA_DEFAULT_MODEL_ID
                },
                version: modelState.version ?? 0
            })
        )

        storage.setItem(LUNA_DEFAULT_MODEL_MIGRATION_KEY, "true")
    } catch {
        // localStorage can be unavailable or contain malformed legacy state. Without the
        // marker, a later load can retry after the existing recovery paths clean it up.
    }
}

const isOldDefaultWebSearchConfig = (config: Partial<AIConfig>) =>
    config.selectedModel === null &&
    Array.isArray(config.enabledTools) &&
    config.enabledTools.length === 1 &&
    config.enabledTools[0] === "web_search" &&
    (config.selectedImageSize === undefined || config.selectedImageSize === "1:1") &&
    (config.selectedImageResolution === undefined || config.selectedImageResolution === "1K") &&
    (config.reasoningEffort === undefined || config.reasoningEffort === "off")

export const loadAIConfig = (): AIConfig => {
    if (typeof window === "undefined") return defaultAIConfig()
    const stored = localStorage.getItem(AI_CONFIG_KEY)
    if (!stored) {
        return defaultAIConfig()
    }

    try {
        const parsed = JSON.parse(stored)

        // Validate enabled tools but let the UI handle invalid model IDs gracefully
        if (
            Array.isArray(parsed.enabledTools) &&
            parsed.enabledTools.some(
                (tool: string) => !ABILITIES.includes(tool as (typeof ABILITIES)[number])
            )
        ) {
            parsed.enabledTools = []
        }

        if (isOldDefaultWebSearchConfig(parsed)) {
            parsed.enabledTools = []
        }

        if (typeof parsed.selectedModel === "string") {
            const migratedModel = LEGACY_REASONING_VARIANT_MODEL_IDS[parsed.selectedModel]
            if (migratedModel) {
                parsed.selectedModel = migratedModel.modelId
                parsed.reasoningEffort = migratedModel.reasoningEffort
            }
        }

        return AIConfigSchema.parse(parsed)
    } catch {
        safeRemoveItem(AI_CONFIG_KEY)
        return defaultAIConfig()
    }
}

export const loadUserInput = (): string => {
    if (typeof window === "undefined") return ""
    const stored = localStorage.getItem(USER_INPUT_KEY)
    return stored?.trim() ?? ""
}

export const saveAIConfig = (config: AIConfig): void => {
    if (typeof window === "undefined") return
    const validated = AIConfigSchema.parse(config)
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(validated))
}

export const saveUserInput = (input: string): void => {
    if (typeof window === "undefined") return
    if (input.trim()) localStorage.setItem(USER_INPUT_KEY, input)
    else localStorage.removeItem(USER_INPUT_KEY)
}
