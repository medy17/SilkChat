import type { SharedModel } from "./types"

export const TOOL_SELECTION_MODEL = {
    id: "jev-1.13",
    name: "Jev 1.13",
    shortName: "Jev 1.13",
    developer: "TypeSafe",
    addedOn: "2026-09-18",
    adapters: ["openrouter:typesafe/jev-1.13"],
    abilities: [],
    mode: "decision",
    skillSelection: {
        thresholds: {
            web_search: 0.85,
            code_execution: 0.85,
            memory: 0.85,
            math: 0.85,
            image_generation: 0.85,
            // Presentation-only instructions expose no executable tools.
            diagrams: 0.75,
            recipes: 0.75,
            canvas: 0.75
        },
        prohibitionThresholds: {
            web_search: 0.5,
            code_execution: 0.5
        }
    },
    contextLength: 32_000,
    inputUsdPer1MTokens: 0.042,
    outputUsdPer1MTokens: 0,
    description:
        "TypeSafe's structured decision model returns probabilities for typed questions. SilkChat uses it to select opening-turn skills."
} satisfies SharedModel

export const TYPESAFE_MODELS: SharedModel[] = [TOOL_SELECTION_MODEL]
