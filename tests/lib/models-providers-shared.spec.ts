import { MODELS_SHARED, type SharedModel } from "@/convex/lib/models"
import { isModelSunset, resolveModelReplacement } from "@/convex/lib/models/lifecycle"
import {
    getDefaultReasoningEffortForModel,
    resolveReasoningEffortForModel
} from "@/convex/lib/models/reasoning"
import {
    getAllowedReasoningEffortsForModel,
    getDefaultModelId,
    getReasoningEffortForPlan,
    getReasoningEffortLabelForModel,
    getRequiredPlanToPickModel,
    getSelectableReasoningEffortsForPlan,
    hasBuiltInOpenRouterProvider,
    isAdminOnlyModel,
    isCustomModelProviderAvailable,
    isOpenRouterModelEnabledInBrowser,
    isOpenRouterOnlySharedModel,
    isSupportedCustomModelCoreProvider,
    resolveSelectedDisplayModel
} from "@/lib/models-providers-shared"
import { describe, expect, it } from "vitest"

const createModel = (overrides: Partial<SharedModel>): SharedModel =>
    ({
        id: "test-model",
        name: "Test Model",
        adapters: ["openrouter:vendor/model"],
        abilities: [],
        ...overrides
    }) as SharedModel

describe("models-providers-shared OpenRouter visibility", () => {
    it("detects OpenRouter-only shared models", () => {
        expect(
            isOpenRouterOnlySharedModel(
                createModel({
                    adapters: ["openrouter:deepseek/deepseek-v3.2"]
                })
            )
        ).toBe(true)

        expect(
            isOpenRouterOnlySharedModel(
                createModel({
                    adapters: ["openrouter:openai/gpt-5", "i3-openai:gpt-5"]
                })
            )
        ).toBe(false)
    })

    it("allows blanket openrouter visibility", () => {
        const model = createModel({
            developer: "DeepSeek",
            adapters: ["openrouter:deepseek/deepseek-v3.2"]
        })

        expect(isOpenRouterModelEnabledInBrowser(model, new Set(["openrouter"]))).toBe(true)
    })

    it("allows developer-specific OpenRouter visibility aliases", () => {
        const deepseekModel = createModel({
            developer: "DeepSeek",
            adapters: ["openrouter:deepseek/deepseek-v3.2"]
        })
        const moonshotModel = createModel({
            developer: "Moonshot AI",
            adapters: ["openrouter:moonshotai/kimi-k2.5"]
        })
        const zaiModel = createModel({
            developer: "Z.ai",
            adapters: ["openrouter:z-ai/glm-5.1"]
        })

        expect(
            isOpenRouterModelEnabledInBrowser(deepseekModel, new Set(["openrouter-deepseek"]))
        ).toBe(true)
        expect(
            isOpenRouterModelEnabledInBrowser(moonshotModel, new Set(["openrouter-moonshot"]))
        ).toBe(true)
        expect(isOpenRouterModelEnabledInBrowser(zaiModel, new Set(["openrouter-zai"]))).toBe(true)
        expect(isOpenRouterModelEnabledInBrowser(zaiModel, new Set(["openrouter-z-ai"]))).toBe(true)
    })

    it("does not hide non-OpenRouter-only models when specific OpenRouter tokens are absent", () => {
        const sharedOpenAIModel = createModel({
            developer: "OpenAI",
            adapters: ["openrouter:openai/gpt-5", "i3-openai:gpt-5"]
        })

        expect(
            isOpenRouterModelEnabledInBrowser(sharedOpenAIModel, new Set(["openai", "google"]))
        ).toBe(true)
    })

    it("hides OpenRouter-only models when no matching visibility token is enabled", () => {
        const model = createModel({
            developer: "Moonshot AI",
            adapters: ["openrouter:moonshotai/kimi-k2.5"]
        })

        expect(isOpenRouterModelEnabledInBrowser(model, new Set(["openai", "google", "xai"]))).toBe(
            false
        )
    })

    it("treats browser-enabled OpenRouter-only models as built-in provider-backed models", () => {
        const model = createModel({
            developer: "DeepSeek",
            adapters: ["openrouter:deepseek/deepseek-v3.2"]
        })

        expect(hasBuiltInOpenRouterProvider(model, new Set(["openai", "google"]))).toBe(false)
        expect(hasBuiltInOpenRouterProvider(model, new Set(["openrouter-deepseek"]))).toBe(true)
    })

    it("treats provider-aliased models as OpenRouter-backed when OpenRouter is enabled", () => {
        const model = createModel({
            developer: "OpenAI",
            adapters: ["i3-openai:gpt-5", "openai:gpt-5", "openrouter:openai/gpt-5"]
        })

        expect(isOpenRouterModelEnabledInBrowser(model, new Set(["openai", "google"]))).toBe(true)
        expect(hasBuiltInOpenRouterProvider(model, new Set(["openai", "google"]))).toBe(false)
        expect(hasBuiltInOpenRouterProvider(model, new Set(["openrouter"]))).toBe(true)
    })

    it("only treats OpenRouter as a supported core provider for custom models", () => {
        expect(isSupportedCustomModelCoreProvider("openrouter")).toBe(true)
        expect(isSupportedCustomModelCoreProvider("openai")).toBe(false)
        expect(isSupportedCustomModelCoreProvider("anthropic")).toBe(false)
        expect(isSupportedCustomModelCoreProvider("google")).toBe(false)
    })

    it("allows custom models through OpenRouter or custom OpenAI-compatible endpoints", () => {
        const currentProviders = {
            core: {
                openrouter: { enabled: true },
                openai: { enabled: true },
                anthropic: { enabled: true }
            },
            custom: {
                "custom-openai-compatible": { enabled: true },
                "custom-disabled": { enabled: false }
            }
        }

        expect(isCustomModelProviderAvailable("openrouter", currentProviders)).toBe(true)
        expect(isCustomModelProviderAvailable("custom-openai-compatible", currentProviders)).toBe(
            true
        )
        expect(isCustomModelProviderAvailable("openai", currentProviders)).toBe(false)
        expect(isCustomModelProviderAvailable("anthropic", currentProviders)).toBe(false)
        expect(isCustomModelProviderAvailable("custom-disabled", currentProviders)).toBe(false)
    })

    it("resolves selected custom models with their configured abilities", () => {
        const model = resolveSelectedDisplayModel("custom-gemma", [], {
            "custom-gemma": {
                enabled: true,
                name: "Gemma 4 26B A4B",
                modelId: "google/gemma-4-26b-a4b",
                providerId: "openrouter",
                contextLength: 128_000,
                maxTokens: 8192,
                abilities: ["vision", "function_calling", "pdf"]
            }
        })

        expect(model).toMatchObject({
            id: "custom-gemma",
            name: "Gemma 4 26B A4B",
            isCustom: true,
            providerId: "openrouter",
            abilities: ["vision", "function_calling", "native_pdf"]
        })
    })

    it("prefers shared models when a selected id exists in both registries", () => {
        const sharedModel = createModel({
            id: "gemini-3-flash",
            abilities: ["function_calling"]
        })

        expect(
            resolveSelectedDisplayModel("gemini-3-flash", [sharedModel], {
                "gemini-3-flash": {
                    enabled: true,
                    modelId: "custom/gemini-3-flash",
                    providerId: "openrouter",
                    contextLength: 128_000,
                    maxTokens: 8192,
                    abilities: ["vision"]
                }
            })
        ).toBe(sharedModel)
    })

    it("maps toggle-only reasoning models to instant and thinking", () => {
        const model = createModel({
            abilities: ["reasoning", "function_calling"],
            supportsDisablingReasoning: true
        })

        expect(getAllowedReasoningEffortsForModel(model)).toEqual(["off", "medium"])
        expect(getReasoningEffortLabelForModel(model, "off")).toBe("Instant")
        expect(getReasoningEffortLabelForModel(model, "medium")).toBe("Thinking")
    })

    it("maps always-on reasoning models to thinking only", () => {
        const model = createModel({
            abilities: ["reasoning", "function_calling"]
        })

        expect(getAllowedReasoningEffortsForModel(model)).toEqual(["medium"])
        expect(getReasoningEffortLabelForModel(model, "medium")).toBe("Thinking")
    })

    it("keeps granular effort controls for effort_control models", () => {
        const model = createModel({
            abilities: ["reasoning", "function_calling", "effort_control"],
            supportsDisablingReasoning: true
        })

        expect(getAllowedReasoningEffortsForModel(model)).toEqual(["off", "low", "medium", "high"])
        expect(getReasoningEffortLabelForModel(model, "low")).toBe("Low")
        expect(getReasoningEffortLabelForModel(model, "high")).toBe("High")
    })

    it("allows explicit minimal reasoning levels without requiring off", () => {
        const model = createModel({
            abilities: ["reasoning", "function_calling", "effort_control"],
            reasoningEfforts: ["minimal", "low", "medium", "high"]
        })

        expect(getAllowedReasoningEffortsForModel(model)).toEqual([
            "minimal",
            "low",
            "medium",
            "high"
        ])
        expect(getReasoningEffortLabelForModel(model, "minimal")).toBe("Instant")
    })

    it("uses explicit model defaults when old off states become invalid", () => {
        const model = createModel({
            abilities: ["reasoning", "function_calling", "effort_control"],
            reasoningEfforts: ["minimal", "low", "medium", "high"],
            defaultReasoningEffort: "low"
        })

        expect(getDefaultReasoningEffortForModel(model)).toBe("low")
        expect(resolveReasoningEffortForModel(model, "off")).toBe("low")
        expect(getReasoningEffortForPlan(model, "off", "pro")).toBe("low")
    })

    it("falls back to minimal when a model removes off but has no explicit default override", () => {
        const model = createModel({
            abilities: ["reasoning", "function_calling", "effort_control"],
            reasoningEfforts: ["minimal", "low", "medium", "high"]
        })

        expect(resolveReasoningEffortForModel(model, "off")).toBe("minimal")
        expect(getReasoningEffortForPlan(model, "off", "pro")).toBe("minimal")
    })

    it("resolves picker access from availability metadata instead of credit buckets", () => {
        const proGatedBasicModel = createModel({
            availableToPickFor: "pro",
            prototypeCreditTier: "basic"
        })
        const freeWithoutReasoningModel = createModel({
            availableToPickFor: "free",
            availableToPickForReasoningEfforts: {
                low: "pro",
                medium: "pro",
                high: "pro"
            },
            prototypeCreditTier: "basic"
        })
        const freeUpToLowReasoningModel = createModel({
            availableToPickFor: "free",
            availableToPickForReasoningEfforts: {
                medium: "pro",
                high: "pro"
            },
            prototypeCreditTier: "basic"
        })

        expect(getRequiredPlanToPickModel(proGatedBasicModel, "off")).toBe("pro")
        expect(getRequiredPlanToPickModel(freeWithoutReasoningModel, "off")).toBe("free")
        expect(getRequiredPlanToPickModel(freeWithoutReasoningModel, "low")).toBe("pro")
        expect(getRequiredPlanToPickModel(freeUpToLowReasoningModel, "low")).toBe("free")
        expect(getRequiredPlanToPickModel(freeUpToLowReasoningModel, "medium")).toBe("pro")
    })

    it("detects admin-only shared models", () => {
        expect(isAdminOnlyModel(createModel({ requiredRole: "admin" }))).toBe(true)
        expect(isAdminOnlyModel(createModel({}))).toBe(false)
        expect(
            isAdminOnlyModel({
                id: "custom",
                name: "Custom",
                abilities: [],
                isCustom: true,
                providerId: "openai"
            })
        ).toBe(false)
    })

    it("limits selectable reasoning efforts by plan without hiding pro-only choices globally", () => {
        const freeUpToLowReasoningModel = createModel({
            abilities: ["reasoning", "effort_control"],
            supportsDisablingReasoning: true,
            availableToPickFor: "free",
            availableToPickForReasoningEfforts: {
                medium: "pro",
                high: "pro"
            }
        })
        const freeWithoutReasoningModel = createModel({
            abilities: ["reasoning"],
            supportsDisablingReasoning: true,
            availableToPickFor: "free",
            availableToPickForReasoningEfforts: {
                medium: "pro"
            }
        })

        expect(getSelectableReasoningEffortsForPlan(freeUpToLowReasoningModel, "free")).toEqual([
            "off",
            "low"
        ])
        expect(getSelectableReasoningEffortsForPlan(freeUpToLowReasoningModel, "pro")).toEqual([
            "off",
            "low",
            "medium",
            "high"
        ])
        expect(getReasoningEffortForPlan(freeUpToLowReasoningModel, "high", "free")).toBe("low")
        expect(getReasoningEffortForPlan(freeWithoutReasoningModel, "medium", "free")).toBe("off")
    })

    it("keeps old threads selectable on minimal-supporting free models", () => {
        const model = createModel({
            abilities: ["reasoning", "effort_control"],
            reasoningEfforts: ["minimal", "low", "medium", "high"],
            defaultReasoningEffort: "low",
            availableToPickFor: "free",
            availableToPickForReasoningEfforts: {
                medium: "pro",
                high: "pro"
            }
        })

        expect(getSelectableReasoningEffortsForPlan(model, "free")).toEqual(["minimal", "low"])
        expect(getReasoningEffortForPlan(model, "off", "free")).toBe("low")
        expect(getReasoningEffortForPlan(model, "high", "free")).toBe("low")
    })

    it("treats sunset dates as an inclusive hard cutoff", () => {
        const model = createModel({
            sunsetOn: "2026-06-01"
        })

        expect(isModelSunset(model, "2026-05-31")).toBe(false)
        expect(isModelSunset(model, "2026-06-01")).toBe(true)
    })

    it("cascades model replacements until it reaches an active model", () => {
        const models = [
            createModel({
                id: "old",
                sunsetOn: "2026-01-01",
                replacementId: "middle"
            }),
            createModel({
                id: "middle",
                sunsetOn: "2026-02-01",
                replacementId: "new"
            }),
            createModel({
                id: "new"
            })
        ]

        expect(resolveModelReplacement("old", models, { date: "2026-03-01" })).toMatchObject({
            resolvedId: "new",
            chain: ["old", "middle", "new"],
            reason: "replaced"
        })
    })

    it("guards replacement cycles", () => {
        const models = [
            createModel({
                id: "old",
                sunsetOn: "2026-01-01",
                replacementId: "middle"
            }),
            createModel({
                id: "middle",
                sunsetOn: "2026-02-01",
                replacementId: "old"
            })
        ]

        expect(resolveModelReplacement("old", models, { date: "2026-03-01" })).toMatchObject({
            resolvedId: null,
            reason: "cycle"
        })
    })

    it("uses an active replacement when the preferred default is sunset", () => {
        const models = [
            createModel({
                id: "gemini-3-flash-preview",
                adapters: ["i3-google:gemini-3-flash-preview"],
                sunsetOn: "2026-01-01",
                replacementId: "gemini-4-flash-preview"
            }),
            createModel({
                id: "gemini-4-flash-preview",
                adapters: ["i3-google:gemini-4-flash-preview"]
            })
        ]

        expect(getDefaultModelId(models)).toBe("gemini-4-flash-preview")
    })

    it("migrates the Gemini 3.1 Flash Lite preview id to the GA model", () => {
        expect(
            resolveModelReplacement("gemini-3.1-flash-lite-preview", MODELS_SHARED, {
                date: "2026-05-25"
            })
        ).toMatchObject({
            resolvedId: "gemini-3.1-flash-lite",
            chain: ["gemini-3.1-flash-lite-preview", "gemini-3.1-flash-lite"],
            reason: "replaced"
        })
    })
})
