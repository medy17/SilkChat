import { type Infer, ConvexError, v } from "convex/values"
import { internal } from "./_generated/api"
import { type ActionCtx, action, internalAction, internalQuery } from "./_generated/server"
import { r2 } from "./attachments"
import { getAccountDeletionBlockerForAction } from "./lib/account_deletion_gate"
import { getUserIdentity } from "./lib/identity"
import {
    MAX_SKILL_BUNDLE_BYTES,
    MAX_SKILL_FILES,
    MAX_SKILL_FILE_BYTES,
    SKILL_MAIN_FILE,
    type SkillBundleFile,
    SkillBundleError,
    findSkillRoots,
    getSkillFileKey,
    isScriptPath,
    normalizeSkillPath,
    parseGithubSkillReference,
    parseSkillBundle,
    parseSkillFrontmatter,
    toSkillSlug
} from "./lib/skill_bundle"
import type { SkillSource } from "./schema/skill"

const GITHUB_API = "https://api.github.com"
const DOWNLOAD_CONCURRENCY = 8
const UPLOAD_CONCURRENCY = 6

const TEXT_TYPES: Record<string, string> = {
    md: "text/markdown",
    json: "application/json",
    html: "text/html",
    css: "text/css",
    csv: "text/csv",
    xml: "application/xml",
    svg: "image/svg+xml"
}

const getContentType = (path: string, text: boolean) => {
    const extension = /\.([^./]+)$/.exec(path)?.[1]?.toLowerCase() ?? ""
    return TEXT_TYPES[extension] ?? (text ? "text/plain" : "application/octet-stream")
}

const inBatches = async <T, R>(items: T[], size: number, run: (item: T) => Promise<R>) => {
    const results: R[] = []
    for (let start = 0; start < items.length; start += size) {
        results.push(...(await Promise.all(items.slice(start, start + size).map(run))))
    }
    return results
}

const requireInstaller = async (ctx: ActionCtx) => {
    const user = await getUserIdentity(ctx.auth, { allowAnons: false })
    if ("error" in user) throw new ConvexError("Unauthorized")
    if (await getAccountDeletionBlockerForAction(ctx, user.id)) {
        throw new ConvexError("Account deletion is in progress")
    }
    return user.id
}

const githubHeaders = () => ({
    Accept: "application/vnd.github+json",
    "User-Agent": "skill-installer",
    "X-GitHub-Api-Version": "2022-11-28",
    // Optional. Without it GitHub allows far fewer requests an hour.
    ...(process.env.SKILLS_GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.SKILLS_GITHUB_TOKEN}` }
        : {})
})

const githubJson = async <T>(path: string): Promise<T> => {
    let response: Response
    try {
        response = await fetch(`${GITHUB_API}${path}`, { headers: githubHeaders() })
    } catch {
        throw new ConvexError("GitHub couldn't be reached. Try again.")
    }
    if (response.status === 404) {
        throw new ConvexError(
            "That repository or folder wasn't found. Private repositories can't be added."
        )
    }
    if (response.status === 403 || response.status === 429) {
        throw new ConvexError("GitHub is limiting requests right now. Try again in a few minutes.")
    }
    if (!response.ok) throw new ConvexError("GitHub couldn't be reached. Try again.")
    return (await response.json()) as T
}

type GithubTreeEntry = { path: string; type: string; size?: number }

const MAX_SKILL_CHOICES = 200
/** How many SKILL.md files are opened to find a skill by the name it gives itself. */
const MAX_NAME_LOOKUPS = 80

export type SkillChoice = { name: string; path: string }

/** The link points at several skills and doesn't say which one. */
class SeveralSkillsError extends Error {
    constructor(readonly choices: SkillChoice[]) {
        super("Several skills")
    }
}

const folderName = (root: string, repo: string) => root.split("/").pop() || repo.split("/")[1]

// One entry per skill name. A repository can list the same skill in more than one folder,
// and the shallowest copy is the one meant.
const toSkillChoices = (roots: string[], repo: string) => {
    const choices = new Map<string, SkillChoice>()
    for (const root of roots) {
        const name = folderName(root, repo)
        if (!choices.has(name)) choices.set(name, { name, path: root })
    }
    return [...choices.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, MAX_SKILL_CHOICES)
}

type GithubSkillTarget = {
    repo: string
    ref?: string
    path: string
    name?: string
    // The path is the skill's own folder ("" for the repository itself), not somewhere to
    // look inside.
    exactPath?: boolean
}

const rawGithubUrl = (repo: string, commit: string, path: string) =>
    `https://raw.githubusercontent.com/${repo}/${commit}/${path.split("/").map(encodeURIComponent).join("/")}`

// Picks the one skill a link means: the folder it names, the skill with the name given
// (the folder's, or the one the skill gives itself), or the only skill there is.
const chooseSkillRoot = async (
    allRoots: string[],
    { repo, path, name, exactPath }: GithubSkillTarget,
    commit: string
) => {
    if (allRoots.length === 0) throw new ConvexError("There is no SKILL.md in that repository.")
    if (exactPath) {
        if (allRoots.includes(path)) return path
        throw new ConvexError("That skill is no longer in the repository.")
    }
    let roots = allRoots
    if (path) {
        if (roots.includes(path)) return path
        roots = roots.filter((root) => root.startsWith(`${path}/`))
        if (roots.length === 0) throw new ConvexError("There is no SKILL.md in that folder.")
    }
    if (name) {
        const wanted = toSkillSlug(name)
        const byFolder = roots.find((root) => toSkillSlug(folderName(root, repo)) === wanted)
        if (byFolder !== undefined) return byFolder
        // A skill's folder doesn't have to carry its name.
        const named = await inBatches(
            roots.slice(0, MAX_NAME_LOOKUPS),
            DOWNLOAD_CONCURRENCY,
            async (root) => {
                const response = await fetch(
                    rawGithubUrl(repo, commit, `${root ? `${root}/` : ""}${SKILL_MAIN_FILE}`)
                )
                if (!response.ok) return null
                const { fields } = parseSkillFrontmatter(await response.text())
                return toSkillSlug(fields.name ?? "") === wanted ? root : null
            }
        )
        const bySelf = named.find((root) => root !== null)
        if (bySelf !== undefined && bySelf !== null) return bySelf
        // The store goes on listing a skill after its repository drops it.
        throw new ConvexError(
            `There is no skill named "${name}" in that repository. It may have been removed.`
        )
    }
    if (roots.length === 1) return roots[0]
    throw new SeveralSkillsError(toSkillChoices(roots, repo))
}

// Finds the skill a link means and lists its files, without downloading them.
const locateGithubSkill = async (target: GithubSkillTarget) => {
    const { repo, ref } = target
    const commit = await githubJson<{ sha: string; commit: { tree: { sha: string } } }>(
        `/repos/${repo}/commits/${encodeURIComponent(ref ?? "HEAD")}`
    )
    const tree = await githubJson<{ tree: GithubTreeEntry[] }>(
        `/repos/${repo}/git/trees/${commit.commit.tree.sha}?recursive=1`
    )
    const blobs = tree.tree.filter((entry) => entry.type === "blob")
    const root = await chooseSkillRoot(
        findSkillRoots(blobs.map((entry) => entry.path)),
        target,
        commit.sha
    )
    const prefix = root ? `${root}/` : ""
    const wanted = blobs.filter(
        (entry) =>
            entry.path.startsWith(prefix) &&
            normalizeSkillPath(entry.path.slice(prefix.length)) !== null
    )
    // The tree lists sizes, so an oversized skill is refused before anything is downloaded.
    if (
        wanted.length > MAX_SKILL_FILES ||
        wanted.some((entry) => (entry.size ?? 0) > MAX_SKILL_FILE_BYTES) ||
        wanted.reduce((total, entry) => total + (entry.size ?? 0), 0) > MAX_SKILL_BUNDLE_BYTES
    ) {
        throw new ConvexError("This skill is too large to add.")
    }

    return {
        root,
        prefix,
        entries: wanted,
        commit: commit.sha,
        fallbackName: folderName(root, repo)
    }
}

const fetchGithubSkill = async (target: GithubSkillTarget) => {
    const located = await locateGithubSkill(target)
    const files = await inBatches(located.entries, DOWNLOAD_CONCURRENCY, async (entry) => {
        const response = await fetch(rawGithubUrl(target.repo, located.commit, entry.path))
        if (!response.ok) throw new ConvexError("A file in that skill couldn't be downloaded.")
        return {
            path: entry.path.slice(located.prefix.length),
            bytes: new Uint8Array(await response.arrayBuffer())
        }
    })
    return { ...located, files }
}

type InstallResult = { slug: string; status: "added" | "updated" | "unchanged" }

const installBundle = async (
    ctx: ActionCtx,
    {
        userId,
        files,
        source,
        fallbackName,
        expectedSlug
    }: {
        userId: string
        files: SkillBundleFile[]
        source: Infer<typeof SkillSource>
        fallbackName?: string
        // The skill being updated. A source that has renamed it would arrive as a second skill.
        expectedSlug?: string
    }
): Promise<InstallResult> => {
    let bundle: Awaited<ReturnType<typeof parseSkillBundle>>
    try {
        bundle = await parseSkillBundle(files, { fallbackName })
    } catch (error) {
        if (error instanceof SkillBundleError) throw new ConvexError(error.message)
        throw error
    }
    if (expectedSlug !== undefined && bundle.slug !== expectedSlug) {
        throw new ConvexError(
            `This skill is now named "${bundle.slug}" at its source. Add it under that name to keep it up to date.`
        )
    }

    const state = await ctx.runQuery(internal.skills.getInstallState, {
        userId,
        slug: bundle.slug,
        hash: bundle.hash,
        source
    })
    if (state.libraryFull) throw new ConvexError("Your skill library is full. Remove one first.")
    if (state.installed && !state.sameSource) {
        throw new ConvexError(
            `You already have a skill named "${bundle.slug}" from somewhere else. Remove it first.`
        )
    }
    if (state.upToDate) return { slug: bundle.slug, status: "unchanged" as const }

    if (!state.versionStored) {
        const kept = new Map(bundle.files.map((file) => [file.path, file]))
        await inBatches(
            files.filter((file) => kept.has(normalizeSkillPath(file.path) ?? "")),
            UPLOAD_CONCURRENCY,
            async (file) => {
                const path = normalizeSkillPath(file.path) as string
                await r2.store(ctx, file.bytes, {
                    authorId: userId,
                    key: getSkillFileKey(userId, bundle.slug, bundle.hash, path),
                    type: getContentType(path, kept.get(path)?.text === true)
                })
            }
        )
    }

    await ctx.runMutation(internal.skills.commitInstall, {
        userId,
        slug: bundle.slug,
        hash: bundle.hash,
        description: bundle.description,
        instructions: bundle.instructions,
        instructionTokens: bundle.instructionTokens,
        files: bundle.files,
        runsCode: bundle.runsCode,
        sizeBytes: bundle.sizeBytes,
        source
    })
    return {
        slug: bundle.slug,
        status: state.installed ? ("updated" as const) : ("added" as const)
    }
}

/** Adds a skill from a public repository: `owner/repo`, optionally with the skill's folder. */
export const installFromGithub = action({
    args: {
        reference: v.string(),
        // The store's name for the skill, to find it in a repository that holds several.
        name: v.optional(v.string()),
        // The skill's own folder, as one of the choices below named it.
        exactPath: v.optional(v.string()),
        fromStore: v.optional(v.boolean())
    },
    handler: async (
        ctx,
        { reference, name, exactPath, fromStore }
    ): Promise<
        InstallResult | { status: "choose"; repo: string; reference: string; skills: SkillChoice[] }
    > => {
        const userId = await requireInstaller(ctx)
        const parsed = parseGithubSkillReference(reference)
        if (!parsed) throw new ConvexError("That doesn't look like a GitHub repository.")
        let fetched: Awaited<ReturnType<typeof fetchGithubSkill>>
        try {
            fetched = await fetchGithubSkill(
                exactPath !== undefined
                    ? { repo: parsed.repo, ref: parsed.ref, path: exactPath, exactPath: true }
                    : { ...parsed, name: name ?? parsed.name }
            )
        } catch (error) {
            // A repository with several skills and no pick: hand the list back to choose from.
            if (error instanceof SeveralSkillsError) {
                return {
                    status: "choose",
                    repo: parsed.repo,
                    // What to send back with the pick, so a link to a branch stays on it.
                    reference: parsed.ref
                        ? `https://github.com/${parsed.repo}/tree/${parsed.ref}`
                        : parsed.repo,
                    skills: error.choices
                }
            }
            throw error
        }
        return await installBundle(ctx, {
            userId,
            files: fetched.files,
            fallbackName: fetched.fallbackName,
            source: {
                kind: "github",
                repo: parsed.repo,
                path: fetched.root,
                ...(parsed.ref ? { ref: parsed.ref } : {}),
                commit: fetched.commit,
                ...(fromStore ? { fromStore: true } : {})
            }
        })
    }
})

/** What a skill in a repository says and holds, read before adding it. Nothing is stored. */
export const previewFromGithub = action({
    args: { reference: v.string(), name: v.optional(v.string()) },
    handler: async (ctx, { reference, name }) => {
        await requireInstaller(ctx)
        const parsed = parseGithubSkillReference(reference)
        if (!parsed) throw new ConvexError("That doesn't look like a GitHub repository.")
        let located: Awaited<ReturnType<typeof locateGithubSkill>>
        try {
            located = await locateGithubSkill({ ...parsed, name: name ?? parsed.name })
        } catch (error) {
            if (error instanceof SeveralSkillsError) {
                throw new ConvexError("That repository holds several skills.")
            }
            throw error
        }
        const response = await fetch(
            rawGithubUrl(parsed.repo, located.commit, `${located.prefix}${SKILL_MAIN_FILE}`)
        )
        if (!response.ok) throw new ConvexError("That skill couldn't be read.")
        const main = new Uint8Array(await response.arrayBuffer())
        try {
            const bundle = await parseSkillBundle([{ path: SKILL_MAIN_FILE, bytes: main }], {
                fallbackName: located.fallbackName
            })
            const paths = located.entries.map((entry) => entry.path.slice(located.prefix.length))
            return {
                slug: bundle.slug,
                description: bundle.description,
                instructions: bundle.instructions,
                path: located.root,
                files: paths.sort((a, b) => a.localeCompare(b)),
                runsCode: paths.some(isScriptPath)
            }
        } catch (error) {
            if (error instanceof SkillBundleError) throw new ConvexError(error.message)
            throw error
        }
    }
})

/** Adds a skill from files the browser unpacked from a .zip. */
export const installFromUpload = action({
    args: {
        files: v.array(v.object({ path: v.string(), bytes: v.bytes() })),
        fileName: v.optional(v.string())
    },
    handler: async (ctx, { files, fileName }): Promise<InstallResult> => {
        const userId = await requireInstaller(ctx)
        if (
            files.length > MAX_SKILL_FILES * 2 ||
            files.reduce((total, file) => total + file.bytes.byteLength, 0) > MAX_SKILL_BUNDLE_BYTES
        ) {
            throw new ConvexError("This skill is too large to add.")
        }
        const entries = files.flatMap((file) => {
            const path = normalizeSkillPath(file.path)
            return path ? [{ path, bytes: new Uint8Array(file.bytes) }] : []
        })
        // A .zip usually wraps the skill in one folder.
        const roots = findSkillRoots(entries.map((entry) => entry.path))
        if (roots.length === 0) {
            throw new ConvexError(`That .zip has no ${SKILL_MAIN_FILE} in it.`)
        }
        const depth = (root: string) => (root ? root.split("/").length : 0)
        if (roots.length > 1 && depth(roots[0]) === depth(roots[1])) {
            throw new ConvexError("That .zip holds more than one skill. Add them one at a time.")
        }
        const prefix = roots[0] ? `${roots[0]}/` : ""
        return await installBundle(ctx, {
            userId,
            files: entries
                .filter((entry) => entry.path.startsWith(prefix))
                .map((entry) => ({ path: entry.path.slice(prefix.length), bytes: entry.bytes })),
            fallbackName: roots[0].split("/").pop() || fileName?.replace(/\.zip$/i, ""),
            source: { kind: "upload", ...(fileName ? { fileName } : {}) }
        })
    }
})

export const getSkillSourceInternal = internalQuery({
    args: { userId: v.string(), skillId: v.id("skills") },
    handler: async (ctx, { userId, skillId }) => {
        const skill = await ctx.db.get(skillId)
        if (!skill || skill.userId !== userId) return null
        const source = (await ctx.db.get(skill.currentVersionId))?.source
        return source ? { slug: skill.slug, source } : null
    }
})

/** Fetches a skill's source again and moves to the new version if it changed. */
export const updateMySkill = action({
    args: { skillId: v.id("skills") },
    handler: async (ctx, { skillId }): Promise<InstallResult> => {
        const userId = await requireInstaller(ctx)
        const installed = await ctx.runQuery(internal.skills_install.getSkillSourceInternal, {
            userId,
            skillId
        })
        if (!installed) throw new ConvexError("Skill not found")
        const { slug, source } = installed
        if (source.kind !== "github") {
            throw new ConvexError("Upload the new .zip to update this skill.")
        }
        // The same folder on the same branch, and nothing else: a repository that has gained
        // skills or moved this one must not hand back a different skill.
        const fetched = await fetchGithubSkill({
            repo: source.repo,
            ref: source.ref,
            path: source.path,
            exactPath: true
        })
        return await installBundle(ctx, {
            userId,
            files: fetched.files,
            fallbackName: fetched.fallbackName,
            source: { ...source, commit: fetched.commit },
            expectedSlug: slug
        })
    }
})

export const deleteStoredFiles = internalAction({
    args: { keys: v.array(v.string()) },
    handler: async (ctx, { keys }) => {
        await Promise.allSettled(keys.map((key) => r2.deleteObject(ctx, key)))
    }
})
