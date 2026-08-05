import { EventEmitter } from "node:events"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
    DEV_HOTKEYS,
    createLineCollector,
    formatServiceLogLine,
    getHotkeyAction,
    getHotkeyHelpLines,
    stopChild
} from "../../scripts/run-cloud-dev-app.mjs"

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
        expect(getHotkeyAction("F")).toBe("restartFrontend")
        expect(getHotkeyAction("x")).toBeNull()
    })

    it("packs the controls within the available terminal width", () => {
        const lines = getHotkeyHelpLines(52)

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
        expect(formatServiceLogLine("frontend", "    at render (app.ts:10:2)", "stderr")).toBe(
            "[frontend:error]     at render (app.ts:10:2)"
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

    it("finishes shutdown after force-stopping an unresponsive child", async () => {
        vi.useFakeTimers()
        const child = new EventEmitter() as EventEmitter & {
            exitCode: number | null
            signalCode: NodeJS.Signals | null
            kill: ReturnType<typeof vi.fn>
        }
        child.exitCode = null
        child.signalCode = null
        child.kill = vi.fn(() => true)

        const stopped = stopChild(child, 100)
        await vi.advanceTimersByTimeAsync(100)
        await stopped

        expect(child.kill).toHaveBeenNthCalledWith(1, "SIGTERM")
        expect(child.kill).toHaveBeenNthCalledWith(2, "SIGKILL")
    })
})
