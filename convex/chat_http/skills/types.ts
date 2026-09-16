import type { AbilityId } from "@/lib/tool-abilities"

export const APP_SKILL_IDS = [
    "diagrams",
    "recipes",
    "canvas",
    "math",
    "web_search",
    "code_execution",
    "memory",
    "image_generation"
] as const

export type AppSkillId = (typeof APP_SKILL_IDS)[number]

export type AppSkillPromptContext = {
    mathKitEnabled: boolean
    imageGenerationDefaults?: {
        resolution?: string
        variants?: number
    }
    availableImageSelectionSummary?: string
}

export type AppSkillDefinition = {
    id: AppSkillId
    label: string
    summary: string
    ability?: AbilityId
    toolNames: readonly string[]
    buildInstructions: (context: AppSkillPromptContext) => string
}
