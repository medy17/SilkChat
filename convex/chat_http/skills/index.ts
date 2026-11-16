import type { AbilityId } from "@/lib/tool-abilities"
import { type ModelMessage, tool, type Tool } from "ai"
import { z } from "zod"
import { canvasSkill } from "./canvas"
import { codeExecutionSkill } from "./code_execution"
import {
    type CustomSkill,
    MAX_SKILL_FILES_PER_LOAD,
    type ReadSkillFile,
    buildCustomSkillLoadOutput,
    describeCustomSkills
} from "./custom"
import { diagramsSkill } from "./diagrams"
import { imageGenerationSkill } from "./image_generation"
import { mathSkill } from "./math"
import { memorySkill } from "./memory"
import { recipesSkill } from "./recipes"
import { roleplaySkill } from "./roleplay"
import { APP_SKILL_IDS, type AppSkillId, type AppSkillPromptContext } from "./types"
import { webSearchSkill } from "./web_search"

export { APP_SKILL_IDS, type AppSkillId, type AppSkillPromptContext } from "./types"

export const APP_SKILLS = {
    diagrams: diagramsSkill,
    recipes: recipesSkill,
    roleplay: roleplaySkill,
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

/** The chat's installed skills and which of them the conversation has loaded. */
export type CustomSkillIndex = {
    skills: readonly CustomSkill[]
    loadedSlugs: ReadonlySet<string>
}

export const buildSkillIndexContext = (
    availableSkillIds: AppSkillId[],
    preloadedSkillIds: ReadonlySet<AppSkillId> = new Set(),
    context?: AppSkillPromptContext,
    custom?: CustomSkillIndex
) => {
    const unloadedSkillIds = availableSkillIds.filter((id) => !preloadedSkillIds.has(id))
    const preloaded = context
        ? availableSkillIds
              .filter((id) => preloadedSkillIds.has(id))
              .map((id) => `### ${APP_SKILLS[id].label}\n${getSkillInstructions(id, context)}`)
              .join("\n\n")
        : ""
    const loadedContext = preloaded
        ? `## Preloaded Skills\nThese skills are already loaded. Their tools are available without calling load_skill. Being loaded, or having been used earlier in this conversation, does not authorize using a skill's tools again: use them only when the current message asks for what they do or clearly depends on it, and otherwise answer directly. Loading does not require using a tool.\n${preloaded}\n\n`
        : ""
    const installed = describeCustomSkills(custom?.skills ?? [], custom?.loadedSlugs ?? new Set())
    // Their instructions are already in the conversation, where they were loaded.
    const installedLoaded =
        installed.loaded.length > 0
            ? `## Loaded Skills\nThese installed skills were loaded earlier in this conversation and their instructions are in it: ${installed.loaded.map((slug) => `\`${slug}\``).join(", ")}. Do not load them again. Call load_skill for one of them only with \`files\`, to read a file its instructions point to.\n\n`
            : ""
    if (unloadedSkillIds.length === 0 && installed.entries.length === 0) {
        return `${loadedContext}${installedLoaded}`
    }

    const entries = [
        ...unloadedSkillIds.map((skillId) => `- \`${skillId}\` — ${APP_SKILLS[skillId].summary}`),
        ...installed.entries
    ].join("\n")

    return `${loadedContext}${installedLoaded}## Available Skills
The skills below are available but not loaded. Availability is not a suggestion to use them. Loading a skill is itself a tool call, so answer directly whenever the request does not match a listed positive trigger. Uncertainty, unfamiliarity, or a desire to produce a more authoritative answer does not by itself justify loading a skill. When the current request clearly needs one, call \`load_skill\` first and wait for its result before following its instructions or using its associated tools. A skill's tools become callable only in the step after its load returns, so never call them in the same step as \`load_skill\`. A loaded skill stays loaded for the rest of the conversation. If a tool call fails because the tool is unavailable or its skill is not loaded, load the skill, or call the tool again once the load has returned, instead of telling the user the tool is unavailable. Loading returns complete instructions as a tool result. Do not load skills for simple adjacent tasks, and do not claim to have loaded one without calling the tool. You may load another skill later in the same turn if necessary.
${entries}`
}

// A skill loaded on the selected branch stays loaded so a follow-up does not spend a
// step reloading it. Opening selections preload without a load_skill call, so a call
// to one of the skill's tools also counts.
export const getPreviouslyLoadedSkillIds = (
    messages: readonly ModelMessage[],
    availableSkillIds: readonly AppSkillId[]
): AppSkillId[] => {
    const loaded = new Set<AppSkillId>()
    for (const message of messages) {
        if (message.role !== "assistant" || typeof message.content === "string") continue
        for (const part of message.content) {
            if (part.type !== "tool-call") continue
            const requested =
                part.toolName === "load_skill"
                    ? (part.input as { skill?: unknown } | undefined)?.skill
                    : undefined
            for (const skillId of availableSkillIds) {
                if (
                    requested === skillId ||
                    APP_SKILLS[skillId].toolNames.includes(part.toolName)
                ) {
                    loaded.add(skillId)
                }
            }
        }
    }
    return availableSkillIds.filter((skillId) => loaded.has(skillId))
}

export const getSkillInstructions = (skillId: AppSkillId, context: AppSkillPromptContext) =>
    APP_SKILLS[skillId].buildInstructions(context)

export const getActiveSkillToolNames = ({
    tools,
    availableSkillIds,
    loadedSkillIds
}: {
    tools: Record<string, Tool>
    availableSkillIds: AppSkillId[]
    loadedSkillIds: ReadonlySet<AppSkillId>
}): string[] => {
    const unloadedToolNames = new Set(
        availableSkillIds
            .filter((skillId) => !loadedSkillIds.has(skillId))
            .flatMap((skillId) => [...APP_SKILLS[skillId].toolNames])
    )

    // Preserve tools outside the skill system, including disabled-tool explanations.
    return Object.keys(tools).filter((toolName) => !unloadedToolNames.has(toolName))
}

/** The chat's installed skills, with the set of loaded ones kept up to date as loads happen. */
export type CustomSkillLoader = {
    skills: readonly CustomSkill[]
    loadedSlugs: Set<string>
    readFile: ReadSkillFile
}

export const getLoadSkillTool = ({
    availableSkillIds,
    context,
    onLoad,
    custom
}: {
    availableSkillIds: AppSkillId[]
    context: AppSkillPromptContext
    onLoad: (skillId: AppSkillId) => void
    custom?: CustomSkillLoader
}): Record<"load_skill", Tool> => {
    const installed = new Map((custom?.skills ?? []).map((skill) => [skill.slug, skill]))
    const skillIds = [...availableSkillIds, ...installed.keys()]
    const skillIdSchema = z.string().refine((value) => skillIds.includes(value), {
        message: `Skill must be one of: ${skillIds.join(", ")}`
    })
    const hasInstalled = installed.size > 0

    return {
        load_skill: tool({
            description: `Load one skill only when the request matches that skill's positive trigger in the Available Skills index. Skill availability, uncertainty, unfamiliarity, or a desire for extra authority is not enough. Call this before using a genuinely needed skill or its associated tools, and wait for the result: its tools become callable only after it returns, never in the same step.${
                hasInstalled
                    ? " Some skills list files of their own. To read them, call this again with the same skill and their paths in `files`."
                    : ""
            }`,
            // `files` only exists when the chat has installed skills, so the tool reads the
            // same as before for everyone else.
            inputSchema: (hasInstalled
                ? z.object({
                      skill: skillIdSchema.describe(
                          "The exact skill id from the Available Skills index"
                      ),
                      files: z
                          .array(z.string())
                          .max(MAX_SKILL_FILES_PER_LOAD)
                          .optional()
                          .describe(
                              "Paths from the skill's own file list, to read those files. Leave out to load the skill itself."
                          )
                  })
                : z.object({
                      skill: skillIdSchema.describe(
                          "The exact skill id from the Available Skills index"
                      )
                  })) as z.ZodType<{ skill: string; files?: string[] }>,
            execute: async ({ skill, files }) => {
                const installedSkill = installed.get(skill)
                if (installedSkill && custom) {
                    const output = await buildCustomSkillLoadOutput({
                        skill: installedSkill,
                        files: files ?? [],
                        includeInstructions: !custom.loadedSlugs.has(skill),
                        readFile: custom.readFile
                    })
                    custom.loadedSlugs.add(skill)
                    return output
                }
                onLoad(skill as AppSkillId)
                const definition = APP_SKILLS[skill as AppSkillId]
                return {
                    success: true,
                    skill,
                    label: definition.label,
                    message: `Loaded ${definition.label} skill.`,
                    // Model-only; the public result drops it.
                    ...(definition.toolNames.length > 0
                        ? {
                              nextStep:
                                  "This skill's tools are callable from your next step. Use them; do not tell the user they are unavailable."
                          }
                        : {}),
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
        message: typeof value.message === "string" ? value.message : `Loaded ${value.label} skill.`,
        // Which files were read, without their contents.
        ...(Array.isArray(value.files)
            ? {
                  files: value.files.flatMap((file) =>
                      file && typeof file === "object" && typeof file.path === "string"
                          ? [file.path]
                          : []
                  )
              }
            : {})
    }
}
