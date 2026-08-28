import type { RegistryKey, SharedModel } from "./types"

const openRouterTextAdapters = (modelId: string): RegistryKey[] => [`openrouter:${modelId}`]

export const DEEPSEEK_MODELS: SharedModel[] = [
    {
        id: "deepseek-v4-pro-0813",
        name: "DeepSeek V4 Pro 0813",
        addedOn: "2026-08-12",
        shortName: "V4 Pro 0813",
        shortDescription: "GA V4 Pro checkpoint for deep reasoning, coding, and tool-driven work",
        description:
            "DeepSeek V4 Pro 0813 is the general-availability release of DeepSeek's large-scale mixture-of-experts flagship. Its million-token context, optional effort-controlled reasoning, and tool use suit difficult STEM problems, repository-scale coding, and involved workflows that benefit from a deeper pass.",
        releaseOrder: 20260813,
        adapters: openRouterTextAdapters("deepseek/deepseek-v4-pro-0813"),
        openrouterProvider: "deepseek",
        abilities: ["reasoning", "function_calling", "effort_control"],
        contextLength: 1_048_576,
        maxTokens: 384_000,
        inputUsdPer1MTokens: 0.435,
        outputUsdPer1MTokens: 0.87,
        supportsDisablingReasoning: true,
        reasoningEfforts: ["off", "low", "high"],
        developer: "DeepSeek"
    },
    {
        id: "deepseek-v4-flash-0731",
        name: "DeepSeek V4 Flash 0731",
        addedOn: "2026-07-31",
        shortName: "V4 Flash 0731",
        shortDescription: "July refresh tuned for fast coding, reasoning, and agent workflows",
        description:
            "DeepSeek V4 Flash 0731 refreshes the fast V4 model with new post-training for coding, reasoning, and agent work. It keeps the family's million-token context and sparse 13B-active-parameter design while adding controllable reasoning for jobs that need either a quick response or a deeper pass.",
        releaseOrder: 20260731,
        adapters: openRouterTextAdapters("deepseek/deepseek-v4-flash-0731"),
        openrouterProvider: "deepseek",
        abilities: ["reasoning", "function_calling", "effort_control"],
        contextLength: 1_048_576,
        maxTokens: 384_000,
        inputUsdPer1MTokens: 0.14,
        outputUsdPer1MTokens: 0.28,
        supportsDisablingReasoning: true,
        reasoningEfforts: ["off", "low", "high"],
        developer: "DeepSeek"
    },
    {
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        addedOn: "2026-04-24",
        shortName: "V4 Pro",
        shortDescription:
            "Preview V4 Pro release for deep reasoning and long-running coding agents",
        description:
            "DeepSeek V4 Pro was the preview release of DeepSeek's large-scale mixture-of-experts flagship, built to reason through difficult STEM problems, steer coding agents, and keep its footing across million-token projects. It remains available for workflows tied to the original checkpoint.",
        releaseOrder: 20251203,
        adapters: openRouterTextAdapters("deepseek/deepseek-v4-pro"),
        openrouterProvider: "deepseek",
        abilities: ["reasoning", "function_calling"],
        supportsDisablingReasoning: true,
        developer: "DeepSeek"
    },
    {
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        addedOn: "2026-04-24",
        shortName: "V4 Flash",
        shortDescription:
            "Quick, economical V4 reasoning with surprisingly capable agent instincts",
        description:
            "DeepSeek V4 Flash distills much of V4 Pro's reasoning and agent skill into a smaller, markedly faster model. Its million-token context and switchable thinking make it an unusually practical workhorse for chat, code, and tool-driven jobs that need to move.",
        releaseOrder: 20251202,
        adapters: openRouterTextAdapters("deepseek/deepseek-v4-flash"),
        openrouterProvider: "deepseek",
        abilities: ["reasoning", "function_calling"],
        supportsDisablingReasoning: true,
        developer: "DeepSeek"
    },
    {
        id: "deepseek-v3.2",
        name: "DeepSeek V3.2",
        shortName: "V3.2",
        shortDescription: "Reasoning-first open model that learned to think while using tools",
        description:
            "DeepSeek V3.2 was the family's first model to weave reasoning directly through tool use instead of treating tools as an afterthought. It remains a capable agentic daily driver, balancing deliberate answers with leaner inference than its Speciale sibling.",
        releaseOrder: 20251201,
        adapters: openRouterTextAdapters("deepseek/deepseek-v3.2"),
        abilities: ["reasoning", "function_calling"],
        contextLength: 163_840,
        maxTokens: 65_536,
        inputUsdPer1MTokens: 0.269,
        outputUsdPer1MTokens: 0.4,
        supportsDisablingReasoning: true,
        developer: "DeepSeek"
    },
    {
        id: "deepseek-v3.1-terminus",
        name: "DeepSeek V3.1 Terminus",
        shortName: "V3.1 Terminus",
        shortDescription: "Final V3.1 revision with steadier reasoning and agent behavior",
        description:
            "DeepSeek V3.1 Terminus is the final refinement of the V3.1 line, improving language consistency and agent behavior while retaining optional reasoning and tool use. It remains available for workflows that depend on this specific checkpoint.",
        releaseOrder: 20250922,
        adapters: openRouterTextAdapters("deepseek/deepseek-v3.1-terminus"),
        abilities: ["reasoning", "function_calling"],
        contextLength: 163_840,
        maxTokens: 32_768,
        inputUsdPer1MTokens: 0.27,
        outputUsdPer1MTokens: 1,
        supportsDisablingReasoning: true,
        developer: "DeepSeek",
        legacy: true,
        replacementId: "deepseek-v3.2"
    },
    {
        id: "deepseek-v3.1",
        name: "DeepSeek V3.1",
        shortName: "V3.1",
        shortDescription: "Hybrid reasoning model for coding, tools, and general chat",
        description:
            "DeepSeek V3.1 unified fast non-thinking responses and deliberate reasoning in one model, with strong coding and tool-use capabilities. It remains available for compatibility with conversations and workflows built around the original V3.1 release.",
        releaseOrder: 20250821,
        adapters: openRouterTextAdapters("deepseek/deepseek-chat-v3.1"),
        abilities: ["reasoning", "function_calling"],
        contextLength: 163_840,
        maxTokens: 32_768,
        inputUsdPer1MTokens: 0.25,
        outputUsdPer1MTokens: 0.95,
        supportsDisablingReasoning: true,
        developer: "DeepSeek",
        legacy: true,
        replacementId: "deepseek-v3.2"
    },
    {
        id: "deepseek-r1-0528",
        name: "DeepSeek R1 0528",
        shortName: "R1 0528",
        shortDescription: "Reasoning-focused R1 checkpoint updated for math, code, and tools",
        description:
            "DeepSeek R1 0528 is the May 2025 revision of DeepSeek's reasoning model, with stronger mathematical reasoning, coding, and tool use than the original R1. Its reasoning is always on, making it best suited to tasks where deliberation matters more than latency.",
        releaseOrder: 20250528,
        adapters: openRouterTextAdapters("deepseek/deepseek-r1-0528"),
        abilities: ["reasoning", "function_calling"],
        contextLength: 163_840,
        maxTokens: 32_768,
        inputUsdPer1MTokens: 0.5,
        outputUsdPer1MTokens: 2.15,
        developer: "DeepSeek",
        legacy: true,
        replacementId: "deepseek-v3.2"
    },
    {
        id: "deepseek-v3-0324",
        name: "DeepSeek V3 0324",
        shortName: "V3 0324",
        shortDescription: "March V3 checkpoint for efficient chat, coding, and tool use",
        description:
            "DeepSeek V3 0324 is the March 2025 checkpoint of the general-purpose V3 model. It offers efficient text generation, coding, structured output, and tool use without a reasoning mode, and remains available for compatibility with older workflows.",
        releaseOrder: 20250324,
        adapters: openRouterTextAdapters("deepseek/deepseek-chat-v3-0324"),
        abilities: ["function_calling"],
        contextLength: 163_840,
        maxTokens: 65_536,
        inputUsdPer1MTokens: 0.27,
        outputUsdPer1MTokens: 1.12,
        developer: "DeepSeek",
        legacy: true,
        replacementId: "deepseek-v3.2"
    }
]
