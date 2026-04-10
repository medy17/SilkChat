import { estimateTokenCount } from "./file_constants"

export type PersonaKnowledgeDocInput = {
    fileName: string
    content: string
}

export type CompiledPersonaSnapshot = {
    source: "builtin" | "user"
    sourceId: string
    name: string
    shortName: string
    description: string
    instructions: string
    defaultModelId: string
    conversationStarters: string[]
    avatarKind?: "builtin" | "r2"
    avatarValue?: string
    avatarMimeType?: string
    knowledgeDocs: Array<{
        fileName: string
        tokenCount: number
    }>
    compiledPrompt: string
    promptTokenEstimate: number
}

const sanitizeLineEndings = (value: string) => value.replace(/\r\n/g, "\n")

const collapseWhitespace = (value: string) => value.replace(/[ \t]+\n/g, "\n").trim()

export const sanitizePersonaMarkdown = (markdown: string) =>
    collapseWhitespace(
        sanitizeLineEndings(markdown)
            .replace(/!\[[^\]]*]\([^)]*\)/g, "")
            .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
            .replace(/<https?:\/\/[^>]+>/g, "")
            .replace(/https?:\/\/\S+/g, "")
    )

const trimStarter = (starter: string) => starter.replace(/\s+/g, " ").trim()

export const normalizeConversationStarters = (starters: string[]) =>
    starters.map(trimStarter).filter(Boolean)

const buildKnowledgeDocsSection = (knowledgeDocs: PersonaKnowledgeDocInput[]) =>
    knowledgeDocs
        .map(({ fileName, content }) => `### ${fileName}\n${sanitizePersonaMarkdown(content)}`)
        .join("\n\n")

export const buildCompiledPersonaPrompt = ({
    name,
    description,
    instructions,
    knowledgeDocs
}: {
    name: string
    description: string
    instructions: string
    knowledgeDocs: PersonaKnowledgeDocInput[]
}) => {
    const promptParts = [
        "## Active Persona",
        `Name: ${name.trim()}`,
        `Description: ${description.trim()}`,
        "",
        "### Instructions",
        instructions.trim()
    ]

    if (knowledgeDocs.length > 0) {
        promptParts.push("", "## Persona Knowledge Base", buildKnowledgeDocsSection(knowledgeDocs))
    }

    return promptParts.join("\n")
}

export const compilePersonaSnapshot = ({
    source,
    sourceId,
    name,
    shortName,
    description,
    instructions,
    defaultModelId,
    conversationStarters,
    avatarKind,
    avatarValue,
    avatarMimeType,
    knowledgeDocs
}: {
    source: "builtin" | "user"
    sourceId: string
    name: string
    shortName: string
    description: string
    instructions: string
    defaultModelId: string
    conversationStarters: string[]
    avatarKind?: "builtin" | "r2"
    avatarValue?: string
    avatarMimeType?: string
    knowledgeDocs: PersonaKnowledgeDocInput[]
}) => {
    const compiledPrompt = buildCompiledPersonaPrompt({
        name,
        description,
        instructions,
        knowledgeDocs
    })

    return {
        source,
        sourceId,
        name: name.trim(),
        shortName: shortName.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        defaultModelId,
        conversationStarters: normalizeConversationStarters(conversationStarters),
        avatarKind,
        avatarValue,
        avatarMimeType,
        knowledgeDocs: knowledgeDocs.map(({ fileName, content }) => ({
            fileName,
            tokenCount: estimateTokenCount(sanitizePersonaMarkdown(content))
        })),
        compiledPrompt,
        promptTokenEstimate: estimateTokenCount(compiledPrompt)
    } satisfies CompiledPersonaSnapshot
}
