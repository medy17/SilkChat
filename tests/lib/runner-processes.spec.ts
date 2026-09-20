import { EventEmitter } from "node:events"
import { describe, expect, it } from "vitest"
import {
    createBackendSync,
    createRunnerProcesses,
    installRunnerControls,
    type RunnerChild
} from "../../scripts/lib/runner-utils.mjs"

function childFixture(stopImmediately = true) {
    let out!: ReadableStreamDefaultController<Uint8Array>
    let err!: ReadableStreamDefaultController<Uint8Array>
    let resolveExit!: (code: number) => void
    const kills: string[] = []
    const finish = (code: number) => {
        child.exitCode = code
        out.close()
        err.close()
        resolveExit(code)
    }
    const child: RunnerChild = {
        stdout: new ReadableStream({
            start(controller) {
                out = controller
            }
        }),
        stderr: new ReadableStream({
            start(controller) {
                err = controller
            }
        }),
        exited: new Promise((resolve) => {
            resolveExit = resolve
        }),
        exitCode: null,
        kill(signal) {
            kills.push(signal)
            if (stopImmediately) finish(0)
        }
    }
    return { child, finish, kills, out: () => out, err: () => err }
}

describe("shared runner processes", () => {
    it("drains both streams, including final partial lines, before reporting completion", async () => {
        const fixture = childFixture()
        const logs: string[] = []
        const processes = createRunnerProcesses({
            log: (line) => logs.push(line),
            spawn: () => fixture.child
        })
        const handle = processes.start("build", ["fake-build"])!
        fixture.out().enqueue(new TextEncoder().encode("built assets\nlast line"))
        fixture.err().enqueue(new TextEncoder().encode("$ vite build\nWarning: slow plugin"))
        fixture.finish(7)
        expect(await handle.done).toBe(7)
        expect(logs).toEqual(
            expect.arrayContaining([
                "[build] built assets",
                "[build] last line",
                "[build] $ vite build",
                "[build:warn] Warning: slow plugin"
            ])
        )
    })

    it("serializes tunnel restarts and reports only unexpected exits", async () => {
        const first = childFixture(false)
        const second = childFixture()
        let starts = 0
        const exits: number[] = []
        const processes = createRunnerProcesses({
            log: () => {},
            spawn: () => (++starts === 1 ? first.child : second.child)
        })
        const onExit = (code: number) => {
            exits.push(code)
        }
        processes.start("tunnel", ["fake-tunnel"], {}, onExit)
        const restart = processes.restart("tunnel", ["fake-tunnel"], {}, onExit)
        await processes.restart("tunnel", ["fake-tunnel"], {}, onExit)
        expect(starts).toBe(1)
        expect(first.kills).toEqual(["SIGTERM"])
        first.finish(0)
        const replacement = await restart
        expect(starts).toBe(2)
        expect(exits).toEqual([])
        second.finish(1)
        await replacement!.done
        expect(exits).toEqual([1])
    })

    it("tracks a child being stopped and prevents restart after shutdown starts", async () => {
        const fixture = childFixture(false)
        let starts = 0
        const processes = createRunnerProcesses({
            log: () => {},
            spawn: () => {
                starts++
                return fixture.child
            }
        })
        processes.start("frontend", ["fake-server"])
        const restart = processes.restart("frontend", ["fake-server"])
        const shutdown = processes.stopAll()
        expect(processes.isStopping()).toBe(true)
        expect(fixture.kills).toHaveLength(2)
        fixture.finish(0)
        await Promise.all([restart, shutdown])
        expect(starts).toBe(1)
        expect(processes.start("frontend", ["fake-server"])).toBeNull()
    })

    it("allows only one backend sync and permits retry after failure", async () => {
        const fixtures = [childFixture(), childFixture()]
        const logs: string[] = []
        let starts = 0
        const processes = createRunnerProcesses({
            log: (line) => logs.push(line),
            spawn: () => fixtures[starts++].child
        })
        const sync = createBackendSync(processes, (line) => logs.push(line), "runner")
        const first = sync()
        await sync()
        expect(starts).toBe(1)
        fixtures[0].finish(1)
        await first
        expect(logs).toContain("[runner:error] Backend sync exited with code 1.")
        const retry = sync()
        expect(starts).toBe(2)
        fixtures[1].finish(0)
        await retry
        expect(logs).toContain("[runner] Backend sync complete.")
    })

    it("restores terminal input and removes handlers before waiting for children to stop", async () => {
        const rawModes: boolean[] = []
        const input = Object.assign(new EventEmitter(), {
            isRaw: false,
            setRawMode(value: boolean) {
                rawModes.push(value)
                return this
            },
            setEncoding() {
                return this
            },
            resume() {
                return this
            },
            pause() {
                return this
            }
        })
        const output = new EventEmitter()
        const signals = new EventEmitter()
        const exits: number[] = []
        let finishShutdown!: () => void
        const stopped = new Promise<void>((resolve) => {
            finishShutdown = resolve
        })
        let stops = 0
        let rebuilds = 0
        installRunnerControls({
            dock: { log() {}, refresh() {}, close() {} },
            processes: {
                stopAll: () => {
                    stops++
                    return stopped
                }
            },
            hotkeys: [
                { key: "q", action: "quit", description: "Quit" },
                { key: "f", action: "rebuild", description: "Rebuild" }
            ],
            actions: {
                rebuild: () => {
                    rebuilds++
                }
            },
            prefix: "test",
            interactive: true,
            input: input as unknown as NodeJS.ReadStream,
            output: output as NodeJS.WriteStream,
            signals: signals as NodeJS.Process,
            exit: (code) => {
                exits.push(code)
            }
        })
        input.emit("data", "qf")
        expect(rawModes).toEqual([true, false])
        expect(input.listenerCount("data")).toBe(0)
        expect(output.listenerCount("resize")).toBe(0)
        expect(signals.listenerCount("SIGTERM")).toBe(0)
        expect(stops).toBe(1)
        expect(rebuilds).toBe(0)
        expect(exits).toEqual([])
        finishShutdown()
        await stopped
        await Promise.resolve()
        expect(exits).toEqual([0])
    })
})
