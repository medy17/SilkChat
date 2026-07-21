import type { RegistryKey, SharedModel } from "./types"

const openRouterTextAdapters = (modelId: string): RegistryKey[] => [`openrouter:${modelId}`]

export const DEEPSEEK_MODELS: SharedModel[] = [
    {
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        addedOn: "2026-04-24",
        shortName: "DS V4 Pro",
        shortDescription: "Open-weight heavyweight for deep reasoning and long-running coding agents",
        description:
            "DeepSeek V4 Pro is the heavyweight of the V4 pair: a 1.6-trillion-parameter mixture-of-experts model built to reason through difficult STEM problems, steer coding agents, and keep its footing across million-token projects. It is the one to pick when the problem deserves more thought than haste.",
        releaseOrder: 20251203,
        adapters: openRouterTextAdapters("deepseek/deepseek-v4-pro"),
        abilities: ["reasoning", "function_calling"],
        supportsDisablingReasoning: true,
        developer: "DeepSeek"
    },
    {
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        addedOn: "2026-04-24",
        shortName: "DS V4 Flash",
        shortDescription: "Quick, economical V4 reasoning with surprisingly capable agent instincts",
        description:
            "DeepSeek V4 Flash distills much of V4 Pro's reasoning and agent skill into a smaller, markedly faster model. Its million-token context and switchable thinking make it an unusually practical workhorse for chat, code, and tool-driven jobs that need to move.",
        releaseOrder: 20251202,
        adapters: openRouterTextAdapters("deepseek/deepseek-v4-flash"),
        abilities: ["reasoning", "function_calling"],
        supportsDisablingReasoning: true,
        developer: "DeepSeek"
    },
    {
        id: "deepseek-v3.2",
        name: "DeepSeek V3.2",
        shortName: "DS V3.2",
        shortDescription: "Reasoning-first open model that learned to think while using tools",
        description:
            "DeepSeek V3.2 was the family's first model to weave reasoning directly through tool use instead of treating tools as an afterthought. It remains a capable agentic daily driver, balancing deliberate answers with leaner inference than its Speciale sibling.",
        releaseOrder: 20251201,
        adapters: openRouterTextAdapters("deepseek/deepseek-v3.2"),
        abilities: ["reasoning", "function_calling"],
        supportsDisablingReasoning: true,
        developer: "DeepSeek",
        legacy: true,
        replacementId: "deepseek-v4-flash"
    }
]
