import type { SharedModel } from "@/convex/lib/models"
import { isModelSunset, resolveModelReplacement } from "@/convex/lib/models/lifecycle"
import {
    getAllowedReasoningEffortsForModel,
    getDefaultModelId,
    getReasoningEffortForPlan,
    getReasoningEffortLabelForModel,
    getRequiredPlanToPickModel,
    getSelectableReasoningEffortsForPlan,
    hasBuiltInOpenRouterProvider,
    isOpenRouterModelEnabledInBrowser,
    isOpenRouterOnlySharedModel
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

    it("maps toggle-only reasoning models to instant and thinking", () => {
        const model = createModel({
            abilities: ["reasoning", "function_calling"],
            supportsDisablingReasoning: true
        })

        expect(getAllowedReasoningEffortsForModel(model)).toEqual(["off", "medium"])
        expect(getReasoningEffortLabelForModel(model, "off")).toBe("Instant")
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
})
