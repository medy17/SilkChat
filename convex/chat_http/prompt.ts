import type { AbilityId } from "@/lib/tool-abilities"
import type { Infer } from "convex/values"
import dedent from "ts-dedent"
import type { ResolvedToolAvailabilityMap } from "../lib/tools/availability"
import type { ModelAbility, UserSettings } from "../schema/settings"
import { getSkillInstructions } from "./skills"

type BuildPromptOptions = {
    enabledTools: AbilityId[]
    userTimezone?: string // e.g., "Asia/Kuala_Lumpur"
    clientTimestampMs?: number // Pass Date.now() from the client to fix Convex's clock
    userSettings?: Infer<typeof UserSettings>
    personaPrompt?: string
    personaName?: string
    includeTemporalContext?: boolean
    imageGenerationTool?: {
        enabled: boolean
        availableImageSelectionSummary: string
    }
    useSkillLoader?: boolean
}

type TemporalContextOptions = Pick<BuildPromptOptions, "userTimezone" | "clientTimestampMs">

type CapabilityContextOptions = {
    requestedTools: AbilityId[]
    enabledTools: AbilityId[]
    toolAvailability: ResolvedToolAvailabilityMap
    modelAbilities: readonly ModelAbility[]
    isAnonymous: boolean
}

const formatDateInTimeZone = (date: Date, timeZone: string) => {
    const parts = new Intl.DateTimeFormat("en", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date)
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))

    return `${byType.year}-${byType.month}-${byType.day}`
}

export const buildTemporalContext = ({
    userTimezone,
    clientTimestampMs
}: TemporalContextOptions = {}) => {
    // Fuck Convex's broken clock. If the client passes a timestamp, use
    // that instead to guarantee the right UTC and local time basis.
    const now = clientTimestampMs ? new Date(clientTimestampMs) : new Date()

    const utcDate = now.toISOString().slice(0, 10)

    let userTimeInfo = ""
    if (userTimezone) {
        try {
            const localDate = formatDateInTimeZone(now, userTimezone)
            userTimeInfo = `\nUser timezone: ${userTimezone}. Local date: ${localDate}.`
        } catch {
            // Gracefully ignore invalid timezones without shitting the bed
            userTimeInfo = ""
        }
    }

    return dedent`
## Current Date
UTC date: ${utcDate}.${userTimeInfo}`
}

export const buildToolBudgetContext = (toolCallLimitPerTurn?: number) => {
    if (!toolCallLimitPerTurn || toolCallLimitPerTurn <= 0) return ""

    return dedent`
## Tool Budget
This turn has ${toolCallLimitPerTurn} allocated tool calls maximum.
- Use tools only when they are necessary to answer well.
- If a tool budget error appears, continue the turn and answer with the information you already have.`
}

export const buildImageReferenceContext = (availableReferenceLabels: string[]) => {
    const references =
        availableReferenceLabels.length > 0
            ? availableReferenceLabels.map((label) => `- ${label}`).join("\n")
            : "- None"

    return dedent`
## Available Image Reference IDs
${references}`
}

export const buildCapabilityContext = ({
    requestedTools,
    enabledTools,
    toolAvailability,
    modelAbilities,
    isAnonymous
}: CapabilityContextOptions) => {
    const supportsFunctionCalling = modelAbilities.includes("function_calling")
    const limits: string[] = []

    const addToolLimit = (tool: AbilityId, label: string, unavailableReason: string) => {
        if (enabledTools.includes(tool)) return

        if ((tool === "code_execution" || tool === "mathematical_instruments") && isAnonymous) {
            limits.push(
                `- ${label}: unavailable in anonymous chats. The user must sign in before it can be enabled; you cannot use it in this chat.`
            )
            return
        }

        if (!toolAvailability[tool].enabled) {
            limits.push(`- ${label}: ${unavailableReason}`)
            return
        }

        if (!requestedTools.includes(tool)) {
            limits.push(
                `- ${label}: not enabled by the user. You may ask them to enable it in Tools when it is needed; until then, do not claim or attempt to use it.`
            )
        }
    }

    if (!supportsFunctionCalling) {
        limits.push(
            "- Tool calling: unavailable because the selected model does not support it. Do not request or claim to use tools; the user must choose a function-calling model."
        )
    } else {
        addToolLimit(
            "web_search",
            "Web search",
            "unavailable because SilkChat has no search backend configured. Do not ask the user to toggle it; it cannot be used until an administrator configures the deployment."
        )
        addToolLimit(
            "code_execution",
            "Code execution",
            "unavailable because SilkChat has no sandbox backend configured. Do not ask the user to toggle it; it cannot be used until an administrator configures the deployment."
        )
        addToolLimit("mathematical_instruments", "Math Kit", "unavailable in this deployment.")
        addToolLimit(
            "supermemory",
            "Memory",
            "unavailable right now. Do not ask the user to configure it or explain its underlying provider; they cannot use or request Memory now."
        )
    }

    if (!modelAbilities.includes("vision")) {
        limits.push(
            "- Vision and image tools: unavailable because the selected model has no vision capability. The user must choose a vision-capable model; you cannot inspect images with the current model."
        )
    }

    if (limits.length === 0) return ""

    return dedent`
    ## Current Capability Limits
    ${limits.join("\n")}`
}

export const buildPrompt = ({
    enabledTools,
    userTimezone,
    clientTimestampMs,
    userSettings,
    personaPrompt,
    personaName,
    includeTemporalContext = true,
    imageGenerationTool,
    useSkillLoader = false
}: BuildPromptOptions) => {
    const hasWebSearch = enabledTools.includes("web_search")
    const hasCodeExecution = enabledTools.includes("code_execution")
    const hasMathematicalInstruments = enabledTools.includes("mathematical_instruments")
    const hasSupermemory = enabledTools.includes("supermemory")

    // A persona owns the assistant's identity. Injecting the default "Silky"
    // identity alongside it fights the persona for who the assistant *is*, so we
    // only include it on default (non-persona) chats. The time context is neutral
    // and stays in both cases.
    const isPersonaChat = Boolean(personaPrompt?.trim())
    const skillContext = {
        personaName,
        mathKitEnabled: hasMathematicalInstruments,
        imageGenerationDefaults: userSettings?.imageGenerationDefaults,
        availableImageSelectionSummary: imageGenerationTool?.availableImageSelectionSummary
    }

    const layers: string[] = []

    if (!isPersonaChat) {
        layers.push(dedent`
## Identity
You are Silky, an AI assistant in DropSilk Inc.'s SilkChat app. State your identity or maker briefly only when asked, and do not repeat either once mentioned.`)
    }

    if (includeTemporalContext) {
        layers.push(buildTemporalContext({ userTimezone, clientTimestampMs }))
    }

    layers.push(dedent`
## Formatting
Use Markdown without announcing it.`)

    if (!useSkillLoader) {
        for (const skillId of ["diagrams", "recipes", "roleplay", "math", "canvas"] as const) {
            layers.push(getSkillInstructions(skillId, skillContext))
        }
    }

    // Add personalization if user customization or response-style preferences exist
    if (userSettings?.customization || userSettings?.responseStyle) {
        const customization = userSettings.customization
        const personalizationParts: string[] = []

        if (customization?.name) {
            personalizationParts.push(`- Address the user as "${customization.name}"`)
        }

        if (customization?.aiPersonality) {
            personalizationParts.push(`- Personality traits: ${customization.aiPersonality}`)
        }

        if (customization?.additionalContext) {
            personalizationParts.push(
                `- Additional context about the user: ${customization.additionalContext}`
            )
        }

        const responseStyleInstructions = {
            warmth: {
                less: "Use a somewhat more neutral and professionally reserved tone than you otherwise would.",
                more: "Use a somewhat warmer, friendlier, and more personable tone than you otherwise would."
            },
            enthusiasm: {
                less: "Show somewhat less enthusiasm and use a more measured, understated tone than you otherwise would.",
                more: "Show somewhat more enthusiasm and energy than you otherwise would."
            },
            structure: {
                less: "Prefer flowing prose and use headings and lists somewhat less often than you otherwise would.",
                more: "Use headings and lists somewhat more often when they improve clarity."
            },
            emoji: {
                less: "Use emojis somewhat less often than you otherwise would.",
                more: "Use emojis somewhat more often than you otherwise would."
            },
            profanity: {
                less: "Avoid unnecessary profanity and use clean language.",
                more: "Use profanity freely."
            }
        } as const

        for (const field of ["warmth", "enthusiasm", "structure", "emoji", "profanity"] as const) {
            const level = userSettings.responseStyle?.[field]
            if (level) personalizationParts.push(`- ${responseStyleInstructions[field][level]}`)
        }

        if (personalizationParts.length > 0) {
            layers.push(dedent`
## User Personalization
${personalizationParts.join("\n")}`)
        }
    }

    if (!useSkillLoader && hasWebSearch) {
        layers.push(getSkillInstructions("web_search", skillContext))
    }

    if (!useSkillLoader && hasCodeExecution) {
        layers.push(getSkillInstructions("code_execution", skillContext))
    }

    if (!useSkillLoader && hasSupermemory) {
        layers.push(getSkillInstructions("memory", skillContext))
    }

    if (!useSkillLoader && imageGenerationTool?.enabled) {
        layers.push(getSkillInstructions("image_generation", skillContext))
    }

    if (personaPrompt?.trim()) {
        layers.push(personaPrompt.trim())
    }

    return layers.join("\n\n")
}
