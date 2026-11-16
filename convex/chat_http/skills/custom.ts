import type { ModelMessage } from "ai"
import { estimateTokenCount } from "../../lib/file_constants"
import {
    MAX_SKILL_FILE_READ_TOKENS,
    MAX_SKILL_LOAD_TOKENS,
    SKILL_MAIN_FILE
} from "../../lib/skill_bundle"

// Skills people install. Unlike the built-in ones they carry no tools: a skill is its
// SKILL.md plus files that SKILL.md points to, and load_skill returns either.

export type CustomSkill = {
    slug: string
    description: string
    instructions: string
    files: { path: string; sizeBytes: number; text: boolean }[]
    runsCode: boolean
}

export type ReadSkillFile = (skill: CustomSkill, path: string) => Promise<string>

export const MAX_SKILL_FILES_PER_LOAD = 8

type LoadedFile = { path: string; content: string }

export type CustomSkillLoadOutput = {
    success: boolean
    skill: string
    label: string
    message: string
    instructions?: string
    files?: LoadedFile[]
    problems?: string[]
}

const readablePaths = (skill: CustomSkill) =>
    skill.files
        .filter((file) => file.text && file.path !== SKILL_MAIN_FILE)
        .map((file) => file.path)

/** SKILL.md as the model receives it, followed by what else the skill holds. */
export const renderCustomSkillInstructions = (skill: CustomSkill) => {
    const readable = readablePaths(skill)
    const other = skill.files.filter((file) => !file.text).map((file) => file.path)
    const sections = [skill.instructions]
    if (readable.length > 0) {
        sections.push(
            `## Files in this skill\nPaths are relative to the skill's folder. To read any of them, call load_skill again with this skill and their paths in \`files\`. Read a file when the instructions above point to it, not in advance.\n${readable.map((path) => `- ${path}`).join("\n")}`
        )
    }
    if (other.length > 0) {
        sections.push(
            `These files are part of the skill but can't be read here: ${other.join(", ")}.`
        )
    }
    if (skill.runsCode) {
        sections.push(
            "This skill's scripts are not installed anywhere. To use one, read it and run its code with your code execution tools if you have them; otherwise do the work it describes by hand, and say so if that isn't possible."
        )
    }
    return sections.join("\n\n")
}

/**
 * What load_skill returns for an installed skill. With no `files` it is the instructions.
 * With `files` it is those files, plus the instructions if this is the conversation's first
 * load of the skill.
 */
export const buildCustomSkillLoadOutput = async ({
    skill,
    files,
    includeInstructions,
    readFile
}: {
    skill: CustomSkill
    files: string[]
    includeInstructions: boolean
    readFile: ReadSkillFile
}): Promise<CustomSkillLoadOutput> => {
    const loaded: LoadedFile[] = []
    const problems: string[] = []
    const requested = [...new Set(files)]
    if (requested.length > MAX_SKILL_FILES_PER_LOAD) {
        problems.push(`Only ${MAX_SKILL_FILES_PER_LOAD} files can be read per call.`)
    }
    const paths = requested.slice(0, MAX_SKILL_FILES_PER_LOAD)
    const canRead = (path: string) =>
        path !== SKILL_MAIN_FILE && skill.files.some((file) => file.path === path && file.text)
    // Read together, then reported in the order they were asked for.
    const contents = new Map(
        await Promise.all(
            paths.filter(canRead).map(async (path) => {
                const content = await readFile(skill, path).catch(() => null)
                return [path, content] as const
            })
        )
    )
    let loadedTokens = 0
    for (const path of paths) {
        const entry = skill.files.find((file) => file.path === path)
        if (!entry) {
            problems.push(`There is no "${path}" in this skill.`)
        } else if (!entry.text) {
            problems.push(`"${path}" is not a text file and can't be read here.`)
        } else if (path === SKILL_MAIN_FILE) {
            includeInstructions = true
        } else {
            const content = contents.get(path)
            const tokens = typeof content === "string" ? estimateTokenCount(content) : 0
            if (typeof content !== "string") {
                problems.push(`"${path}" could not be read. Try again.`)
            } else if (tokens > MAX_SKILL_FILE_READ_TOKENS) {
                problems.push(`"${path}" is too large to read here.`)
            } else if (loadedTokens + tokens > MAX_SKILL_LOAD_TOKENS) {
                problems.push(`"${path}" was left out to keep this read short. Read it next.`)
            } else {
                loadedTokens += tokens
                loaded.push({ path, content })
            }
        }
    }
    if (problems.some((problem) => problem.startsWith("There is no"))) {
        const held = readablePaths(skill)
        problems.push(
            held.length > 0
                ? `Files in this skill: ${held.join(", ")}.`
                : "This skill has no other files."
        )
    }

    const withInstructions = includeInstructions || requested.length === 0
    return {
        success: withInstructions || loaded.length > 0,
        skill: skill.slug,
        label: skill.slug,
        message:
            loaded.length > 0
                ? `Read ${loaded.map((file) => file.path).join(", ")} from the ${skill.slug} skill.`
                : withInstructions
                  ? `Loaded ${skill.slug} skill.`
                  : `Could not read from the ${skill.slug} skill.`,
        ...(withInstructions ? { instructions: renderCustomSkillInstructions(skill) } : {}),
        ...(loaded.length > 0 ? { files: loaded } : {}),
        ...(problems.length > 0 ? { problems } : {})
    }
}

type LoadCall = { skill: CustomSkill; files: string[] }

const readLoadCall = (
    part: { type: string; toolName?: string; input?: unknown },
    bySlug: ReadonlyMap<string, CustomSkill>
): LoadCall | null => {
    if (part.type !== "tool-call" || part.toolName !== "load_skill") return null
    const input = part.input as { skill?: unknown; files?: unknown } | undefined
    const skill = typeof input?.skill === "string" ? bySlug.get(input.skill) : undefined
    if (!skill) return null
    const files = Array.isArray(input?.files)
        ? input.files.filter((file): file is string => typeof file === "string")
        : []
    return { skill, files }
}

/**
 * The conversation's past loads of installed skills, by tool call. Only a call whose stored
 * result succeeded counts: one that was stopped or failed put nothing in the conversation.
 * What is restored and what the index calls loaded both come from here, so they can't differ.
 */
const findCompletedLoads = (messages: readonly ModelMessage[], skills: readonly CustomSkill[]) => {
    const bySlug = new Map(skills.map((skill) => [skill.slug, skill]))
    const succeeded = new Set<string>()
    for (const message of messages) {
        if (message.role !== "tool") continue
        for (const part of message.content) {
            if (part.type !== "tool-result" || part.output.type !== "json") continue
            const stored = part.output.value as { success?: unknown } | null
            if (stored?.success === true) succeeded.add(part.toolCallId)
        }
    }
    const calls = new Map<string, LoadCall & { first: boolean }>()
    const seen = new Set<string>()
    for (const message of messages) {
        if (message.role !== "assistant" || typeof message.content === "string") continue
        for (const part of message.content) {
            const call = readLoadCall(part, bySlug)
            if (!call || part.type !== "tool-call" || !succeeded.has(part.toolCallId)) continue
            calls.set(part.toolCallId, { ...call, first: !seen.has(call.skill.slug) })
            seen.add(call.skill.slug)
        }
    }
    return calls
}

/** The installed skills this conversation has already loaded, on the selected branch. */
export const getPreviouslyLoadedCustomSkillSlugs = (
    messages: readonly ModelMessage[],
    skills: readonly CustomSkill[]
) => new Set([...findCompletedLoads(messages, skills).values()].map((call) => call.skill.slug))

/**
 * Stored load_skill results keep only a label, so a past load would reach the model with
 * nothing in it. This puts back what each one returned. A chat's skills never change, so the
 * restored text is the same every turn and stays inside the cached part of the prompt.
 */
export const restoreCustomSkillResults = async <M extends ModelMessage>(
    messages: readonly M[],
    skills: readonly CustomSkill[],
    readFile: ReadSkillFile
): Promise<M[]> => {
    if (skills.length === 0) return [...messages]
    const calls = findCompletedLoads(messages, skills)
    if (calls.size === 0) return [...messages]

    return await Promise.all(
        messages.map(async (message) => {
            if (message.role !== "tool") return message
            const content = await Promise.all(
                message.content.map(async (part) => {
                    if (part.type !== "tool-result") return part
                    // A load that failed at the time stays a failure.
                    const call = calls.get(part.toolCallId)
                    if (!call) return part
                    const output = await buildCustomSkillLoadOutput({
                        skill: call.skill,
                        files: call.files,
                        includeInstructions: call.first,
                        readFile
                    })
                    return { ...part, output: { type: "json" as const, value: output } }
                })
            )
            return content.some((part, index) => part !== message.content[index])
                ? { ...message, content }
                : message
        })
    )
}

/** Index lines for the installed skills that are not loaded yet, and the names of those that are. */
export const describeCustomSkills = (
    skills: readonly CustomSkill[],
    loadedSlugs: ReadonlySet<string>
) => ({
    entries: skills
        .filter((skill) => !loadedSlugs.has(skill.slug))
        .map((skill) => `- \`${skill.slug}\` — ${skill.description}`),
    loaded: skills.filter((skill) => loadedSlugs.has(skill.slug)).map((skill) => skill.slug)
})
