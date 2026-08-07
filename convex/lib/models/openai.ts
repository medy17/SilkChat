import type { RegistryKey, SharedModel } from "./types"

const openAiTextAdapters = (modelId: string, openRouterModelId = modelId): RegistryKey[] => [
    `i3-openai:${modelId}`,
    `openai:${modelId}`,
    `openrouter:openai/${openRouterModelId}`
]

const FREE_ACCESS = {
    availableToPickFor: "free"
} satisfies Pick<SharedModel, "availableToPickFor">

const FREE_WITHOUT_REASONING_ACCESS = {
    availableToPickFor: "free",
    availableToPickForReasoningEfforts: {
        low: "pro",
        medium: "pro",
        high: "pro"
    }
} satisfies Pick<SharedModel, "availableToPickFor" | "availableToPickForReasoningEfforts">

export const OPENAI_MODELS: SharedModel[] = [
    {
        id: "gpt-5.6-sol",
        name: "GPT 5.6 Sol",
        addedOn: "2026-07-09",
        shortName: "5.6 Sol",
        shortDescription: "Flagship GPT-5.6 model for complex reasoning, coding, and agents",
        description:
            "GPT 5.6 Sol is the flagship GPT-5.6 model, built for complex reasoning, coding, multimodal input, tool use, and long-horizon agentic workflows.",
        developer: "OpenAI",
        artificialAnalysis: {
            type: "llm",
            slug: "gpt-5-6-sol"
        },
        releaseOrder: 20261026,
        adapters: openAiTextAdapters("gpt-5.6-sol"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true
    },
    {
        id: "gpt-5.6-terra",
        name: "GPT 5.6 Terra",
        addedOn: "2026-07-09",
        shortName: "5.6 Terra",
        shortDescription: "Balanced GPT-5.6 model for everyday coding, reasoning, and agents",
        description:
            "GPT 5.6 Terra is the balanced GPT-5.6 model, positioned for everyday coding, reasoning, multimodal input, tool use, and agentic tasks where capability and cost both matter.",
        developer: "OpenAI",
        artificialAnalysis: {
            type: "llm",
            slug: "gpt-5-6-terra"
        },
        releaseOrder: 20261025,
        adapters: openAiTextAdapters("gpt-5.6-terra"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS
    },
    {
        id: "gpt-5.6-luna",
        name: "GPT 5.6 Luna",
        addedOn: "2026-07-09",
        shortName: "5.6 Luna",
        shortDescription: "Fast, cost-efficient GPT-5.6 model for high-volume workflows",
        description:
            "GPT 5.6 Luna is the fast, cost-efficient GPT-5.6 model, suited for high-volume chat, classification, lightweight agentic workflows, multimodal input, and tool use.",
        developer: "OpenAI",
        artificialAnalysis: {
            type: "llm",
            slug: "gpt-5-6-luna"
        },
        releaseOrder: 20261024,
        adapters: openAiTextAdapters("gpt-5.6-luna"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS
    },
    {
        id: "gpt-5.5",
        name: "GPT 5.5",
        addedOn: "2026-04-23",
        shortName: "5.5",
        shortDescription: "Premium OpenAI model for high-quality chat, multimodal input, and tools",
        description:
            "GPT 5.5 is a premium OpenAI model for high-quality chat, multimodal input, and tool use. It remains capable and token-efficient, with GPT 5.6 Sol now occupying the flagship tier.",
        developer: "OpenAI",
        artificialAnalysis: {
            type: "llm",
            slug: "gpt-5-5"
        },
        releaseOrder: 20261023,
        adapters: openAiTextAdapters("gpt-5.5"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS
    },
    {
        id: "gpt-5.4-nano",
        name: "GPT 5.4 nano",
        shortName: "5.4-nano",
        shortDescription: "Smallest GPT-5.4 variant for fast, low-cost text and tool use",
        description:
            "GPT 5.4 nano is the lightest GPT-5.4 model, tuned for low-latency chat, lightweight automations, and high-volume workloads where speed and cost matter more than deep reasoning depth.",
        developer: "OpenAI",
        artificialAnalysis: {
            type: "llm",
            slug: "gpt-5-4-nano"
        },
        releaseOrder: 20261022,
        adapters: openAiTextAdapters("gpt-5.4-nano"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS,
        legacy: true
    },
    {
        id: "gpt-5.4-mini",
        name: "GPT 5.4 mini",
        shortName: "5.4-mini",
        shortDescription: "Balanced GPT-5.4 model for everyday chat, search, and tool use",
        description:
            "GPT 5.4 mini balances quality, speed, and cost for everyday assistant workflows. It is a practical default when you want strong multimodal and tool-calling support without paying for the largest GPT-5.4 tier.",
        developer: "OpenAI",
        artificialAnalysis: {
            type: "llm",
            slug: "gpt-5-4-mini"
        },
        releaseOrder: 20261021,
        adapters: openAiTextAdapters("gpt-5.4-mini"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS,
        legacy: true
    },
    {
        id: "gpt-5.4",
        name: "GPT 5.4",
        shortName: "5.4",
        shortDescription: "Fast OpenAI model for everyday chat and tools",
        description:
            "GPT 5.4 is a fast flagship-style OpenAI model aimed at high-quality chat, multimodal input, and tool use. It works well as a strong default when you want broad capability without switching into a more specialized reasoning-first model.",
        developer: "OpenAI",
        artificialAnalysis: {
            type: "llm",
            slug: "gpt-5-4"
        },
        releaseOrder: 20261020,
        adapters: openAiTextAdapters("gpt-5.4"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS,
        legacy: true
    },
    {
        id: "gpt-5.3",
        name: "GPT 5.3",
        shortName: "5.3",
        shortDescription: "Smooth conversational GPT tuned for useful answers without the verbal speed bumps",
        description:
            "GPT 5.3 is an everyday conversational model tuned for better judgment, richer web-grounded answers, and a more natural flow. It spends less time hedging at the doorway and more time helping, making it a polished choice for chat, search, and practical multimodal work.",
        releaseOrder: 20261019,
        adapters: openAiTextAdapters("gpt-5.3", "gpt-5.3-chat"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS,
        legacy: true,
        sunsetOn: "2026-08-10",
        replacementId: "gpt-5.5"
    },
    {
        id: "gpt-5.2",
        name: "GPT 5.2",
        shortName: "5.2",
        shortDescription: "Professional-grade reasoner for polished artifacts and long-running agents",
        description:
            "GPT 5.2 is built for work with a finish line: complex code, long documents, spreadsheets, presentations, and agents that must carry a project end to end. It combines strong long-context reasoning, vision, and tool calling with a knack for producing deliverables that look ready for the meeting.",
        releaseOrder: 20261018,
        adapters: openAiTextAdapters("gpt-5.2"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS,
        legacy: true,
        sunsetOn: "2026-08-10",
        replacementId: "gpt-5.5"
    },
    {
        id: "gpt-5.1",
        name: "GPT 5.1",
        shortName: "5.1",
        shortDescription: "Warmer, more adaptable GPT that knows when to answer and when to think",
        description:
            "GPT 5.1 made the GPT-5 family more conversational without sanding away its intelligence. Adaptive reasoning lets it stay brisk on simple questions and dig in on difficult ones, while stronger instruction-following keeps the result closer to the tone and shape you asked for.",
        releaseOrder: 20261017,
        adapters: openAiTextAdapters("gpt-5.1"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS,
        legacy: true,
        sunsetOn: "2026-07-23",
        replacementId: "gpt-5.5"
    },
    {
        id: "gpt-5",
        name: "GPT 5",
        shortName: "5",
        shortDescription: "OpenAI's original unified reasoner for coding, tools, and serious general work",
        description:
            "GPT 5 brought OpenAI's fast responses and deeper reasoning into one versatile model family. It is a confident generalist for coding, multimodal analysis, and tool-rich workflows, with controls that let the task—not the model picker—decide how much thought to spend.",
        releaseOrder: 20261014,
        adapters: openAiTextAdapters("gpt-5"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        ...FREE_WITHOUT_REASONING_ACCESS,
        legacy: true,
        sunsetOn: "2026-12-11",
        replacementId: "gpt-5.5"
    },
    {
        id: "gpt-5-mini",
        name: "GPT 5 mini",
        shortName: "5-mini",
        shortDescription: "Compact GPT-5 reasoning for everyday agents that mind the budget",
        description:
            "GPT 5 mini packages the family's reasoning, vision, and tool skills into a quicker, more economical model. It is the sensible daily driver for coding assistants, support flows, and busy automations that need good judgment more often than maximum horsepower.",
        releaseOrder: 20261013,
        adapters: openAiTextAdapters("gpt-5-mini"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        ...FREE_WITHOUT_REASONING_ACCESS,
        legacy: true,
        sunsetOn: "2026-12-11",
        replacementId: "gpt-5.4-mini"
    },
    {
        id: "gpt-5-nano",
        name: "GPT 5 nano",
        shortName: "5-nano",
        shortDescription: "Tiny GPT-5 built to classify, extract, and respond before the kettle boils",
        description:
            "GPT 5 nano is the smallest and fastest GPT-5 variant, made for high-volume work where latency and cost dominate the brief. Give it classification, extraction, routing, concise summaries, or lightweight tool calls and let the larger models keep sleeping.",
        releaseOrder: 20261012,
        adapters: openAiTextAdapters("gpt-5-nano"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        ...FREE_WITHOUT_REASONING_ACCESS,
        legacy: true,
        sunsetOn: "2026-12-11",
        replacementId: "gpt-5.4-nano"
    },
    {
        id: "o4-mini-high",
        name: "o4 mini high",
        shortName: "o4-mini-high",
        shortDescription: "Small visual reasoner allowed to think harder before showing its work",
        description:
            "o4 mini high is o4-mini with the reasoning dial already turned up. It trades a little more time and compute for stronger answers in math, code, science, and visual problem-solving while retaining the smaller model's efficient bones.",
        releaseOrder: 20261011,
        adapters: openAiTextAdapters("o4-mini-high"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf"],
        legacy: true
    },
    {
        id: "o3",
        name: "o3",
        shortName: "o3",
        shortDescription: "Rigorous visual reasoner for the problems whose answers are not obvious",
        description:
            "o3 is a deliberate reasoning model with particular strength in coding, math, science, and visual analysis. It can think with images and plan across tools, making it a fine companion for tangled questions that reward a careful hypothesis more than a quick guess.",
        releaseOrder: 20261010,
        adapters: openAiTextAdapters("o3"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        legacy: true,
        sunsetOn: "2026-12-11",
        replacementId: "gpt-5.5"
    },
    {
        id: "o4-mini",
        name: "o4 mini",
        shortName: "o4-mini",
        shortDescription: "Fast, frugal reasoning with outsized talent for math, code, and images",
        description:
            "o4-mini is a compact reasoning model that punches well above its weight on math, coding, and visual tasks. It combines tool-aware thinking with high throughput, so you can afford to use real reasoning on more than just the ceremonial hard problems.",
        releaseOrder: 20261009,
        adapters: openAiTextAdapters("o4-mini"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        legacy: true,
        sunsetOn: "2026-10-23",
        replacementId: "gpt-5.4-mini"
    },
    {
        id: "gpt-4.1",
        name: "GPT 4.1",
        shortName: "4.1",
        shortDescription: "Long-context coding specialist that follows the brief down to the semicolon",
        description:
            "GPT 4.1 is a practical developer model with major gains in coding, instruction-following, and million-token context. It is at home inside large repositories and document piles, reliably finding the relevant detail without getting distracted by all the furniture around it.",
        releaseOrder: 20261008,
        adapters: openAiTextAdapters("gpt-4.1"),
        abilities: ["vision", "function_calling", "native_pdf"],
        ...FREE_ACCESS,
        legacy: true
    },
    {
        id: "gpt-4.1-mini",
        name: "GPT 4.1 mini",
        shortName: "4.1-mini",
        shortDescription: "Quick million-token generalist with near-flagship intelligence and much lighter luggage",
        description:
            "GPT 4.1 mini is the family's sweet spot: strong coding, vision, and instruction-following with lower latency and cost than the flagship. Its million-token context makes it unusually capable of reading the whole project before offering to rearrange it.",
        releaseOrder: 20261007,
        adapters: openAiTextAdapters("gpt-4.1-mini"),
        abilities: ["vision", "function_calling", "native_pdf"],
        ...FREE_ACCESS,
        legacy: true
    },
    {
        id: "gpt-4.1-nano",
        name: "GPT 4.1 nano",
        shortName: "4.1-nano",
        shortDescription: "OpenAI's fastest 4.1 model for brisk, precise work at scale",
        description:
            "GPT 4.1 nano is the fleet-footed member of the 4.1 family, tuned for classification, completion, retrieval, and other latency-sensitive jobs. It keeps the million-token window and multimodal input, an impressively large desk for such a small model.",
        releaseOrder: 20261006,
        adapters: openAiTextAdapters("gpt-4.1-nano"),
        abilities: ["vision", "function_calling", "native_pdf"],
        ...FREE_ACCESS,
        legacy: true,
        sunsetOn: "2026-10-23",
        replacementId: "gpt-5.4-nano"
    },
    {
        id: "gpt-4.5-preview",
        name: "GPT 4.5 Preview",
        shortName: "4.5 Preview",
        shortDescription: "Thoughtful, creative conversationalist with unusually good taste and emotional antennae",
        description:
            "GPT 4.5 Preview is a large, general-purpose model prized less for step-by-step reasoning than for broad knowledge, natural conversation, creative instinct, and social nuance. It is the model you invite when the work needs judgment and voice, not just an answer key.",
        releaseOrder: 20261005,
        adapters: openAiTextAdapters("gpt-4.5-preview"),
        abilities: ["vision", "function_calling", "native_pdf"],
        ...FREE_ACCESS,
        legacy: true,
        sunsetOn: "2025-07-14",
        replacementId: "gpt-4.1"
    },
    {
        id: "o3-mini-high",
        name: "o3 mini high",
        shortName: "o3-mini-high",
        shortDescription: "Compact STEM reasoner given extra room to wrestle with the hard parts",
        description:
            "o3 mini high is the more contemplative setting of OpenAI's small STEM reasoner. It spends additional compute on math, science, and coding problems, favoring a sturdier solution over the fastest path to the final line.",
        releaseOrder: 20261004,
        adapters: openAiTextAdapters("o3-mini-high"),
        abilities: ["reasoning", "function_calling"],
        legacy: true
    },
    {
        id: "o3-mini",
        name: "o3 mini",
        shortName: "o3-mini",
        shortDescription: "Lean STEM reasoning for code, calculations, and technical questions on repeat",
        description:
            "o3-mini is a cost-efficient reasoning model focused on coding, math, and science. Adjustable effort lets it move quickly through routine technical work or pause for a more careful derivation when the equations start looking unfriendly.",
        releaseOrder: 20261003,
        adapters: openAiTextAdapters("o3-mini"),
        abilities: ["reasoning", "function_calling", "effort_control"],
        legacy: true,
        sunsetOn: "2026-10-23",
        replacementId: "gpt-5.5"
    },
    {
        id: "gpt-4o",
        name: "GPT 4o",
        shortName: "4o",
        shortDescription: "The original omni model: quick, expressive, and at ease with images",
        description:
            "GPT 4o is OpenAI's original omni flagship, combining capable text work with fast, fluid image understanding. It remains a warm and versatile conversationalist for writing, analysis, translation, and the moments when showing the model is easier than explaining.",
        releaseOrder: 20261001,
        adapters: openAiTextAdapters("gpt-4o"),
        abilities: ["vision", "function_calling", "native_pdf"],
        ...FREE_ACCESS,
        legacy: true
    },
    {
        id: "gpt-4o-mini",
        name: "GPT 4o mini",
        shortName: "4o-mini",
        shortDescription: "Affordable multimodal intelligence for busy apps and everyday conversations",
        description:
            "GPT 4o mini made multimodal intelligence cheap enough to use everywhere. It is a nimble choice for support, extraction, translation, lightweight vision, and high-volume chat—less grand piano, more excellent pocket keyboard.",
        releaseOrder: 20261002,
        adapters: openAiTextAdapters("gpt-4o-mini"),
        abilities: ["vision", "function_calling", "native_pdf"],
        ...FREE_ACCESS,
        legacy: true
    }
]
