import { afterEach, describe, expect, it, vi } from "vitest"
import {
    createLineCollector,
    formatServiceLogLine,
    getHotkeyAction,
    getHotkeyHelpLines,
    stopChild,
    waitForHttpReady
} from "../../scripts/lib/runner-utils.mjs"
import { DEV_HOTKEYS } from "../../scripts/run-cloud-dev-app.mjs"

describe("development runner controls", () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it("maps the required controls to single-key actions", () => {
        expect(
            Object.fromEntries(DEV_HOTKEYS.map(({ key, action }) => [key, action]))
        ).toMatchObject({
            b: "syncBackend",
            f: "restartFrontend",
            i: "restartOptimizer",
            c: "purgeOptimizerCache",
            t: "restartTunnel"
        })
        expect(getHotkeyAction("F", DEV_HOTKEYS)).toBe("restartFrontend")
        expect(getHotkeyAction("x", DEV_HOTKEYS)).toBeNull()
    })

    it("packs the controls within the available terminal width", () => {
        const lines = getHotkeyHelpLines(52, DEV_HOTKEYS)

        expect(lines.length).toBeGreaterThan(1)
        expect(lines.every((line) => line.length <= 52)).toBe(true)
        expect(lines.join(" ")).toContain("[c] Bust Optimiser Cache")
        expect(lines.at(-1)).toContain("[q] Quit")
    })

    it("wraps previously bare child traces with their service and severity", () => {
        expect(
            formatServiceLogLine(
                "tunnel",
                "2026-08-04T19:06:53Z ERR Failed to refresh DNS local resolver"
            )
        ).toBe("[tunnel:error] Failed to refresh DNS local resolver")
        expect(
            formatServiceLogLine("optimiser", "[local-image-optimizer] GET transform 200 HIT")
        ).toBe("[optimiser] GET transform 200 HIT")
        expect(
            formatServiceLogLine("optimiser", "[local-image-optimizer] Unhandled request failure")
        ).toBe("[optimiser:error] Unhandled request failure")
        expect(formatServiceLogLine("frontend", "    at render (app.ts:10:2)")).toBe(
            "[frontend:error]     at render (app.ts:10:2)"
        )
    })

    it("does not label Bun command echoes or ordinary build output as errors", () => {
        expect(formatServiceLogLine("build", "$ vite build")).toBe("[build] $ vite build")
        expect(formatServiceLogLine("backend", "$ bun scripts/push-cloud-dev.mjs")).toBe(
            "[backend] $ bun scripts/push-cloud-dev.mjs"
        )
        const coloredEcho = "\u001b[2m$ bun scripts/sync-built-in-personas.mjs\u001b[0m"
        expect(formatServiceLogLine("build", coloredEcho)).toBe(`[build] ${coloredEcho}`)
        expect(formatServiceLogLine("build", "Some chunks are larger than 500 kB.")).toBe(
            "[build] Some chunks are larger than 500 kB."
        )
    })

    it("preserves explicit build error and warning levels", () => {
        expect(formatServiceLogLine("build", "error during build:")).toBe(
            "[build:error] error during build:"
        )
        expect(formatServiceLogLine("build", "TypeError: invalid input")).toBe(
            "[build:error] TypeError: invalid input"
        )
        expect(formatServiceLogLine("build", "[WARNING] Slow plugin detected")).toBe(
            "[build:warn] [WARNING] Slow plugin detected"
        )
    })

    it("uses explicit severity consistently for all runner services", () => {
        for (const service of ["build", "frontend", "backend", "optimiser", "worker", "tunnel"]) {
            expect(formatServiceLogLine(service, "Connected and ready")).toBe(
                `[${service}] Connected and ready`
            )
            expect(formatServiceLogLine(service, "Error: connection failed")).toBe(
                `[${service}:error] Error: connection failed`
            )
            expect(formatServiceLogLine(service, "Warning: reconnecting")).toBe(
                `[${service}:warn] Warning: reconnecting`
            )
        }
    })

    it("preserves structured tunnel levels", () => {
        expect(
            formatServiceLogLine("tunnel", "2026-08-04T19:06:53Z INF Registered tunnel connection")
        ).toBe("[tunnel] Registered tunnel connection")
        expect(formatServiceLogLine("tunnel", "2026-08-04T19:06:53Z WRN Reconnecting")).toBe(
            "[tunnel:warn] Reconnecting"
        )
    })

    it("preserves partial trace lines across output chunks", () => {
        const lines: string[] = []
        const collector = createLineCollector((line) => lines.push(line))

        collector.push("first line\nsecond")
        collector.push(" line\nthird")
        collector.flush()

        expect(lines).toEqual(["first line", "second line", "third"])
    })

    it("streams Bun subprocess byte chunks as terminal lines", () => {
        const lines: string[] = []
        const collector = createLineCollector((line) => lines.push(line))
        const encoder = new TextEncoder()

        collector.push(encoder.encode("frontend ready\noptim"))
        expect(lines).toEqual(["frontend ready"])

        collector.push(encoder.encode("iser ready\n"))
        collector.flush()
        expect(lines).toEqual(["frontend ready", "optimiser ready"])
    })

    it("finishes shutdown after force-stopping an unresponsive child", async () => {
        vi.useFakeTimers()
        const child: {
            exitCode: number | null
            exited: Promise<number>
            kill: ReturnType<typeof vi.fn>
        } = {
            exitCode: null,
            exited: new Promise<number>(() => {}),
            kill: vi.fn()
        }

        const stopped = stopChild(child, 100)
        await vi.advanceTimersByTimeAsync(100)
        await stopped

        expect(child.kill).toHaveBeenNthCalledWith(1, "SIGTERM")
        expect(child.kill).toHaveBeenNthCalledWith(2, "SIGKILL")
    })

    it("waits through a transient connection failure until a service is ready", async () => {
        const fetchMock = vi
            .fn()
            .mockRejectedValueOnce(new Error("connection refused"))
            .mockResolvedValueOnce(new Response(null, { status: 200 }))

        await waitForHttpReady("http://127.0.0.1:43177/health", {
            intervalMs: 0,
            fetchImpl: fetchMock
        })

        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})
