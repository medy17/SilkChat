export const DEV_HOTKEYS: ReadonlyArray<{
    key: string
    action: string
    description: string
}>

export function getHotkeyAction(input: string): string | null
export function getHotkeyHelpLines(columns?: number): string[]
export function formatServiceLogLine(
    service: string,
    line: string,
    stream?: "stdout" | "stderr"
): string
export function createLineCollector(onLine: (line: string) => void): {
    push(chunk: string | Uint8Array): void
    flush(): void
}
export function stopChild(child: unknown, timeoutMs?: number): Promise<void>
