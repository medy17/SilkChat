import { REASONING_EFFORT_RANK, sortReasoningEfforts } from "./models/reasoning"
import type { ReasoningEffortTier } from "./models/types"

type CatalogRow = {
    providerModelId: string
    description?: string
    removedAt?: number
    aliasOf?: string
    expirationDate?: string
    providerCount?: number
    name?: string
    contextLength?: number
    maxCompletionTokens?: number
    inputModalities?: string[]
    outputModalities?: string[]
    supportedParameters?: string[]
    reasoning?: {
        mandatory?: boolean
        supportedEfforts?: string[]
        defaultEffort?: string
    }
}

export type OpenRouterCatalogEntry = {
    id: string
    name: string
    // OpenRouter's description, cleaned up to prefill a custom model's description.
    description?: string
    contextLength?: number
    maxCompletionTokens?: number
    supportsImages: boolean
    supportsFiles: boolean
    supportsTools: boolean
    supportsReasoning: boolean
    // OpenRouter's announced removal date (YYYY-MM-DD), when one is scheduled.
    expirationDate?: string
    // Levels in the app's order; "off" when reasoning can be turned off. Unset when
    // OpenRouter doesn't describe the model's reasoning.
    reasoningEfforts?: ReasoningEffortTier[]
    defaultReasoningEffort?: ReasoningEffortTier
}

// OpenRouter only serves a truncated description ("... It..."), sometimes with markdown
// links. Keep the complete sentences as plain text. A sentence ends at punctuation followed
// by a space and a capital, so dots in names and versions ("Z.ai", "3.2") don't split it;
// a cut-off first sentence keeps an ellipsis.
export const toPlainModelDescription = (description: string | undefined) => {
    if (!description) return undefined

    const plain = description
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/\*\*|__|`/g, "")
        .replace(/\s+/g, " ")
        .trim()
    const truncated = /(\.\.\.|…)$/.test(plain)
    if (!truncated) return plain || undefined

    const body = plain.replace(/\s*(\.\.\.|…)$/, "")
    const lastBoundary = [...body.matchAll(/[.!?](?=\s+["“(]?[A-Z])/g)].pop()
    return lastBoundary?.index !== undefined ? body.slice(0, lastBoundary.index + 1) : `${body}…`
}

// OpenRouter calls "off" "none"; any level the app doesn't know is dropped.
const toReasoningEffortTier = (effort: string): ReasoningEffortTier | undefined => {
    const tier = effort === "none" ? "off" : effort
    return tier in REASONING_EFFORT_RANK ? (tier as ReasoningEffortTier) : undefined
}

const getReasoningLevels = (reasoning: NonNullable<CatalogRow["reasoning"]>) => {
    const levels = (reasoning.supportedEfforts ?? []).flatMap(
        (effort) => toReasoningEffortTier(effort) ?? []
    )
    const reasoningEfforts = sortReasoningEfforts(
        reasoning.mandatory === false ? [...levels, "off"] : levels
    )
    const defaultEffort = reasoning.defaultEffort
        ? toReasoningEffortTier(reasoning.defaultEffort)
        : undefined

    return {
        reasoningEfforts,
        defaultReasoningEffort:
            defaultEffort && reasoningEfforts.includes(defaultEffort) ? defaultEffort : undefined
    }
}

// Chat models only: text in and text-only out. Models that also emit images or audio
// behave differently in chat, and rows without modalities are unknown, so both are left
// out.
export const isTextChatModel = (row: Pick<CatalogRow, "inputModalities" | "outputModalities">) =>
    Boolean(row.inputModalities?.includes("text")) &&
    Boolean(row.outputModalities?.length) &&
    Boolean(row.outputModalities?.every((modality) => modality === "text"))

// A model someone can add: not a "latest" alias whose target shifts, not a ":batch" variant
// (batch processing, not live chat), and served by at least one provider. Zero providers
// covers routers, abandoned models, and models past their removal date; an unknown count
// (not yet synced) is kept. Models scheduled for removal stay, since that's often why
// someone wants to try them.
const isStableModel = (row: CatalogRow) =>
    !row.aliasOf && !row.providerModelId.endsWith(":batch") && row.providerCount !== 0

// Catalog entries shaped for prefilling custom models. Rows for models OpenRouter dropped
// are kept but marked removed, so they're left out here.
export const toOpenRouterCatalogEntries = (rows: CatalogRow[]): OpenRouterCatalogEntry[] =>
    rows
        .filter((row) => !row.removedAt && isTextChatModel(row) && isStableModel(row))
        .map((row) => ({
            id: row.providerModelId,
            name: row.name ?? row.providerModelId,
            description: toPlainModelDescription(row.description),
            contextLength: row.contextLength,
            maxCompletionTokens: row.maxCompletionTokens,
            supportsImages: row.inputModalities?.includes("image") ?? false,
            supportsFiles: row.inputModalities?.includes("file") ?? false,
            supportsTools: row.supportedParameters?.includes("tools") ?? false,
            supportsReasoning:
                Boolean(row.reasoning) || (row.supportedParameters?.includes("reasoning") ?? false),
            expirationDate: row.expirationDate,
            ...(row.reasoning ? getReasoningLevels(row.reasoning) : {})
        }))
        .sort((a, b) => a.name.localeCompare(b.name))

export type CustomModelCatalogStatus = {
    expirationDate?: string
    unavailableReason?: string
}

export const RETIRED_MODEL_REASON = "Retired by OpenRouter."
export const NO_PROVIDERS_MODEL_REASON = "No providers are serving this model right now."

// A custom OpenRouter model's standing in the synced catalog. A model with no row has never
// been seen (typed in before the catalog, or not synced yet), so it gets no status rather
// than being greyed out. Aliases list no endpoints of their own but still route.
export const getCustomModelCatalogStatus = (
    row: CatalogRow | null | undefined
): CustomModelCatalogStatus | undefined => {
    if (!row) return undefined
    if (row.removedAt) return { unavailableReason: RETIRED_MODEL_REASON }
    if (row.providerCount === 0 && !row.aliasOf) {
        return { unavailableReason: NO_PROVIDERS_MODEL_REASON }
    }
    return row.expirationDate ? { expirationDate: row.expirationDate } : undefined
}
