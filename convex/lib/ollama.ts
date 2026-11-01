import { sortReasoningEfforts } from "./models/reasoning"
import type { ReasoningEffortTier, SharedModel } from "./models/types"

// The Ollama connection is stored as a custom provider under this fixed ID, using Ollama's API.
export const OLLAMA_PROVIDER_ID = "ollama"

// Ollama serves its native API from the server root. People often paste the
// OpenAI-compatible `/v1` URL instead, so either works.
export const normalizeOllamaBaseUrl = (endpoint: string) =>
    endpoint
        .trim()
        .replace(/\/+$/, "")
        .replace(/\/(v1|api)$/i, "")

// Without a better hint, new Ollama models get this window; the user can change it.
export const DEFAULT_OLLAMA_CONTEXT_LENGTH = 32_768

export type OllamaThink = boolean | ReasoningEffortTier

// The `think` value for a request, given the reasoning level already resolved for it.
// Named levels are sent as-is; models that only switch thinking on or off get a boolean.
// Models without reasoning get nothing, so Ollama applies the model's own default.
export const resolveOllamaThink = (
    model: Pick<SharedModel, "abilities" | "reasoningEfforts">,
    effort: ReasoningEffortTier | null | undefined
): OllamaThink | undefined => {
    if (!model.abilities.includes("reasoning") || !effort) return undefined
    if (effort === "off") return false

    const namedLevels = (model.reasoningEfforts ?? []).filter((level) => level !== "off")
    return namedLevels.includes(effort) ? effort : true
}

// The parts of Ollama's /api/show response we read.
export type OllamaShowResponse = {
    capabilities?: string[]
    thinking?: {
        values?: (boolean | string)[]
        default?: boolean | string
    } | null
    model_info?: Record<string, unknown>
}

export type OllamaModelDefaults = {
    abilities: ("vision" | "reasoning" | "function_calling")[]
    reasoningEfforts?: ReasoningEffortTier[]
    defaultReasoningEffort?: ReasoningEffortTier
    /** The longest context the model was trained for, when Ollama reports it. */
    maxContextLength?: number
}

const NAMED_REASONING_LEVELS = new Set<string>(["minimal", "low", "medium", "high", "xhigh", "max"])

const isNamedReasoningLevel = (value: unknown): value is ReasoningEffortTier =>
    typeof value === "string" && NAMED_REASONING_LEVELS.has(value)

// Abilities and reasoning levels for a model, from what the server reports about it.
// `thinking.values` lists the accepted `think` values. When the model reports the
// thinking capability without them, it still honors on/off, so it gets a toggle.
export const toOllamaModelDefaults = (show: OllamaShowResponse): OllamaModelDefaults => {
    const capabilities = new Set(show.capabilities ?? [])
    const values = show.thinking?.values
    const reasons =
        capabilities.has("thinking") &&
        !(values?.length && values.every((value) => value === false))

    const maxContextLength = Object.entries(show.model_info ?? {}).find(
        ([key, value]) => key.endsWith(".context_length") && typeof value === "number" && value > 0
    )?.[1] as number | undefined

    const abilities: OllamaModelDefaults["abilities"] = [
        ...(capabilities.has("vision") ? (["vision"] as const) : []),
        ...(reasons ? (["reasoning"] as const) : []),
        ...(capabilities.has("tools") ? (["function_calling"] as const) : [])
    ]

    if (!reasons) return { abilities, maxContextLength }

    const canDisable = values?.length ? values.includes(false) : true
    const reasoningEfforts = sortReasoningEfforts([
        ...(canDisable ? (["off"] as const) : []),
        ...(values ?? []).filter(isNamedReasoningLevel)
    ])

    const reportedDefault = show.thinking?.default
    const defaultReasoningEffort =
        reportedDefault === false && canDisable
            ? "off"
            : isNamedReasoningLevel(reportedDefault) && reasoningEfforts.includes(reportedDefault)
              ? reportedDefault
              : undefined

    return { abilities, reasoningEfforts, defaultReasoningEffort, maxContextLength }
}

export type OllamaModelEntry = OllamaModelDefaults & { id: string }

// Listing models should fail fast rather than hang until the action times out.
const OLLAMA_REQUEST_TIMEOUT_MS = 15_000

class OllamaRequestError extends Error {}

const ollamaFetch = async (
    baseUrl: string,
    path: string,
    apiKey: string | undefined,
    init?: { body: unknown }
) => {
    let response: Response
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), OLLAMA_REQUEST_TIMEOUT_MS)
    try {
        response = await fetch(`${baseUrl}${path}`, {
            method: init ? "POST" : "GET",
            headers: {
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
                ...(init ? { "Content-Type": "application/json" } : {})
            },
            body: init ? JSON.stringify(init.body) : undefined,
            signal: controller.signal
        })
    } catch {
        throw new OllamaRequestError("Couldn't reach the Ollama server")
    } finally {
        clearTimeout(timeout)
    }
    if (response.status === 401 || response.status === 403) {
        throw new OllamaRequestError("The Ollama server rejected the key")
    }
    if (!response.ok) {
        throw new OllamaRequestError(`The Ollama server returned ${response.status}`)
    }
    return response.json()
}

// Every model the server has, with defaults filled in from its metadata.
export const fetchOllamaModels = async (
    endpoint: string,
    apiKey: string | undefined
): Promise<OllamaModelEntry[]> => {
    const baseUrl = normalizeOllamaBaseUrl(endpoint)
    const tags = (await ollamaFetch(baseUrl, "/api/tags", apiKey)) as {
        models?: { name?: string; model?: string }[]
    }
    const ids = [
        ...new Set((tags.models ?? []).map((entry) => entry.model ?? entry.name).filter(Boolean))
    ] as string[]

    const entries = await Promise.all(
        ids.map(async (id): Promise<OllamaModelEntry | null> => {
            try {
                const show = (await ollamaFetch(baseUrl, "/api/show", apiKey, {
                    body: { model: id }
                })) as OllamaShowResponse
                // Embedding-only models can't chat.
                if (show.capabilities && !show.capabilities.includes("completion")) return null
                return { id, ...toOllamaModelDefaults(show) }
            } catch {
                // One unreadable model shouldn't hide the rest; it just gets no defaults.
                return { id, abilities: [] }
            }
        })
    )

    return entries
        .filter((entry): entry is OllamaModelEntry => entry !== null)
        .sort((left, right) => left.id.localeCompare(right.id))
}

export const isOllamaRequestError = (error: unknown): error is OllamaRequestError =>
    error instanceof OllamaRequestError
