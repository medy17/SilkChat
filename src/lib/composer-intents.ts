import type { UploadedFile } from "@/lib/chat-store"

export type ComposerIntentId = "image" | "web" | "analysis"

export const COMPOSER_INTENT_PREFIXES: Record<ComposerIntentId, string> = {
    image: "Create an image of ",
    web: "Search the web for ",
    analysis: "Analyze this data or code: "
}

export const IMAGE_IDEA_RECIPES = [
    {
        id: "watercolor-story",
        label: "Watercolor story",
        image: "/intent-guide/watercolor-fox.webp",
        prompt: "Create an image of a charming hand-painted storybook scene with expressive watercolor texture, tactile paper grain, and a warm, gentle mood."
    },
    {
        id: "anime-character",
        label: "Anime character",
        image: "/intent-guide/anime-adventurer.webp",
        prompt: "Create an image of an expressive anime character portrait with dynamic framing, painterly light, crisp detail, and an optimistic adventurous mood."
    },
    {
        id: "interior-redesign",
        label: "Interior redesign",
        image: "/intent-guide/interior-nook.webp",
        prompt: "Create an image of a serene modern interior with sculptural furniture, natural materials, warm editorial lighting, and refined lived-in detail."
    },
    {
        id: "playful-3d",
        label: "Playful 3D",
        image: "/intent-guide/disco-dinosaur.webp",
        prompt: "Create an image of a whimsical collectible rendered in translucent glass and chrome, with playful prismatic studio lighting and a strong centered silhouette."
    }
] as const

export const WEB_SEARCH_RECIPES = [
    {
        id: "headlines",
        label: "Catch me up on today's most important news",
        prompt: "Search the web for today's most important news. Summarize the major stories, explain why they matter, and cite reliable sources."
    },
    {
        id: "compare",
        label: "Compare products before I buy",
        prompt: "Search the web for current information about products I am considering. Compare price, important tradeoffs, and trustworthy reviews: "
    },
    {
        id: "verify",
        label: "Verify a claim across reliable sources",
        prompt: "Search the web to verify this claim across reliable primary sources. Separate confirmed facts, uncertainty, and conflicting reports: "
    },
    {
        id: "deep-dive",
        label: "Give me a sourced research brief",
        prompt: "Search the web and prepare a concise research brief with key findings, competing perspectives, and links to primary sources about: "
    }
] as const

export type AnalysisAttachmentKind = "spreadsheet" | "document" | "code" | "image" | "mixed"

const spreadsheetExtensions = new Set(["csv", "tsv", "xls", "xlsx"])
const documentExtensions = new Set(["pdf", "doc", "docx", "txt", "md", "rtf"])
const codeExtensions = new Set([
    "c",
    "cpp",
    "cs",
    "css",
    "go",
    "html",
    "java",
    "js",
    "json",
    "jsx",
    "kt",
    "php",
    "py",
    "rb",
    "rs",
    "sh",
    "sql",
    "swift",
    "ts",
    "tsx",
    "vue",
    "xml",
    "yaml",
    "yml"
])

const getExtension = (fileName: string) => fileName.split(".").pop()?.toLowerCase() ?? ""

const getAttachmentKind = (file: UploadedFile): Exclude<AnalysisAttachmentKind, "mixed"> => {
    const extension = getExtension(file.fileName)
    if (spreadsheetExtensions.has(extension)) return "spreadsheet"
    if (documentExtensions.has(extension)) return "document"
    if (codeExtensions.has(extension)) return "code"
    if (file.fileType.startsWith("image/")) return "image"
    return "document"
}

export const resolveAnalysisAttachmentKind = (
    files: UploadedFile[]
): AnalysisAttachmentKind | null => {
    if (files.length === 0) return null
    const kinds = new Set(files.map(getAttachmentKind))
    return kinds.size === 1 ? [...kinds][0] : "mixed"
}

export const hasMeaningfulIntentDraft = (
    value: string,
    activeIntent: ComposerIntentId | null
): boolean => {
    const normalizedValue = value.trim()
    if (!normalizedValue) return false
    if (!activeIntent) return true
    return normalizedValue !== COMPOSER_INTENT_PREFIXES[activeIntent].trim()
}

export type IntentGuideStage =
    | "idle"
    | "image-explore"
    | "image-reference"
    | "image-refine"
    | "web-explore"
    | "web-compose"
    | "analysis-source"
    | "analysis-actions"

export const resolveIntentGuideStage = ({
    activeIntent,
    draft,
    attachmentCount
}: {
    activeIntent: ComposerIntentId | null
    draft: string
    attachmentCount: number
}): IntentGuideStage => {
    if (!activeIntent) return "idle"
    const hasDraft = hasMeaningfulIntentDraft(draft, activeIntent)

    if (activeIntent === "image") {
        if (attachmentCount > 0) return "image-refine"
        return hasDraft ? "image-reference" : "image-explore"
    }

    if (activeIntent === "web") {
        return hasDraft ? "web-compose" : "web-explore"
    }

    return attachmentCount > 0 ? "analysis-actions" : "analysis-source"
}
