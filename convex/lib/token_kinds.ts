import { estimateTokenCount, getFileTypeInfo } from "./file_constants"

/**
 * Token estimates in two steps: a model-neutral count (tokenx, close to OpenAI's o200k) split by
 * content kind, then weighted by the model's tokenizer family. Families tokenize code, prose and
 * data differently, so one flat factor per family over- or under-counts one of them.
 *
 * Multipliers are real provider counts divided by tokenx on the same samples (TS, TSX, Markdown,
 * prose, JSON) through OpenRouter, measured 2026-11-04 against tokenx 2.2.0 (pinned). Rounded
 * towards the heavier end, since overcounting only stops a request early.
 */
export type TokenKind = "prose" | "code" | "data" | "fixed"
export type TokenTally = Record<TokenKind, number>

export type TokenizerFamily = "o200k" | "qwen" | "xai" | "google" | "claude-legacy" | "claude"

// "fixed" covers counts that aren't text tokenization (message overhead, file references,
// image tokens), so no family reweights them.
const FAMILY_MULTIPLIERS: Record<TokenizerFamily, TokenTally> = {
    // OpenAI, DeepSeek, Meta, MiniMax, Mistral, Moonshot, Xiaomi, Z.ai: 0.93-1.05 of tokenx.
    o200k: { prose: 1, code: 1, data: 1, fixed: 1 },
    qwen: { prose: 1, code: 1.07, data: 1.1, fixed: 1 },
    xai: { prose: 1, code: 1.05, data: 1.1, fixed: 1 },
    // Gemini and Gemma share one tokenizer.
    google: { prose: 1, code: 1.12, data: 1.15, fixed: 1 },
    // Haiku 4.5, Sonnet 4.6 and earlier, Opus 4.6 and earlier.
    "claude-legacy": { prose: 1.1, code: 1.3, data: 1.2, fixed: 1 },
    // Sonnet 5+, Haiku 5.5+, Opus 4.7+, Fable and Mythos.
    claude: { prose: 1.6, code: 1.77, data: 1.45, fixed: 1 }
}

// One number per family for converting a whole-thread count between families, where the mix of
// kinds is unknown.
const FAMILY_SCALE: Record<TokenizerFamily, number> = {
    o200k: 1,
    qwen: 1.05,
    xai: 1.05,
    google: 1.08,
    "claude-legacy": 1.2,
    claude: 1.65
}

const CLAUDE_MODEL_PATTERN = /claude-(sonnet|haiku|opus|fable|mythos)-(\d+)(?:[.-](\d+))?/

const isNewClaudeTokenizer = (tier: string, major: number, minor: number) => {
    if (tier === "fable" || tier === "mythos") return true
    if (tier === "opus") return major > 4 || (major === 4 && minor >= 7)
    return major >= 5
}

/**
 * The tokenizer family from a model's id, plus anything else naming it (adapters, a custom
 * model's provider id). Unknown models count as o200k, which most families sit close to.
 */
export const resolveTokenizerFamily = (
    ...identifiers: Array<string | null | undefined>
): TokenizerFamily => {
    const name = identifiers.filter(Boolean).join(" ").toLowerCase()
    const claude = name.match(CLAUDE_MODEL_PATTERN)
    if (claude) {
        const major = Number(claude[2])
        const minor = claude[3] ? Number(claude[3]) : 0
        return isNewClaudeTokenizer(claude[1], major, minor) ? "claude" : "claude-legacy"
    }
    // An unrecognised Claude name is most likely a newer model.
    if (name.includes("claude")) return "claude"
    if (/gemini|gemma/.test(name)) return "google"
    if (name.includes("qwen")) return "qwen"
    if (name.includes("grok")) return "xai"
    return "o200k"
}

export const emptyTally = (): TokenTally => ({ prose: 0, code: 0, data: 0, fixed: 0 })

export const addTallies = (target: TokenTally, source: TokenTally) => {
    target.prose += source.prose
    target.code += source.code
    target.data += source.data
    target.fixed += source.fixed
    return target
}

export const tallyOf = (kind: TokenKind, tokens: number): TokenTally => ({
    ...emptyTally(),
    [kind]: tokens
})

export const weighTally = (tally: TokenTally, family: TokenizerFamily) => {
    const multipliers = FAMILY_MULTIPLIERS[family]
    return Math.ceil(
        tally.prose * multipliers.prose +
            tally.code * multipliers.code +
            tally.data * multipliers.data +
            tally.fixed * multipliers.fixed
    )
}

/** Converts a count made under one family (e.g. a real anchor) into another family's units. */
export const convertTokensBetweenFamilies = (
    tokens: number,
    from: TokenizerFamily,
    to: TokenizerFamily
) => (from === to ? tokens : Math.round((tokens * FAMILY_SCALE[to]) / FAMILY_SCALE[from]))

const DATA_EXTENSIONS = new Set([
    ".json",
    ".jsonl",
    ".ndjson",
    ".csv",
    ".tsv",
    ".yaml",
    ".yml",
    ".xml",
    ".toml"
])

/** Attachments are classified by extension; it's the one place the content type is known. */
export const tokenKindForFile = (filename: string, mimeType?: string): TokenKind => {
    const info = getFileTypeInfo(filename, mimeType)
    if (info.extension && DATA_EXTENSIONS.has(info.extension)) return "data"
    if (info.isCode) return "code"
    return "prose"
}

// The kind of a text part decided where it was created (an inlined attachment), keyed by the
// part object so nothing extra reaches the model.
const taggedTextKinds = new WeakMap<object, TokenKind>()

export const tagTokenKind = <T extends object>(part: T, kind: TokenKind) => {
    taggedTextKinds.set(part, kind)
    return part
}

export const getTaggedTokenKind = (part: object) => taggedTextKinds.get(part)

const FENCED_CODE_PATTERN = /(```|~~~)[\s\S]*?(?:\1|$)/g

/** Message text is prose, except fenced code blocks, which are a structural signal for code. */
export const tallyText = (text: string, kind?: TokenKind): TokenTally => {
    if (!text) return emptyTally()
    if (kind) return tallyOf(kind, estimateTokenCount(text))
    let code = 0
    const prose = text.replace(FENCED_CODE_PATTERN, (block) => {
        code += estimateTokenCount(block)
        return " "
    })
    return { ...emptyTally(), prose: estimateTokenCount(prose), code }
}
