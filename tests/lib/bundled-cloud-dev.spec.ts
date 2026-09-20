import { describe, expect, it } from "vitest"
import {
    BUNDLED_HOTKEYS,
    createBundledRebuilder,
    getBundledCloudDevEnv
} from "../../scripts/preview-cloud-dev.mjs"

import {
    getHotkeyAction,
    getHotkeyHelpLines,
    TerminalDock
} from "../../scripts/lib/runner-utils.mjs"

const cloudDev = {
    CLOUD_DEV_CONVEX_URL: "https://dev.convex.cloud",
    CLOUD_DEV_CONVEX_API_URL: "https://dev.convex.site",
    CLOUD_DEV_CONVEX_SITE_URL: "https://dev.convex.site"
}

describe("bundled cloud-dev environment", () => {
    it("uses the dev backend at build and runtime while preserving app configuration", () => {
        const result = getBundledCloudDevEnv({
            ...cloudDev,
            VITE_CONVEX_URL: "https://production.convex.cloud",
            VITE_CONVEX_API_URL: "https://production.convex.site",
            VITE_CONVEX_SITE_URL: "https://production.convex.site",
            VITE_R2_PUBLIC_BASE_URL: "https://dev-images.example.com",
            NODE_ENV: "development",
            PORT: "4000"
        })
        expect(result.VITE_CONVEX_URL).toBe(cloudDev.CLOUD_DEV_CONVEX_URL)
        expect(result.VITE_CONVEX_API_URL).toBe(cloudDev.CLOUD_DEV_CONVEX_API_URL)
        expect(result.VITE_CONVEX_SITE_URL).toBe(cloudDev.CLOUD_DEV_CONVEX_SITE_URL)
        expect(result.VITE_R2_PUBLIC_BASE_URL).toBe("https://dev-images.example.com")
        expect(result.NODE_ENV).toBe("production")
        expect(result.PORT).toBe("3000")
        expect(result.NITRO_PORT).toBe("3000")
    })

    it("fails before building when any cloud-dev endpoint is missing", () => {
        for (const name of Object.keys(cloudDev)) {
            expect(() => getBundledCloudDevEnv({ ...cloudDev, [name]: "  " })).toThrow(name)
        }
    })

    it("keeps tunnel credentials out of app children and disables source-map uploads", () => {
        const env = {
            ...cloudDev,
            CLOUDFLARE_TUNNEL_TOKEN: "tunnel-token",
            TUNNEL_TOKEN: "other-token",
            POSTHOG_API_KEY: "upload-key"
        }
        const result = getBundledCloudDevEnv(env)
        expect(result.CLOUDFLARE_TUNNEL_TOKEN).toBeUndefined()
        expect(result.TUNNEL_TOKEN).toBeUndefined()
        expect(result.POSTHOG_API_KEY).toBe("")
        expect(result.VITE_LOCAL_IMAGE_OPTIMIZER_ENABLED).toBe("0")
        expect(env.POSTHOG_API_KEY).toBe("upload-key")
    })
})

describe("bundled terminal controls", () => {
    it("keeps the bundled control row visible after log output at narrow widths", () => {
        const lines = getHotkeyHelpLines(52, BUNDLED_HOTKEYS)
        expect(lines.every((line) => line.length <= 52)).toBe(true)
        expect(lines.join(" ")).toContain("[f] Rebuild Frontend")
        expect(getHotkeyAction("F", BUNDLED_HOTKEYS)).toBe("rebuildFrontend")
        expect(getHotkeyAction("i", BUNDLED_HOTKEYS)).toBeNull()
        let output = ""
        const dock = new TerminalDock(
            {
                columns: 52,
                write: (text) => {
                    output += text
                }
            },
            true,
            BUNDLED_HOTKEYS
        )
        dock.refresh()
        output = ""
        dock.log("Build complete")
        expect(output).toContain("\u001B[0J")
        expect(output.indexOf("Build complete")).toBeLessThan(
            output.indexOf("[f] Rebuild Frontend")
        )
        expect(output).toContain("[q] Quit")
        dock.close()
    })

    it("stops the old frontend and ignores overlapping rebuilds before starting the new bundle", async () => {
        const events: string[] = []
        let finishBuild!: () => void
        const building = new Promise<void>((resolve) => {
            finishBuild = resolve
        })
        const rebuild = createBundledRebuilder({
            stopFrontend: () => {
                events.push("stop")
            },
            build: async () => {
                events.push("build")
                await building
            },
            startFrontend: () => {
                events.push("start")
            },
            restartTunnel: () => {
                events.push("tunnel")
            },
            isStopping: () => false,
            log: () => {}
        })
        const first = rebuild(true)
        await Promise.resolve()
        expect(events).toEqual(["stop", "build"])
        expect(await rebuild()).toBe(false)
        finishBuild()
        expect(await first).toBe(true)
        expect(events).toEqual(["stop", "build", "tunnel", "start"])
    })

    it("does not serve a failed build and accepts a retry", async () => {
        let fails = true
        let starts = 0
        const rebuild = createBundledRebuilder({
            stopFrontend: () => {},
            build: () => {
                if (fails) throw new Error("compile failed")
            },
            startFrontend: () => {
                starts++
            },
            restartTunnel: () => {},
            isStopping: () => false,
            log: () => {}
        })
        expect(await rebuild()).toBe(false)
        expect(starts).toBe(0)
        fails = false
        expect(await rebuild()).toBe(true)
        expect(starts).toBe(1)
    })

    it("does not start services if shutdown begins while a build is running", async () => {
        let stopping = false
        const started: string[] = []
        const rebuild = createBundledRebuilder({
            stopFrontend: () => {},
            build: () => {
                stopping = true
            },
            startFrontend: () => {
                started.push("frontend")
            },
            restartTunnel: () => {
                started.push("tunnel")
            },
            isStopping: () => stopping,
            log: () => {}
        })
        expect(await rebuild(true)).toBe(false)
        expect(started).toEqual([])
    })
})
