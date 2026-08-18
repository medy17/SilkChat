import type { RegistryKey, SharedModel } from "./types"

const openRouterTextAdapters = (modelId: string): RegistryKey[] => [`openrouter:${modelId}`]

export const ZAI_MODELS: SharedModel[] = [
    {
        id: "glm-5.3",
        name: "GLM 5.3",
        addedOn: "2026-08-18",
        shortName: "GLM 5.3",
        shortDescription:
            "Million-token reasoning flagship for complex software engineering and sustained agent work",
        description:
            "GLM 5.3 is Z.ai's large-scale reasoning model for complex software engineering and sustained agent work. Its million-token context, 131K-token output ceiling, tool use, and controllable reasoning suit repository-wide changes, difficult debugging, and long execution chains.",
        releaseOrder: 20260818,
        adapters: openRouterTextAdapters("z-ai/glm-5.3"),
        abilities: ["reasoning", "function_calling", "effort_control"],
        contextLength: 1_048_576,
        maxTokens: 131_072,
        inputUsdPer1MTokens: 1.4,
        outputUsdPer1MTokens: 4.4,
        reasoningEfforts: ["low", "high"],
        defaultReasoningEffort: "high",
        developer: "Z.ai"
    },
    {
        id: "glm-5.2",
        name: "GLM 5.2",
        addedOn: "2026-06-16",
        shortName: "GLM 5.2",
        shortDescription: "Open flagship built to stay sharp through marathon engineering work",
        description:
            "GLM 5.2 is Z.ai's long-horizon specialist, pairing a dependable million-token context with effort-controlled reasoning. It is at its best on sprawling repositories, deep debugging, and engineering runs measured in hours rather than turns.",
        releaseOrder: 20260709,
        adapters: openRouterTextAdapters("z-ai/glm-5.2"),
        abilities: ["reasoning", "function_calling", "effort_control"],
        supportsDisablingReasoning: true,
        developer: "Z.ai"
    },
    {
        id: "glm-5.1",
        name: "GLM 5.1",
        addedOn: "2026-04-07",
        shortName: "GLM 5.1",
        shortDescription: "Persistent coding flagship for agents that have a long road ahead",
        description:
            "GLM 5.1 is an open flagship tuned for sustained agentic coding: exploring repositories, operating tools, and carrying complex implementation plans forward without losing the plot. It is a strong bridge between GLM 5's raw engineering ability and GLM 5.2's million-token stamina.",
        releaseOrder: 20260407,
        adapters: openRouterTextAdapters("z-ai/glm-5.1"),
        abilities: ["reasoning", "function_calling", "effort_control"],
        supportsDisablingReasoning: true,
        developer: "Z.ai"
    },
    {
        id: "glm-5v-turbo",
        name: "GLM 5V Turbo",
        addedOn: "2026-04-01",
        shortName: "5V Turbo",
        shortDescription: "Multimodal coding model that can see the interface and fix it",
        description:
            "GLM 5V Turbo is Z.ai's vision-native coding model, able to read images, video, files, and interfaces before planning and acting. It shines on design-to-code, visual debugging, GUI agents, and any workflow where seeing the problem is half the solution.",
        releaseOrder: 20260401,
        adapters: openRouterTextAdapters("z-ai/glm-5v-turbo"),
        abilities: ["reasoning", "vision", "function_calling"],
        supportsDisablingReasoning: true,
        developer: "Z.ai"
    },
    {
        id: "glm-5",
        name: "GLM 5",
        addedOn: "2026-02-12",
        shortName: "GLM 5",
        shortDescription:
            "Open engineering heavyweight for ambitious systems and autonomous agents",
        description:
            "GLM 5 moved the family from vibe coding toward agentic engineering. Its blend of deep reasoning, systems-level coding, and long-range planning makes it a serious builder for backends, complex refactors, research, and polished office deliverables.",
        releaseOrder: 20260211,
        adapters: openRouterTextAdapters("z-ai/glm-5"),
        abilities: ["reasoning", "function_calling"],
        supportsDisablingReasoning: true,
        developer: "Z.ai"
    }
]
