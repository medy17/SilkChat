import type { RegistryKey, SharedModel } from "./types"

const openRouterTextAdapters = (modelId: string): RegistryKey[] => [`openrouter:${modelId}`]

export const XIAOMI_MODELS: SharedModel[] = [
    {
        id: "mimo-v2.5-pro",
        name: "MiMo V2.5 Pro",
        shortName: "MiMo V2.5 Pro",
        shortDescription: "Million-token reasoning specialist for codebases that sprawl and agents that roam",
        description:
            "MiMo V2.5 Pro is Xiaomi's long-context specialist, giving coding and research agents room to work across a full million tokens. Choose it for deep repository exploration, difficult reasoning, and long runs where continuity matters more than a quick first word.",
        releaseOrder: 20260422,
        adapters: openRouterTextAdapters("xiaomi/mimo-v2.5-pro"),
        abilities: ["reasoning", "function_calling"],
        contextLength: 1_048_576,
        supportsDisablingReasoning: true,
        developer: "Xiaomi"
    },
    {
        id: "mimo-v2.5",
        name: "MiMo V2.5",
        shortName: "MiMo V2.5",
        shortDescription: "Visual all-rounder for reasoning, coding, and hands-on agent work",
        description:
            "MiMo V2.5 is the versatile member of Xiaomi's newer family, mixing vision with reasoning and tool use in a roomy 256K context. It is a natural fit for everyday coding agents, visual troubleshooting, and tasks that bounce between screenshots and source.",
        releaseOrder: 20260423,
        adapters: openRouterTextAdapters("xiaomi/mimo-v2.5"),
        abilities: ["reasoning", "vision", "function_calling"],
        contextLength: 262_144,
        supportsDisablingReasoning: true,
        developer: "Xiaomi"
    },
    {
        id: "mimo-v2-flash",
        name: "MiMo V2 Flash",
        shortName: "MiMo V2 Flash",
        shortDescription: "Lean, quick reasoning model trained to code and act at scale",
        description:
            "MiMo V2 Flash is an efficiency-minded agent model with serious coding and reasoning training behind its small active footprint. Hybrid attention and native speculative decoding keep it quick, while large-scale agentic reinforcement learning gives it more initiative than its price suggests.",
        releaseOrder: 20251214,
        adapters: openRouterTextAdapters("xiaomi/mimo-v2-flash"),
        abilities: ["reasoning", "function_calling"],
        contextLength: 262_144,
        supportsDisablingReasoning: true,
        developer: "Xiaomi",
        legacy: true,
        sunsetOn: "2026-06-30",
        replacementId: "mimo-v2.5"
    },
    {
        id: "mimo-v2-pro",
        name: "MiMo V2 Pro",
        shortName: "MiMo V2 Pro",
        shortDescription: "Long-context coding heavyweight for deep, deliberate agent runs",
        description:
            "MiMo V2 Pro stretches Xiaomi's reasoning and coding stack across a million-token context. It was built for the sort of repository-scale analysis and autonomous engineering where a faster model may sprint ahead and forget why it started.",
        releaseOrder: 20260318,
        adapters: openRouterTextAdapters("xiaomi/mimo-v2-pro"),
        abilities: ["reasoning", "function_calling"],
        contextLength: 1_048_576,
        supportsDisablingReasoning: true,
        developer: "Xiaomi",
        legacy: true,
        sunsetOn: "2026-06-30",
        replacementId: "mimo-v2.5-pro"
    },
    {
        id: "mimo-v2-omni",
        name: "MiMo V2 Omni",
        shortName: "MiMo V2 Omni",
        shortDescription: "Vision-aware MiMo agent for code, screens, and everything between",
        description:
            "MiMo V2 Omni adds eyes to the V2 agent family, combining visual understanding with reasoning, coding, and tool use. It is the practical choice for UI work, screenshot-led debugging, document inspection, and mixed text-and-image workflows.",
        releaseOrder: 20260318,
        adapters: openRouterTextAdapters("xiaomi/mimo-v2-omni"),
        abilities: ["reasoning", "vision", "function_calling"],
        contextLength: 262_144,
        supportsDisablingReasoning: true,
        developer: "Xiaomi",
        legacy: true,
        sunsetOn: "2026-06-30",
        replacementId: "mimo-v2.5"
    }
]
