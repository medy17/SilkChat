import { getOpenRouterProviderModelId, isModelSunset, type SharedModel } from "@/convex/lib/models"
import type { GalaxyCatalogEntry } from "@/convex/lib/openrouter_catalog"

export const GALAXY_LAB_KEYS = [
    "openai",
    "anthropic",
    "google",
    "xai",
    "deepseek",
    "zai",
    "moonshot",
    "qwen",
    "xiaomi",
    "minimax",
    "meta",
    "mistral",
    "bfl"
] as const

export type GalaxyLabKey = (typeof GALAXY_LAB_KEYS)[number]
export type GalaxyOutput = "text" | "image" | "audio"

export type GalaxyLab = {
    key: GalaxyLabKey
    name: string
    count: number
    outputs: GalaxyOutput[]
}

export type GalaxyModel = {
    id: string
    name: string
    lab: GalaxyLabKey
    /** In SilkChat's own list, rather than reachable through OpenRouter. */
    curated: boolean
    legacy: boolean
    /** When SilkChat added it, or the knowledge cutoff for OpenRouter models. */
    date: string | null
    contextLength: number | null
    outputs: GalaxyOutput[]
}

export type GalaxyCatalog = {
    labs: GalaxyLab[]
    models: GalaxyModel[]
}

const LAB_NAMES: Record<GalaxyLabKey, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    xai: "xAI",
    deepseek: "DeepSeek",
    zai: "Z.ai",
    moonshot: "Moonshot AI",
    qwen: "Qwen",
    xiaomi: "Xiaomi",
    minimax: "MiniMax",
    meta: "Meta",
    mistral: "Mistral AI",
    bfl: "Black Forest Labs"
}

const LAB_BY_DEVELOPER = new Map<string, GalaxyLabKey>(
    Object.entries(LAB_NAMES).map(([key, name]) => [name, key as GalaxyLabKey])
)

const LAB_BY_CUSTOM_ICON: Record<NonNullable<SharedModel["customIcon"]>, GalaxyLabKey | null> = {
    openai: "openai",
    google: "google",
    xai: "xai",
    meta: "meta",
    bflabs: "bfl",
    "stability-ai": null
}

const LAB_BY_ADAPTER_PROVIDER: Record<string, GalaxyLabKey> = {
    openai: "openai",
    anthropic: "anthropic",
    google: "google",
    xai: "xai"
}

// Developer wins, then the icon override, then the direct provider adapter.
// Models whose lab has no brand icon stay out, since a planet is drawn as its icon.
export const resolveGalaxyLab = (
    model: Pick<SharedModel, "developer" | "customIcon" | "adapters">
): GalaxyLabKey | null => {
    const developer = model.developer?.trim()
    if (developer) return LAB_BY_DEVELOPER.get(developer) ?? null
    if (model.customIcon) return LAB_BY_CUSTOM_ICON[model.customIcon]
    const provider = model.adapters[0]?.split(":")[0]?.replace(/^i3-/, "")
    return (provider && LAB_BY_ADAPTER_PROVIDER[provider]) || null
}

const LAB_BY_OPENROUTER_AUTHOR: Record<string, GalaxyLabKey> = {
    openai: "openai",
    anthropic: "anthropic",
    google: "google",
    "x-ai": "xai",
    deepseek: "deepseek",
    "z-ai": "zai",
    moonshotai: "moonshot",
    qwen: "qwen",
    xiaomi: "xiaomi",
    minimax: "minimax",
    meta: "meta",
    "meta-llama": "meta",
    mistralai: "mistral",
    "black-forest-labs": "bfl"
}

const nameKey = (lab: GalaxyLabKey, name: string) =>
    `${lab}:${name.toLowerCase().replace(/[^a-z0-9]/g, "")}`

const getOutputs = (model: SharedModel): GalaxyOutput[] => {
    switch (model.mode) {
        case "image":
            return ["image"]
        case "text-to-speech":
            return ["audio"]
        default:
            return ["text"]
    }
}

const OUTPUT_ORDER: GalaxyOutput[] = ["text", "image", "audio"]

// SilkChat's own models first, then the rest of OpenRouter's catalog for the same labs.
// An OpenRouter model already in SilkChat's list, by slug or by name, isn't drawn twice.
export const buildGalaxyCatalog = (
    models: SharedModel[],
    openRouter: GalaxyCatalogEntry[],
    today: Date
): GalaxyCatalog => {
    const galaxyModels: GalaxyModel[] = []
    const seenSlugs = new Set<string>()
    const seenNames = new Set<string>()
    for (const model of models) {
        if (model.mode === "decision" || isModelSunset(model, today)) continue
        const lab = resolveGalaxyLab(model)
        if (!lab) continue
        const slug = getOpenRouterProviderModelId(model)
        if (slug) seenSlugs.add(slug)
        seenNames.add(nameKey(lab, model.name))
        galaxyModels.push({
            id: model.id,
            name: model.name,
            lab,
            curated: true,
            legacy: Boolean(model.legacy),
            date: model.addedOn ?? null,
            contextLength: model.contextLength ?? null,
            outputs: getOutputs(model)
        })
    }

    for (const entry of openRouter) {
        const lab = LAB_BY_OPENROUTER_AUTHOR[entry.id.split("/")[0] ?? ""]
        if (!lab || seenSlugs.has(entry.id)) continue
        const key = nameKey(lab, entry.name)
        if (seenNames.has(key)) continue
        seenNames.add(key)
        galaxyModels.push({
            id: entry.id,
            name: entry.name,
            lab,
            curated: false,
            legacy: false,
            date: entry.knowledgeCutoff ?? null,
            contextLength: entry.contextLength ?? null,
            outputs: entry.outputs
        })
    }

    const labs = new Map<GalaxyLabKey, GalaxyLab>()
    for (const model of galaxyModels) {
        const lab = labs.get(model.lab) ?? {
            key: model.lab,
            name: LAB_NAMES[model.lab],
            count: 0,
            outputs: []
        }
        lab.count += 1
        for (const output of model.outputs) {
            if (!lab.outputs.includes(output)) lab.outputs.push(output)
        }
        labs.set(model.lab, lab)
    }

    return {
        labs: [...labs.values()]
            .map((lab) => ({
                ...lab,
                outputs: OUTPUT_ORDER.filter((output) => lab.outputs.includes(output))
            }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
        models: galaxyModels
    }
}
