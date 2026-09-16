import type { AbilityId } from "@/lib/tool-abilities"
import { tool, type Tool } from "ai"
import { z } from "zod"
import { canvasSkill } from "./canvas"
import { codeExecutionSkill } from "./code_execution"
import { diagramsSkill } from "./diagrams"
import { imageGenerationSkill } from "./image_generation"
import { mathSkill } from "./math"
import { memorySkill } from "./memory"
import { recipesSkill } from "./recipes"
import { APP_SKILL_IDS, type AppSkillId, type AppSkillPromptContext } from "./types"
import { webSearchSkill } from "./web_search"

export { APP_SKILL_IDS, type AppSkillId, type AppSkillPromptContext } from "./types"

export const APP_SKILLS = {
    diagrams: diagramsSkill,
    recipes: recipesSkill,
    canvas: canvasSkill,
    math: mathSkill,
    web_search: webSearchSkill,
    code_execution: codeExecutionSkill,
    memory: memorySkill,
    image_generation: imageGenerationSkill
} as const

export const resolveAvailableSkillIds = ({
    enabledTools,
    imageGenerationEnabled
}: {
    enabledTools: AbilityId[]
    imageGenerationEnabled: boolean
}): AppSkillId[] =>
    APP_SKILL_IDS.filter((skillId) => {
        const skill = APP_SKILLS[skillId]
        if (skillId === "image_generation") return imageGenerationEnabled
        return !skill.ability || enabledTools.includes(skill.ability)
    })

export const buildSkillIndexContext = (availableSkillIds: AppSkillId[]) => {
    if (availableSkillIds.length === 0) return ""

    const entries = availableSkillIds
        .map((skillId) => `- \`${skillId}\` — ${APP_SKILLS[skillId].summary}`)
        .join("\n")

    return `## Available Skills
The skills below are available but not loaded. Availability is not a suggestion to use them. Loading a skill is itself a tool call, so answer directly whenever the request does not match a listed positive trigger. Uncertainty, unfamiliarity, or a desire to produce a more authoritative answer does not by itself justify loading a skill. When the current request clearly needs one, call \`load_skill\` before following its instructions or using its associated tools. Loading returns complete, turn-scoped instructions as a tool result. Do not load skills for simple adjacent tasks, and do not claim to have loaded one without calling the tool. You may load another skill later in the same turn if necessary.
${entries}`
}

export const getSkillInstructions = (skillId: AppSkillId, context: AppSkillPromptContext) =>
    APP_SKILLS[skillId].buildInstructions(context)

export const getLoadSkillTool = ({
    availableSkillIds,
    context,
    onLoad
}: {
    availableSkillIds: AppSkillId[]
    context: AppSkillPromptContext
    onLoad: (skillId: AppSkillId) => void
}): Record<"load_skill", Tool> => {
    const skillIdSchema = z
        .string()
        .refine((value): value is AppSkillId => availableSkillIds.includes(value as AppSkillId), {
            message: `Skill must be one of: ${availableSkillIds.join(", ")}`
        })

    return {
        load_skill: tool({
            description:
                "Load one skill only when the request matches that skill's positive trigger in the Available Skills index. Skill availability, uncertainty, unfamiliarity, or a desire for extra authority is not enough. Call this before using a genuinely needed skill or its associated tools.",
            inputSchema: z.object({
                skill: skillIdSchema.describe("The exact skill id from the Available Skills index")
            }),
            execute: async ({ skill }) => {
                onLoad(skill)
                const definition = APP_SKILLS[skill]
                return {
                    success: true,
                    skill,
                    label: definition.label,
                    message: `Loaded ${definition.label} skill for this turn.`,
                    instructions: definition.buildInstructions(context)
                }
            }
        })
    }
}

type ToolExecute = (input: never, options: never) => PromiseLike<unknown> | unknown

export const guardSkillTools = ({
    tools,
    availableSkillIds,
    loadedSkillIds
}: {
    tools: Record<string, Tool>
    availableSkillIds: AppSkillId[]
    loadedSkillIds: ReadonlySet<AppSkillId>
}): Record<string, Tool> => {
    const skillByToolName = new Map<string, AppSkillId>()
    for (const skillId of availableSkillIds) {
        for (const toolName of APP_SKILLS[skillId].toolNames) {
            skillByToolName.set(toolName, skillId)
        }
    }

    return Object.fromEntries(
        Object.entries(tools).map(([toolName, definition]) => {
            const skillId = skillByToolName.get(toolName)
            const execute = definition.execute as ToolExecute | undefined
            if (!skillId || !execute) return [toolName, definition]

            return [
                toolName,
                {
                    ...definition,
                    execute: async (input: never, options: never) => {
                        if (!loadedSkillIds.has(skillId)) {
                            throw new Error(
                                `Load the ${APP_SKILLS[skillId].label} skill with load_skill before calling ${toolName}.`
                            )
                        }
                        return await execute(input, options)
                    }
                } as Tool
            ]
        })
    )
}

export const getPublicSkillLoadResult = (output: unknown) => {
    if (!output || typeof output !== "object") return output

    const value = output as Record<string, unknown>
    if (typeof value.skill !== "string" || typeof value.label !== "string") return output

    return {
        success: value.success === true,
        skill: value.skill,
        label: value.label,
        message:
            typeof value.message === "string"
                ? value.message
                : `Loaded ${value.label} skill for this turn.`
    }
}
