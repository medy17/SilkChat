import type { SharedModel } from "./types"

export const XAI_MODELS: SharedModel[] = [
    {
        id: "grok-4-1-fast-reasoning",
        name: "Grok 4.1 Fast Reasoning",
        shortName: "Grok 4.1 R",
        releaseOrder: 20260321,
        adapters: ["i3-xai:grok-4-1-fast-reasoning", "xai:grok-4-1-fast-reasoning"],
        abilities: ["reasoning", "function_calling"],
        customIcon: "xai"
    },
    {
        id: "grok-4-1-fast-non-reasoning",
        name: "Grok 4.1 Fast",
        shortName: "Grok 4.1",
        releaseOrder: 20260320,
        adapters: ["i3-xai:grok-4-1-fast-non-reasoning", "xai:grok-4-1-fast-non-reasoning"],
        abilities: ["function_calling"],
        customIcon: "xai"
    },
    {
        id: "grok-4.20-0309-reasoning",
        name: "Grok 4.20 0309 Reasoning",
        shortName: "Grok 4.20 R",
        releaseOrder: 20250309,
        adapters: ["i3-xai:grok-4.20-0309-reasoning", "xai:grok-4.20-0309-reasoning"],
        abilities: ["reasoning", "function_calling"],
        customIcon: "xai"
    },
    {
        id: "grok-4.20-0309-non-reasoning",
        name: "Grok 4.20 0309",
        shortName: "Grok 4.20",
        releaseOrder: 20250308,
        adapters: ["i3-xai:grok-4.20-0309-non-reasoning", "xai:grok-4.20-0309-non-reasoning"],
        abilities: ["function_calling"],
        customIcon: "xai"
    }
]
