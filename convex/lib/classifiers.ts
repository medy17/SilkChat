"use node"

import { z } from "zod"
import { getOpenRouterProviderModelId, type SharedModel } from "./models"
import { getOpenRouterRouting, getRoutedOpenRouterModelId } from "./model_routing"
import { getOpenRouterAttribution } from "./openrouter_attribution"
import type { ModelRoutingMode } from "../schema/model_routing"

export type ClassifierModel = Extract<SharedModel, { mode: "decision" }>
export type ClassifierQuestion =
    | { type: "noul"; instructions: string; criteria?: { true: string; false: string } }
    | { type: "choice"; instructions: string; criteria: Record<string, string | null> }
    | { type: "score"; instructions: string; criteria: string[] }

const probability = z.number().min(0).max(1)
const classifierAnswerSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("noul"), noul: probability }),
    z.object({
        type: z.literal("choice"),
        choice: z.string(),
        probabilities: z.record(z.string(), probability),
        confidence: probability
    }),
    z.object({
        type: z.literal("score"),
        score: z.number(),
        legend: z.record(z.string(), z.string()),
        probabilities: z.record(z.string(), probability),
        confidence: probability
    })
])
export type ClassifierAnswer = z.infer<typeof classifierAnswerSchema>
export const classifierResponseSchema = z.object({
    model: z.string(),
    answers: z.record(z.string(), classifierAnswerSchema)
})
export type ClassifierResponse = z.infer<typeof classifierResponseSchema>

// Decisions have their own OpenRouter endpoint; they are not chat completions.
// This small hosted orchestration request uses the same app key as title generation.
export const classify = async ({
    model,
    state,
    questions,
    routing,
    signal
}: {
    model: ClassifierModel
    state: Record<string, unknown>
    questions: Record<string, ClassifierQuestion>
    routing: ModelRoutingMode
    signal: AbortSignal
}): Promise<ClassifierResponse | null> => {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim()
    const modelId = getOpenRouterProviderModelId(model)
    if (!apiKey || !modelId) return null
    const attribution = getOpenRouterAttribution()
    const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
        method: "POST",
        signal,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": attribution.appUrl,
            "X-Title": attribution.appName,
            ...attribution.headers
        },
        body: JSON.stringify({
            model: getRoutedOpenRouterModelId(modelId, routing),
            provider: getOpenRouterRouting(routing, model.preferredOpenRouterProviders),
            state,
            questions
        })
    })
    if (!response.ok) throw new Error(`OpenRouter classifier returned ${response.status}`)
    return classifierResponseSchema.parse(await response.json())
}
