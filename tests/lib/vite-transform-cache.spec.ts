import { mkdtemp, readdir, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { Plugin } from "vite"
import { afterEach, describe, expect, it, vi } from "vitest"
import { withTransformCache } from "../../scripts/vite-transform-cache"

const dirs: string[] = []

afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const setup = async (result: (code: string) => unknown = (code) => ({ code: `/*c*/${code}` })) => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "transform-cache-"))
    dirs.push(dir)
    const handler = vi.fn((code: string) => result(code))
    const plugin = await withTransformCache(
        { name: "inner", transform: { filter: { code: /x/ }, handler } } as Plugin,
        { dir, salt: "salt" }
    )
    const hook = plugin.transform as { handler: (...args: unknown[]) => Promise<unknown> }
    const transform = (code: string, id = "/src/a.tsx", environment = "client") =>
        hook.handler.call({ environment: { name: environment } }, code, id)
    const entries = async () => (await readdir(dir)).filter((name) => name.endsWith(".json"))
    return { handler, transform, entries, plugin }
}

describe("withTransformCache", () => {
    it("serves an unchanged module from disk instead of transforming it again", async () => {
        const { handler, transform, entries } = await setup()

        expect(await transform("x")).toEqual({ code: "/*c*/x" })
        await vi.waitFor(async () => expect(await entries()).toHaveLength(1))

        expect(await transform("x")).toEqual({ code: "/*c*/x" })
        expect(handler).toHaveBeenCalledTimes(1)
    })

    it("transforms again when the source, id, or environment changes", async () => {
        const { handler, transform, entries } = await setup()

        await transform("x")
        await vi.waitFor(async () => expect(await entries()).toHaveLength(1))
        await transform("xx")
        await transform("x", "/src/b.tsx")
        await transform("x", "/src/a.tsx", "ssr")

        expect(handler).toHaveBeenCalledTimes(4)
        await vi.waitFor(async () => expect(await entries()).toHaveLength(4))
    })

    it("does not cache results that carry more than code and map", async () => {
        const { transform, entries } = await setup(() => ({ code: "y", meta: { kept: true } }))

        expect(await transform("x")).toEqual({ code: "y", meta: { kept: true } })
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(await entries()).toHaveLength(0)
    })

    it("keeps the plugin's own filter object so later filter updates still apply", async () => {
        const { plugin } = await setup()
        expect((plugin.transform as { filter: unknown }).filter).toEqual({ code: /x/ })
    })
})
