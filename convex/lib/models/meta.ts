import type { RegistryKey, SharedModel } from "./types"

const openRouterTextAdapters = (modelId: string): RegistryKey[] => [`openrouter:${modelId}`]

export const META_MODELS: SharedModel[] = [
    {
        id: "muse-spark-open",
        name: "Muse Spark Open",
        addedOn: "2026-10-15",
        shortName: "Muse Spark Open",
        shortDescription:
            "Meta's open-weight Muse Spark release, tuned for coding with dependable tool calls",
        description:
            "Muse Spark Open is the open-weight release of Meta's Muse Spark line, an 816B-parameter mixture-of-experts model with 42B active per token, given extra safety post-training before release. It lands first attempts more often, calls tools reliably, and keeps track of large codebases, which suits repository-wide changes, debugging, and code review.",
        releaseOrder: 20261015,
        artificialAnalysis: {
            type: "llm",
            slug: "muse-spark-open"
        },
        adapters: openRouterTextAdapters("meta/muse-spark-open"),
        preferredOpenRouterProviders: ["fireworks", "together"],
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        contextLength: 1_048_576,
        maxTokens: 943_718,
        inputUsdPer1MTokens: 1.25,
        outputUsdPer1MTokens: 4.25,
        reasoningEfforts: ["low", "medium", "high"],
        defaultReasoningEffort: "medium",
        developer: "Meta",
        customIcon: "meta"
    },
    {
        id: "muse-wonder",
        name: "Muse Wonder",
        addedOn: "2026-10-12",
        shortName: "Muse Wonder",
        shortDescription:
            "Meta's first frontier Muse model, for hard multi-step work across text, images, and PDFs",
        description:
            "Muse Wonder is Meta's first frontier model and the top tier of the Muse family. It reasons over text, images, and PDFs within a million-token context, switches approach when a hard problem stalls, and checks in before consequential actions. It fits intricate research, multi-file engineering, and tool-heavy work where a stronger first pass saves rework.",
        releaseOrder: 20261012,
        artificialAnalysis: {
            type: "llm",
            slug: "muse-wonder"
        },
        adapters: openRouterTextAdapters("meta/muse-wonder"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        contextLength: 1_048_576,
        maxTokens: 943_718,
        inputUsdPer1MTokens: 4,
        outputUsdPer1MTokens: 20,
        reasoningEfforts: ["minimal", "low", "medium", "high"],
        defaultReasoningEffort: "medium",
        developer: "Meta",
        customIcon: "meta"
    },
    {
        id: "muse-spark-1.3",
        name: "Muse Spark 1.3",
        addedOn: "2026-09-03",
        shortName: "Muse Spark 1.3",
        shortDescription:
            "Latest Muse Spark checkpoint for concise long-running work, conflicting inputs, and clarification-aware execution",
        description:
            "Muse Spark 1.3 is the latest checkpoint of Meta's Muse Spark model, for long-running coding and multi-agent workflows. It is designed to retain information across extended tasks, reconcile conflicting inputs, and pause for clarification or confirmation when requirements are uncertain.",
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
        customIcon: "meta",
        replacementId: "muse-spark-1.3"
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
        customIcon: "meta",
        replacementId: "muse-spark-1.2"
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
        adapters: openRouterTextAdapters("meta-llama/llama-4-scout"),
        abilities: ["vision"],
        developer: "Meta",
        customIcon: "meta",
        legacy: true,
        replacementId: "muse-spark-open"
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
        adapters: openRouterTextAdapters("meta-llama/llama-4-maverick"),
        abilities: ["vision"],
        developer: "Meta",
        customIcon: "meta",
        legacy: true,
        replacementId: "muse-spark-open"
    }
]
