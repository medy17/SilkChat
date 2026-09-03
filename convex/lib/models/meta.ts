import type { RegistryKey, SharedModel } from "./types"

const groqTextAdapters = (modelId: string, openRouterModelId?: string): RegistryKey[] => [
    `i3-groq:${modelId}`,
    `groq:${modelId}`,
    ...(openRouterModelId ? ([`openrouter:${openRouterModelId}`] as RegistryKey[]) : [])
]

const openRouterTextAdapters = (modelId: string): RegistryKey[] => [`openrouter:${modelId}`]

export const META_MODELS: SharedModel[] = [
    {
        id: "muse-spark-1.3",
        name: "Muse Spark 1.3",
        addedOn: "2026-09-03",
        shortName: "Muse Spark 1.3",
        shortDescription:
            "Latest Muse checkpoint for concise long-running work, conflicting inputs, and clarification-aware execution",
        description:
            "Muse Spark 1.3 is Meta's latest multimodal reasoning checkpoint for long-running coding and multi-agent workflows. It is designed to retain information across extended tasks, reconcile conflicting inputs, and pause for clarification or confirmation when requirements are uncertain.",
        releaseOrder: 20260902,
        adapters: openRouterTextAdapters("meta/muse-spark-1.3"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        contextLength: 1_048_576,
        maxTokens: 943_718,
        inputUsdPer1MTokens: 1.25,
        outputUsdPer1MTokens: 4.25,
        reasoningEfforts: ["minimal", "low", "medium", "high"],
        defaultReasoningEffort: "medium",
        developer: "Meta",
        customIcon: "meta"
    },
    {
        id: "muse-spark-1.2",
        name: "Muse Spark 1.2",
        addedOn: "2026-08-05",
        shortName: "Muse Spark 1.2",
        shortDescription:
            "Previous Muse checkpoint for planning, delegation, and parallel coding work",
        description:
            "Muse Spark 1.2 is Meta's previous multimodal reasoning checkpoint, centered on agent orchestration. It can plan and delegate as a lead agent or execute in parallel as a subagent, with particular strength in multi-file refactors, extended debugging, and whole-repository generation.",
        releaseOrder: 20260805,
        adapters: openRouterTextAdapters("meta/muse-spark-1.2"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        contextLength: 1_048_576,
        maxTokens: 943_718,
        inputUsdPer1MTokens: 1.25,
        outputUsdPer1MTokens: 4.25,
        reasoningEfforts: ["minimal", "low", "medium", "high"],
        defaultReasoningEffort: "medium",
        developer: "Meta",
        customIcon: "meta"
    },
    {
        id: "muse-spark-1.1",
        name: "Muse Spark 1.1",
        addedOn: "2026-07-09",
        shortName: "Muse Spark 1.1",
        shortDescription:
            "Fast multimodal agent that plans broadly, delegates well, and gets moving",
        description:
            "Muse Spark 1.1 is Meta's nimble multimodal reasoning model for coding, computer use, and ambitious agentic work. It can manage a million-token context, coordinate subagents, and move fluidly between seeing, planning, scripting, and clicking.",
        releaseOrder: 20260716,
        adapters: openRouterTextAdapters("meta/muse-spark-1.1"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        reasoningEfforts: ["minimal", "low", "medium", "high"],
        defaultReasoningEffort: "medium",
        developer: "Meta",
        customIcon: "meta"
    },
    {
        id: "llama-4-scout-17b-16e-instruct",
        name: "Llama 4 Scout 17B 16E",
        addedOn: "2025-04-05",
        shortName: "Scout 17B",
        shortDescription: "Compact multimodal scout with an almost absurd appetite for context",
        description:
            "Llama 4 Scout is Meta's efficient, open-weight multimodal explorer: 17B active parameters, 16 experts, and exceptional long-context reach. It is well suited to combing through document collections, large codebases, and image-rich prompts without bringing heavyweight serving demands.",
        releaseOrder: 20250404,
        adapters: groqTextAdapters(
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "meta-llama/llama-4-scout"
        ),
        abilities: ["vision"],
        customIcon: "meta"
    },
    {
        id: "llama-4-maverick-17b-128e-instruct",
        name: "Llama 4 Maverick 17B 128E Instruct",
        addedOn: "2025-04-05",
        shortName: "Maverick 17B",
        shortDescription:
            "Creative multimodal workhorse with sharper reasoning and a larger expert bench",
        description:
            "Llama 4 Maverick is Meta's open-weight generalist for high-quality chat, creative writing, coding, and precise image understanding. Its 128-expert mixture gives it more range than Scout while keeping only 17B parameters active at a time.",
        releaseOrder: 20250405,
        adapters: groqTextAdapters(
            "meta-llama/llama-4-maverick-17b-128e-instruct",
            "meta-llama/llama-4-maverick"
        ),
        abilities: ["vision"],
        customIcon: "meta"
    },
    {
        id: "llama-3-1-8b-instant",
        name: "Llama 3.1 8B Instant",
        addedOn: "2024-07-23",
        shortName: "Llama 3.1 8B",
        shortDescription: "Small, speedy open model for straightforward chat and text work",
        description:
            "Llama 3.1 8B Instant is a compact open model that favors responsiveness over theatrics. It is a dependable fit for summaries, extraction, classification, drafting, and conversational jobs that do not need a frontier model warming up in the wings.",
        releaseOrder: 20240723,
        adapters: groqTextAdapters("llama-3.1-8b-instant"),
        abilities: [],
        customIcon: "meta"
    },
    {
        id: "whisper-large-v3-turbo",
        name: "Whisper Large v3 Turbo",
        addedOn: "2024-10-01",
        releaseOrder: 20240301,
        adapters: ["groq:whisper-large-v3-turbo"],
        abilities: [],
        mode: "speech-to-text"
    }
]
