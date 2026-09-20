export type RunnerHotkey = { key: string; action: string; description: string }

export function getHotkeyAction(input: string, hotkeys: ReadonlyArray<RunnerHotkey>): string | null
export function getHotkeyHelpLines(columns: number, hotkeys: ReadonlyArray<RunnerHotkey>): string[]
export class TerminalDock {
    constructor(
        output: { write(value: string): unknown; columns?: number },
        interactive: boolean,
        hotkeys: ReadonlyArray<RunnerHotkey>
    )
    log(message: string): void
    refresh(): void
    close(): void
}
export function formatServiceLogLine(service: string, line: string, colour?: boolean): string
export function createLineCollector(onLine: (line: string) => void): {
    push(chunk: string | Uint8Array): void
    flush(): void
}
export function stopChild(child: unknown, timeoutMs?: number): Promise<void>
export function waitForHttpReady(
    url: string,
    options?: {
        timeoutMs?: number
        intervalMs?: number
        fetchImpl?: typeof fetch
    }
): Promise<void>

export interface RunnerChild {
    stdout: ReadableStream<Uint8Array>
    stderr: ReadableStream<Uint8Array>
    exited: Promise<number>
    exitCode: number | null
    signalCode?: string | null
    kill(signal: string): void
}
export interface RunnerProcessHandle {
    child: RunnerChild
    done: Promise<number>
}
export type RunnerEnv = Record<string, string | undefined>
export type RunnerExitHandler = (code: number, signal?: string | null) => void
export interface RunnerProcesses {
    start(
        service: string,
        command: string[],
        env?: RunnerEnv,
        onExit?: RunnerExitHandler
    ): RunnerProcessHandle | null
    stop(service: string): Promise<void>
    restart(
        service: string,
        command: string[],
        env?: RunnerEnv,
        onExit?: RunnerExitHandler
    ): Promise<RunnerProcessHandle | null | undefined>
    stopAll(): Promise<void>
    isStopping(): boolean
}
export function createRunnerProcesses(options: {
    log(message: string): void
    colour?: boolean
    spawn?: (
        command: string[],
        options: { env: RunnerEnv; stdin: string; stdout: string; stderr: string }
    ) => RunnerChild
}): RunnerProcesses
export function createBackendSync(
    processes: RunnerProcesses,
    log: (message: string) => void,
    prefix: string
): () => Promise<void>
export function installRunnerControls(options: {
    dock: Pick<TerminalDock, "log" | "refresh" | "close">
    processes: Pick<RunnerProcesses, "stopAll">
    interactive: boolean
    hotkeys: ReadonlyArray<RunnerHotkey>
    actions: Record<string, () => unknown>
    prefix: string
    showHelp?: boolean
    signalCodes?: { SIGINT: number; SIGTERM: number }
    input?: Pick<
        NodeJS.ReadStream,
        "isRaw" | "setRawMode" | "setEncoding" | "resume" | "pause" | "on" | "removeListener"
    >
    output?: Pick<NodeJS.WriteStream, "on" | "removeListener">
    signals?: Pick<NodeJS.Process, "on" | "removeListener">
    exit?: (code: number) => void
}): (code?: number) => Promise<void>
