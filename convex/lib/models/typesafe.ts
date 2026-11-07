import type { SharedModel } from "./types"

export const DECISION_MODEL = {
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
            // Live evals: explicit requests score 0.87-0.98 and decoys at most 0.35, but a
            // request naming the tool to show it off scores 0.69-0.77. Math requests
            // (0.77-0.84) also preload it alongside Math Kit; preloading forces nothing.
            code_execution: 0.65,
            memory: 0.85,
            // Live evals: clear requests score 0.92-0.98, a show-off request naming charts
            // 0.79-0.81, and decoys (chart advice, plain arithmetic) at most 0.44.
            math: 0.75,
            image_generation: 0.85,
            // Presentation-only instructions expose no executable tools.
            diagrams: 0.75,
            recipes: 0.75,
            roleplay: 0.75,
            // Live evals: requests for something to operate score 0.72-0.95, and
            // questions a text answer serves score at most 0.55. A miss still leaves the
            // chat model's own load_skill.
            canvas: 0.65
        },
        // Live evals: clear work on a repo or account scores 0.64-0.93, and decoys on the same
        // subjects at most 0.31. It sits low because a miss is costly: with the tool off,
        // load_skill can't recover it, and preloading forces nothing.
        computerWorkThreshold: 0.4,
        prohibitionThresholds: {
            web_search: 0.5,
            code_execution: 0.5
        }
    },
    // Clear cases score ~1.0 in scripts/evals/opening-verbosity.ts; borderline
    // requests (e.g. a cover letter at 0.77 "longer") keep the usual length.
    verbositySelection: {
        thresholds: {
            less: 0.85,
            more: 0.85
        }
    },
    contextLength: 32_000,
    inputUsdPer1MTokens: 0.042,
    outputUsdPer1MTokens: 0,
    description:
        "TypeSafe's structured decision model returns probabilities for typed questions. SilkChat uses it to select opening-turn skills and reply length."
} satisfies SharedModel

export const TYPESAFE_MODELS: SharedModel[] = [DECISION_MODEL]
