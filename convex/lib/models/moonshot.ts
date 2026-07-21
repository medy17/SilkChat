import type { RegistryKey, SharedModel } from "./types"

const openRouterTextAdapters = (modelId: string): RegistryKey[] => [`openrouter:${modelId}`]

export const MOONSHOT_MODELS: SharedModel[] = [
    {
        id: "kimi-k3",
        name: "Kimi K3",
        addedOn: "2026-07-16",
        shortName: "K3",
        shortDescription: "Massive multimodal thinker for deep work that refuses to stay small",
        description:
            "Kimi K3 is Moonshot's 2.8-trillion-parameter frontier model, natively multimodal and built around a million-token context. It is made for long-horizon coding, knowledge work, and deep reasoning where the trail is too long for a lightweight model.",
        releaseOrder: 20260716,
        adapters: openRouterTextAdapters("moonshotai/kimi-k3"),
        abilities: ["reasoning", "vision", "function_calling"],
        developer: "Moonshot AI"
    },
    {
        id: "kimi-k2.6",
        name: "Kimi K2.6",
        addedOn: "2026-04-20",
        shortName: "K2.6",
        shortDescription: "Multimodal agent with sharp code instincts and flexible thinking modes",
        description:
            "Kimi K2.6 brings native multimodal understanding to Moonshot's agentic line, with strong coding and the ability to preserve its thinking across long tool-driven runs. It is a lively all-rounder for building, researching, and working through visual material.",
        releaseOrder: 20260420,
        adapters: openRouterTextAdapters("moonshotai/kimi-k2.6"),
        abilities: ["reasoning", "vision", "function_calling"],
        supportsDisablingReasoning: true,
        developer: "Moonshot AI"
    },
    {
        id: "kimi-k2.5",
        name: "Kimi K2.5",
        addedOn: "2026-01-27",
        shortName: "K2.5",
        shortDescription: "A versatile visual reasoning agent with a knack for real work",
        description:
            "Kimi K2.5 turns the K2 lineage into a multimodal working partner: it can reason over images, write and debug code, and coordinate tools through involved tasks. It is equally comfortable inspecting a screenshot, researching a question, or shipping the result.",
        releaseOrder: 20260127,
        adapters: openRouterTextAdapters("moonshotai/kimi-k2.5"),
        abilities: ["reasoning", "vision", "function_calling"],
        supportsDisablingReasoning: true,
        developer: "Moonshot AI"
    },
    {
        id: "kimi-k2-0905",
        name: "Kimi K2 0905",
        addedOn: "2025-09-05",
        shortName: "K2 0905",
        shortDescription: "Fast open agent model with coding chops and little patience for ceremony",
        description:
            "Kimi K2 0905 is the brisk, non-thinking K2 update that sharpened agentic coding and stretched context to 256K. It does not linger over a chain of thought; it reads the room, calls the tools, and gets on with the job.",
        releaseOrder: 20250904,
        adapters: openRouterTextAdapters("moonshotai/kimi-k2-0905"),
        abilities: ["function_calling"],
        developer: "Moonshot AI"
    }
]
