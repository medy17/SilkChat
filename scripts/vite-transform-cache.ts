// Keeps a transform plugin's output on disk so a cold dev server doesn't redo it. Used for
// the React Compiler pass, which is the slowest step on a cold start and is a pure function
// of a module's id and source. Entries are keyed by both plus a salt (lockfile, Vite config,
// mode); anything else reaching the output belongs in the salt.

import { createHash } from "node:crypto"
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

type CachedTransform = { code?: string; map?: unknown } | null

type TransformHandler = (
    this: { environment?: { name: string } },
    code: string,
    id: string,
    options?: unknown
) => unknown

const PRUNE_DELAY_MS = 60_000

const isCacheable = (result: unknown): result is CachedTransform | undefined =>
    result == null ||
    (typeof result === "object" &&
        Object.keys(result).every((key) => key === "code" || key === "map"))

export const transformCacheKey = (salt: string, environment: string, id: string, code: string) =>
    createHash("sha256")
        .update(salt)
        .update("\0")
        .update(environment)
        .update("\0")
        .update(id)
        .update("\0")
        .update(code)
        .digest("hex")

// Drops the oldest entries once the cache passes maxEntries, keeping half of it.
const prune = async (dir: string, maxEntries: number) => {
    const names = (await readdir(dir)).filter((name) => name.endsWith(".json"))
    if (names.length <= maxEntries) return
    const entries = await Promise.all(
        names.map(async (name) => {
            const file = path.join(dir, name)
            return { file, mtime: (await stat(file).catch(() => null))?.mtimeMs ?? 0 }
        })
    )
    entries.sort((left, right) => left.mtime - right.mtime)
    await Promise.all(
        entries
            .slice(0, entries.length - Math.floor(maxEntries / 2))
            .map(({ file }) => unlink(file).catch(() => {}))
    )
}

type TransformHook = TransformHandler | { handler: TransformHandler }

// Generic over the plugin type: Rolldown plugins (like @rolldown/plugin-babel) and Vite
// plugins type their hooks differently but share this shape.
export const withTransformCache = async <P extends { transform?: unknown }>(
    pluginInput: P | Promise<P>,
    { dir, salt, maxEntries = 3000 }: { dir: string; salt: string; maxEntries?: number }
): Promise<P> => {
    const plugin = await pluginInput
    const hook = plugin.transform as TransformHook | undefined
    if (!hook) return plugin
    const handler = typeof hook === "function" ? hook : hook.handler
    let ready: Promise<unknown> | undefined

    const cachedHandler: TransformHandler = async function (code, id, options) {
        ready ??= mkdir(dir, { recursive: true }).then(() => {
            setTimeout(() => void prune(dir, maxEntries).catch(() => {}), PRUNE_DELAY_MS).unref()
        })
        await ready
        const file = path.join(
            dir,
            `${transformCacheKey(salt, this.environment?.name ?? "", id, code)}.json`
        )

        try {
            return JSON.parse(await readFile(file, "utf8")) as CachedTransform
        } catch {}

        const result = await handler.call(this, code, id, options)
        if (isCacheable(result)) {
            // Write beside the entry and rename, so a concurrent reader never sees half a file.
            const temp = `${file}.${process.pid}.tmp`
            void writeFile(temp, JSON.stringify(result ?? null))
                .then(() => rename(temp, file))
                .catch(() => unlink(temp).catch(() => {}))
        }
        return result
    }

    // Swap the handler in place: the plugin reassigns its own transform.filter later.
    if (typeof hook === "function") (plugin as { transform?: unknown }).transform = cachedHandler
    else hook.handler = cachedHandler
    return plugin
}
