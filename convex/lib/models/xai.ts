import type { SharedModel } from "./types"

const xaiTextAdapters = (modelId: string, openRouterModelId?: string) => [
    `i3-xai:${modelId}`,
    `xai:${modelId}`,
    ...(openRouterModelId ? [`openrouter:${openRouterModelId}`] : [])
]

export const XAI_MODELS: SharedModel[] = [
    {
        id: "grok-4-1-fast-reasoning",
        name: "Grok 4.1 Fast Reasoning",
        shortName: "Grok 4.1 R",
        releaseOrder: 20260321,
        adapters: xaiTextAdapters("grok-4-1-fast-reasoning", "x-ai/grok-4.1-fast"),
        abilities: ["reasoning", "function_calling"],
        customIcon: "xai"
    },
    {
        id: "grok-4-1-fast-non-reasoning",
        name: "Grok 4.1 Fast",
        shortName: "Grok 4.1",
        releaseOrder: 20260320,
        adapters: xaiTextAdapters("grok-4-1-fast-non-reasoning", "x-ai/grok-4.1-fast"),
        abilities: ["function_calling"],
        customIcon: "xai"
    },
    {
        id: "grok-4.20-0309-reasoning",
        name: "Grok 4.20 0309 Reasoning",
        shortName: "Grok 4.20 R",
        releaseOrder: 20250309,
        adapters: xaiTextAdapters("grok-4.20-0309-reasoning", "x-ai/grok-4.20-beta"),
        abilities: ["reasoning", "function_calling"],
        customIcon: "xai"
    },
    {
        id: "grok-4.20-0309-non-reasoning",
        name: "Grok 4.20 0309",
        shortName: "Grok 4.20",
        releaseOrder: 20250308,
        adapters: xaiTextAdapters("grok-4.20-0309-non-reasoning", "x-ai/grok-4.20-beta"),
        abilities: ["function_calling"],
        customIcon: "xai"
    }
]
