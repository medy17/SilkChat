import clsx from "clsx"
import * as Motion from "motion/react"
import * as React from "react"
import * as ReactDOM from "react-dom"
import * as JsxRuntime from "react/jsx-runtime"
import * as Recharts from "recharts"
import * as TailwindMerge from "tailwind-merge"
import { SILK_APP_CHUNKS } from "./chunks"
import type { SilkAppModules } from "./evaluate"
import * as Kit from "./kit"

declare global {
    // React for lazy chunks, which are built against it rather than bundling a copy.
    var __SILK_APP_SHARED__: Record<string, unknown>
    // Where each lazy chunk registers its module once loaded.
    var __SILK_APP_CHUNKS__: Record<string, unknown>
}

globalThis.__SILK_APP_SHARED__ = {
    react: React,
    "react/jsx-runtime": JsxRuntime,
    "react-dom": ReactDOM
}
globalThis.__SILK_APP_CHUNKS__ = {}

/** Heavy modules loaded only by apps that import them, mapped to their chunk file. */
export const SILK_APP_LAZY_MODULES: Record<string, string> = Object.fromEntries(
    Object.entries(SILK_APP_CHUNKS).flatMap(([name, chunk]) =>
        Object.keys(chunk.provides).map((key) => [key, `${name}.js`])
    )
)

const withExportGuard = (
    source: Record<string, unknown>,
    fallback: (property: string) => unknown
) =>
    new Proxy(source, {
        get(target, property, receiver) {
            const value = Reflect.get(target, property, receiver)
            if (value !== undefined || typeof property !== "string" || !/^[A-Z]/.test(property)) {
                return value
            }
            return fallback(property)
        }
    })

// Unknown kit components fail with a message naming the export, not React's
// "element type is invalid".
const kit = withExportGuard(Kit as Record<string, unknown>, (property) => {
    throw new Error(`@silk/ui has no export named "${property}".`)
})

export const SILK_APP_MODULES: SilkAppModules = {
    react: React,
    "react/jsx-runtime": JsxRuntime,
    "react-dom": ReactDOM,
    recharts: Recharts,
    "motion/react": Motion,
    "@silk/ui": kit,
    clsx: { __esModule: true, default: clsx, clsx },
    "tailwind-merge": TailwindMerge
}

// Captured while this bundle executes; chunks sit beside it.
const chunkBase = (() => {
    const src = (document.currentScript as HTMLScriptElement | null)?.src ?? ""
    return `${src.slice(0, src.lastIndexOf("/") + 1)}chunks/`
})()

const pendingChunks = new Map<string, Promise<void>>()

// Keyed by file: one chunk can provide several modules (three and its addons).
const loadChunk = (key: string, file: string) => {
    const pending =
        pendingChunks.get(file) ??
        new Promise<void>((resolve, reject) => {
            const script = document.createElement("script")
            script.src = `${chunkBase}${file}`
            script.onload = () => resolve()
            script.onerror = () => {
                pendingChunks.delete(file)
                script.remove()
                reject(new Error(`Couldn't load "${key}" for this app.`))
            }
            document.head.append(script)
        })
    pendingChunks.set(file, pending)
    return pending
}

/** Loads any lazy modules among `keys` into the registry. */
export const loadSilkAppModules = async (keys: Iterable<string>) => {
    await Promise.all(
        [...keys].flatMap((key) => {
            const file = SILK_APP_LAZY_MODULES[key]
            if (!file || key in SILK_APP_MODULES) return []
            return [
                loadChunk(key, file).then(() => {
                    const loaded = globalThis.__SILK_APP_CHUNKS__[key] as Record<string, unknown>
                    if (!loaded) throw new Error(`Couldn't load "${key}" for this app.`)
                    // Models regularly invent icon names; a missing icon renders a neutral
                    // glyph instead of crashing the app.
                    SILK_APP_MODULES[key] =
                        key === "lucide-react"
                            ? withExportGuard(loaded, () => loaded.Circle)
                            : loaded
                })
            ]
        })
    )
}
