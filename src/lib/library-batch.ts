// Embed the palette slot in the opaque ID to preserve colour across reloads and pagination.
const BATCH_COLOR_COUNT = 6

export function createLibraryBatchId(previousBatchId?: string): string {
    const previousSlot = previousBatchId ? Number(previousBatchId.split(":")[0]) : -1
    const slot = Number.isInteger(previousSlot) ? (previousSlot + 1) % BATCH_COLOR_COUNT : 0
    return `${slot}:${crypto.randomUUID()}`
}

export function getLibraryBatchColor(batchId?: string): string | undefined {
    if (!batchId) return undefined
    const slot = Number(batchId.split(":")[0])
    if (!Number.isInteger(slot) || slot < 0 || slot >= BATCH_COLOR_COUNT) return undefined
    return `var(--library-batch-${slot + 1})`
}
