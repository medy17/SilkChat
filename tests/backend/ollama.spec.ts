import { describe, expect, it } from "vitest"
import {
    normalizeOllamaBaseUrl,
    resolveOllamaThink,
    toOllamaModelDefaults
} from "../../convex/lib/ollama"

describe("normalizeOllamaBaseUrl", () => {
    it("accepts the server root, the OpenAI-compatible /v1 URL, or the /api URL", () => {
        expect(normalizeOllamaBaseUrl(" https://ollama.example.com/ ")).toBe(
            "https://ollama.example.com"
        )
        expect(normalizeOllamaBaseUrl("https://ollama.example.com/v1/")).toBe(
            "https://ollama.example.com"
        )
        expect(normalizeOllamaBaseUrl("http://127.0.0.1:11434/api")).toBe("http://127.0.0.1:11434")
    })
})

describe("toOllamaModelDefaults", () => {
    it("gives a thinking model without level metadata an on/off toggle", () => {
        expect(
            toOllamaModelDefaults({
                capabilities: ["completion", "vision", "tools", "thinking"],
                thinking: null,
                model_info: { "qwen35moe.context_length": 262144 }
            })
        ).toEqual({
            abilities: ["vision", "reasoning", "function_calling"],
            reasoningEfforts: ["off"],
            defaultReasoningEffort: undefined,
            maxContextLength: 262144
        })
    })

    it("offers named levels, with off only when the model accepts false", () => {
        expect(
            toOllamaModelDefaults({
                capabilities: ["completion", "thinking"],
                thinking: { values: ["low", "medium", "high"], default: "medium" }
            })
        ).toMatchObject({
            reasoningEfforts: ["low", "medium", "high"],
            defaultReasoningEffort: "medium"
        })
        expect(
            toOllamaModelDefaults({
                capabilities: ["completion", "thinking"],
                thinking: { values: [true, false], default: false }
            })
        ).toMatchObject({ reasoningEfforts: ["off"], defaultReasoningEffort: "off" })
    })

    it("treats a model that can only refuse thinking as non-reasoning", () => {
        expect(
            toOllamaModelDefaults({
                capabilities: ["completion", "thinking"],
                thinking: { values: [false] }
            })
        ).toEqual({ abilities: [], maxContextLength: undefined })
    })
})

describe("resolveOllamaThink", () => {
    const toggleModel = { abilities: ["reasoning" as const] }
    const leveledModel = {
        abilities: ["reasoning" as const],
        reasoningEfforts: ["low" as const, "high" as const]
    }

    it("sends false for off and true for on/off models", () => {
        expect(resolveOllamaThink(toggleModel, "off")).toBe(false)
        expect(resolveOllamaThink(toggleModel, "medium")).toBe(true)
    })

    it("sends the level itself for models with named levels", () => {
        expect(resolveOllamaThink(leveledModel, "high")).toBe("high")
    })

    it("leaves models without reasoning on their default", () => {
        expect(resolveOllamaThink({ abilities: [] }, "high")).toBeUndefined()
    })
})
