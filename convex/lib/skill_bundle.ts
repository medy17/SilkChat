import { APP_SKILL_IDS } from "../chat_http/skills/types"
import { estimateTokenCount } from "./file_constants"

// A skill is a folder: SKILL.md at its root, with a name and description in YAML frontmatter,
// plus any files the instructions point to. Everything here is pure, so installs from the
// store, a repository, and a .zip all pass the same checks.

export const SKILL_MAIN_FILE = "SKILL.md"
export const MAX_SKILL_NAME_LENGTH = 64
export const MAX_SKILL_DESCRIPTION_LENGTH = 1024
export const MAX_SKILL_FILES = 200
export const MAX_SKILL_FILE_BYTES = 2 * 1024 * 1024
export const MAX_SKILL_BUNDLE_BYTES = 6 * 1024 * 1024
/** SKILL.md stays in the prompt for the rest of a chat once loaded. */
export const MAX_SKILL_INSTRUCTION_TOKENS = 20_000
/** One file returned through load_skill. */
export const MAX_SKILL_FILE_READ_TOKENS = 25_000
/** All the files one load_skill call returns. A call that asks for more is told to read on. */
export const MAX_SKILL_LOAD_TOKENS = 50_000
export const MAX_INSTALLED_SKILLS = 50
export const MAX_SKILLS_PER_CHAT = 20
export const SKILL_VERSION_HASH_LENGTH = 16

/** The message is written for the person installing the skill. */
export class SkillBundleError extends Error {}

export type SkillBundleFile = { path: string; bytes: Uint8Array }

export type SkillFileEntry = {
    path: string
    sizeBytes: number
    /** Readable through load_skill. Other files only matter to scripts. */
    text: boolean
}

export type ParsedSkillBundle = {
    slug: string
    description: string
    /** SKILL.md without its frontmatter. */
    instructions: string
    instructionTokens: number
    files: SkillFileEntry[]
    runsCode: boolean
    sizeBytes: number
    /** Content hash of the whole folder. Its start names the stored version. */
    hash: string
}

const IGNORED_SEGMENTS = new Set([".git", ".github", "__MACOSX", "node_modules", "__pycache__"])
const IGNORED_FILES = new Set([".DS_Store", "Thumbs.db"])
const SCRIPT_EXTENSIONS = new Set([
    ".py",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".sh",
    ".bash",
    ".rb",
    ".pl",
    ".php"
])

const unquoteDouble = (value: string) =>
    value.replace(/\\(["\\/ntr]|\n)/g, (_match, escaped: string) =>
        escaped === "n" ? "\n" : escaped === "t" ? "\t" : escaped === "r" ? "\r" : escaped
    )

// Folds the lines of a multi-line scalar the way YAML does: a line break becomes a space,
// and a blank line becomes a line break.
const foldLines = (lines: string[]) =>
    lines
        .map((line) => line.trim())
        .join("\n")
        .replace(/([^\n])\n(?!\n)/g, "$1 ")
        .replace(/\n\n+/g, (breaks) => "\n".repeat(breaks.length - 1))

const readQuoted = (lines: string[], quote: '"' | "'") => {
    const text = foldLines(lines).trim()
    const closing =
        quote === '"'
            ? /^"((?:[^"\\]|\\[\s\S])*)"/.exec(text)?.[1]
            : /^'((?:[^']|'')*)'/.exec(text)?.[1]
    if (closing === undefined) return text.slice(1)
    return quote === '"' ? unquoteDouble(closing) : closing.replace(/''/g, "'")
}

const readBlock = (indicator: string, lines: string[]) => {
    const indents = lines.filter((line) => line.trim()).map((line) => /^ */.exec(line)![0].length)
    const indent = indents.length > 0 ? Math.min(...indents) : 0
    const dedented = lines.map((line) => line.slice(indent))
    return indicator.startsWith("|") ? dedented.join("\n") : foldLines(dedented)
}

/**
 * Reads the top-level scalars of SKILL.md's frontmatter. Only `name` and `description` are
 * used, so nested mappings and lists are skipped rather than parsed.
 */
export const parseSkillFrontmatter = (markdown: string) => {
    const source = markdown.replace(/^﻿/, "").replace(/\r\n?/g, "\n")
    const lines = source.split("\n")
    if (lines[0]?.trim() !== "---") return { fields: {} as Record<string, string>, body: source }
    const end = lines.findIndex(
        (line, index) => index > 0 && (line.trim() === "---" || line.trim() === "...")
    )
    if (end === -1) return { fields: {} as Record<string, string>, body: source }

    const fields: Record<string, string> = {}
    const yaml = lines.slice(1, end)
    for (let index = 0; index < yaml.length; index++) {
        const match = /^([A-Za-z_][\w-]*):(?:[ \t]+(.*))?$/.exec(yaml[index])
        if (!match) continue
        const key = match[1]
        const first = (match[2] ?? "").trim()
        // Everything indented under the key belongs to it.
        const rest: string[] = []
        while (index + 1 < yaml.length && (/^\s/.test(yaml[index + 1]) || !yaml[index + 1])) {
            rest.push(yaml[++index])
        }

        if (/^[|>][+-]?\d*$/.test(first)) {
            fields[key] = readBlock(first, rest).trim()
        } else if (first.startsWith('"') || first.startsWith("'")) {
            fields[key] = readQuoted([first, ...rest], first[0] as '"' | "'").trim()
        } else if (first) {
            fields[key] = foldLines([first, ...rest])
                .replace(/(^|\s)#.*$/, "")
                .trim()
        }
    }

    return { fields, body: lines.slice(end + 1).join("\n") }
}

/** A skill's name as a slug: lowercase letters, digits, and single hyphens. */
export const toSkillSlug = (name: string) =>
    name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, MAX_SKILL_NAME_LENGTH)
        .replace(/-+$/, "")

/** Null for a path that could reach outside the skill's folder, or that is only clutter. */
export const normalizeSkillPath = (path: string) => {
    const normalized = path.replace(/\\/g, "/").replace(/^(\.\/)+/, "")
    // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what is being rejected.
    if (!normalized || normalized.length > 300 || /[\u0000-\u001f]/.test(normalized)) return null
    if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) return null
    const segments = normalized.split("/")
    if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null
    if (segments.some((segment) => IGNORED_SEGMENTS.has(segment))) return null
    if (IGNORED_FILES.has(segments[segments.length - 1])) return null
    return normalized
}

/** The folders that hold a SKILL.md, shallowest first. "" is the root itself. */
export const findSkillRoots = (paths: string[]) =>
    paths
        .filter((path) => path === SKILL_MAIN_FILE || path.endsWith(`/${SKILL_MAIN_FILE}`))
        .map((path) => path.slice(0, -SKILL_MAIN_FILE.length).replace(/\/$/, ""))
        .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))

export const isTextBytes = (bytes: Uint8Array) => {
    if (bytes.subarray(0, 8192).includes(0)) return false
    try {
        new TextDecoder("utf-8", { fatal: true }).decode(bytes)
        return true
    } catch {
        return false
    }
}

export const isScriptPath = (path: string) =>
    path.startsWith("scripts/") || SCRIPT_EXTENSIONS.has(/\.[^./]+$/.exec(path)?.[0] ?? "")

const toHex = (buffer: ArrayBuffer) =>
    [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("")

export const hashSkillFiles = async (files: SkillBundleFile[]) => {
    const encoder = new TextEncoder()
    const chunks: Uint8Array[] = []
    for (const file of [...files].sort((a, b) =>
        a.path < b.path ? -1 : a.path > b.path ? 1 : 0
    )) {
        chunks.push(encoder.encode(`${file.path}\u0000${file.bytes.byteLength}\u0000`), file.bytes)
    }
    const joined = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0))
    let offset = 0
    for (const chunk of chunks) {
        joined.set(chunk, offset)
        offset += chunk.byteLength
    }
    return toHex(await crypto.subtle.digest("SHA-256", joined))
}

/**
 * Checks one skill folder and describes it. `files` are relative to the folder, so SKILL.md
 * is at the top. `fallbackName` names a skill whose frontmatter leaves its name out.
 */
export const parseSkillBundle = async (
    input: SkillBundleFile[],
    { fallbackName }: { fallbackName?: string } = {}
): Promise<ParsedSkillBundle> => {
    const files: SkillBundleFile[] = []
    const seen = new Set<string>()
    for (const file of input) {
        const path = normalizeSkillPath(file.path)
        if (!path || seen.has(path)) continue
        seen.add(path)
        files.push({ path, bytes: file.bytes })
    }

    const main = files.find((file) => file.path === SKILL_MAIN_FILE)
    if (!main) throw new SkillBundleError("This isn't a skill: there is no SKILL.md at its top.")
    if (!isTextBytes(main.bytes)) throw new SkillBundleError("SKILL.md isn't a text file.")
    if (files.length > MAX_SKILL_FILES) {
        throw new SkillBundleError(`A skill can hold at most ${MAX_SKILL_FILES} files.`)
    }
    const sizeBytes = files.reduce((total, file) => total + file.bytes.byteLength, 0)
    if (
        sizeBytes > MAX_SKILL_BUNDLE_BYTES ||
        files.some((file) => file.bytes.byteLength > MAX_SKILL_FILE_BYTES)
    ) {
        throw new SkillBundleError("This skill is too large to add.")
    }

    const { fields, body } = parseSkillFrontmatter(new TextDecoder().decode(main.bytes))
    const slug = toSkillSlug(fields.name || fallbackName || "")
    if (!slug) throw new SkillBundleError("SKILL.md doesn't give the skill a name.")
    if ((APP_SKILL_IDS as readonly string[]).includes(slug)) {
        throw new SkillBundleError(`The name "${slug}" belongs to a built-in skill.`)
    }
    const description = (fields.description ?? "").replace(/\s+/g, " ").trim()
    if (!description) throw new SkillBundleError("SKILL.md doesn't describe when to use the skill.")
    const instructions = body.trim()
    const instructionTokens = estimateTokenCount(instructions)
    if (instructionTokens > MAX_SKILL_INSTRUCTION_TOKENS) {
        throw new SkillBundleError("This skill's SKILL.md is too long to load into a chat.")
    }

    return {
        slug,
        description: description.slice(0, MAX_SKILL_DESCRIPTION_LENGTH),
        instructions,
        instructionTokens,
        files: files
            .map((file) => ({
                path: file.path,
                sizeBytes: file.bytes.byteLength,
                text: isTextBytes(file.bytes)
            }))
            .sort((a, b) => a.path.localeCompare(b.path)),
        runsCode: files.some((file) => isScriptPath(file.path)),
        sizeBytes,
        hash: await hashSkillFiles(files)
    }
}

/** Where one file of one installed version lives in R2. */
export const getSkillFileKey = (userId: string, slug: string, hash: string, path: string) =>
    `skills/${userId}/${slug}/${hash.slice(0, SKILL_VERSION_HASH_LENGTH)}/${path}`

/**
 * Where a skill is, from what people paste: `owner/repo`, a GitHub link, either with the
 * skill's folder, or the store's install command (`npx skills add <source> --skill <name>`,
 * where the name picks one skill out of a repository that holds several).
 */
export const parseGithubSkillReference = (reference: string) => {
    const words = reference.trim().split(/\s+/)
    // Everything up to "add" is the command that runs the installer.
    const start = words.indexOf("add")
    const args = start === -1 ? words : words.slice(start + 1)
    let name: string | undefined
    let source: string | undefined
    for (let index = 0; index < args.length; index++) {
        const word = args[index]
        if (word === "--skill" || word === "-s") name = args[++index]
        else if (word.startsWith("--skill=")) name = word.slice("--skill=".length)
        else if (!word.startsWith("-")) source ??= word
    }
    if (!source) return null
    // The installer also takes owner/repo@skill.
    const shorthand = /^([\w.-]+\/[\w.-]+)@([\w.-]+)$/.exec(source)
    if (shorthand) {
        source = shorthand[1]
        name ??= shorthand[2]
    }
    const cleaned = source
        .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
        .replace(/^github\.com\//i, "")
        .replace(/[?#].*$/, "")
        .replace(/\.git$/i, "")
        .replace(/\/+$/, "")
    const [owner, repo, ...rest] = cleaned.split("/")
    if (!owner || !repo || !/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) return null
    // Links copied from the site read /tree/<branch>/<path> or /blob/<branch>/<path>.
    const linked = rest[0] === "tree" || rest[0] === "blob"
    const ref = linked ? rest[1] : undefined
    const path = (linked ? rest.slice(2) : rest)
        .join("/")
        .replace(new RegExp(`/?${SKILL_MAIN_FILE}$`), "")
    if (path && normalizeSkillPath(path) === null) return null
    return { repo: `${owner}/${repo}`, ref, path, ...(name ? { name } : {}) }
}
