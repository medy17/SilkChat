"use node"

import { z } from "zod"
import { getOpenRouterProviderModelId, type SharedModel } from "./models"
import { getOpenRouterRouting, getRoutedOpenRouterModelId } from "./model_routing"
import { getOpenRouterAttribution } from "./openrouter_attribution"
import type { ModelRoutingMode } from "../schema/model_routing"

export type DecisionModel = Extract<SharedModel, { mode: "decision" }>

export type NoulQuestion = {
    type: "noul"
    instructions: string
    // OpenRouter requires both sides when criteria are present.
    criteria?: { true: string; false: string }
}
export type ChoiceQuestion<Option extends string = string> = {
    type: "choice"
    instructions: string
    criteria: Record<Option, string>
}
export type ScoreQuestion = { type: "score"; instructions: string; criteria: string[] }
export type DecisionQuestion = NoulQuestion | ChoiceQuestion | ScoreQuestion
export type DecisionQuestions = Record<string, DecisionQuestion>

export type NoulAnswer = { type: "noul"; noul: number }
export type ChoiceAnswer<Option extends string = string> = {
    type: "choice"
    choice: Option
    probabilities?: Partial<Record<Option, number>>
    confidence?: number
}
export type ScoreAnswer = {
    type: "score"
    score: number
    probabilities?: Record<string, number>
    legend?: Record<string, unknown>
    confidence?: number
}
export type DecisionAnswer<Q extends DecisionQuestion> =
    Q extends ChoiceQuestion<infer Option>
        ? ChoiceAnswer<Option>
        : Q extends ScoreQuestion
          ? ScoreAnswer
          : NoulAnswer
// An answer may be missing; one that does not match its question is dropped.
export type DecisionAnswers<Q extends DecisionQuestions> = { [K in keyof Q]?: DecisionAnswer<Q[K]> }

const probability = z.number().min(0).max(1)
const decisionAnswerSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("noul"), noul: probability }),
    z.object({
        type: z.literal("choice"),
        choice: z.string(),
        probabilities: z.record(z.string(), probability).optional(),
        confidence: probability.optional()
    }),
    z.object({
        type: z.literal("score"),
        score: z.number(),
        legend: z.record(z.string(), z.unknown()).optional(),
        probabilities: z.record(z.string(), probability).optional(),
        confidence: probability.optional()
    })
])
export const decisionResponseSchema = z.object({
    id: z.string().optional(),
    model: z.string(),
    provider: z.string().optional(),
    answers: z.record(z.string(), decisionAnswerSchema),
    usage: z
        .object({
            input_tokens: z.number(),
            output_tokens: z.number(),
            cost: z.number().optional()
        })
        .optional()
})
type DecisionResponse = z.infer<typeof decisionResponseSchema>
export type DecisionResult<Q extends DecisionQuestions> = Omit<DecisionResponse, "answers"> & {
    answers: DecisionAnswers<Q>
}

const matchesQuestion = (
    question: DecisionQuestion,
    answer: DecisionResponse["answers"][string]
) =>
    question.type === "choice"
        ? answer.type === "choice" && Object.hasOwn(question.criteria, answer.choice)
        : answer.type === question.type

export const noulProbability = (answer: NoulAnswer | undefined) => answer?.noul ?? 0

export const choiceProbability = <Option extends string>(
    answer: ChoiceAnswer<Option> | undefined,
    option: Option
) => answer?.probabilities?.[option] ?? (answer?.choice === option ? (answer.confidence ?? 0) : 0)

// Decisions have their own OpenRouter endpoint; they are not chat completions.
// This small hosted orchestration request uses the same app key as title generation.
export const decide = async <Q extends DecisionQuestions>({
    model,
    state,
    questions,
    routing,
    sessionId,
    signal
}: {
    model: DecisionModel
    state: Record<string, unknown>
    questions: Q
    routing: ModelRoutingMode
    sessionId?: string
    signal: AbortSignal
}): Promise<DecisionResult<Q> | null> => {
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
            ...(sessionId ? { session_id: sessionId } : {}),
            state,
            questions
        })
    })
    if (!response.ok) {
        const detail = await response
            .json()
            .then((body) => (typeof body?.error?.message === "string" ? body.error.message : ""))
            .catch(() => "")
        throw new Error(
            `OpenRouter decisions returned ${response.status}${detail ? `: ${detail}` : ""}`
        )
    }
    const result = decisionResponseSchema.parse(await response.json())
    const answers: Record<string, unknown> = {}
    for (const [key, question] of Object.entries(questions)) {
        const answer = result.answers[key]
        if (answer && matchesQuestion(question, answer)) answers[key] = answer
    }
    return { ...result, answers: answers as DecisionAnswers<Q> }
}
