export function getBundledCloudDevEnv(
    env: Record<string, string | undefined>
): Record<string, string | undefined>

export function previewCloudDev(options?: { buildOnly?: boolean }): Promise<void>

export const BUNDLED_HOTKEYS: ReadonlyArray<{ key: string; action: string; description: string }>
export function createBundledRebuilder(options: {
    stopFrontend(): void | Promise<void>
    build(): void | Promise<void>
    startFrontend(): void | Promise<void>
    restartTunnel(): void | Promise<void>
    isStopping(): boolean
    log(message: string): void
}): (restartAll?: boolean) => Promise<boolean>
