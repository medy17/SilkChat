import { afterEach, describe, expect, it } from "vitest"
import {
    calculateSandboxUsageMicrousd,
    collectSandboxBillableUsage,
    estimatePersistentSandboxReservationMicrousd
} from "../../convex/lib/sandbox_billing"

afterEach(() => {
    for (const key of [
        "VERCEL_SANDBOX_ACTIVE_CPU_USD_PER_HOUR",
        "VERCEL_SANDBOX_MEMORY_USD_PER_GB_HOUR",
        "VERCEL_SANDBOX_CREATION_USD",
        "VERCEL_SANDBOX_TRANSFER_USD_PER_GB",
        "VERCEL_SANDBOX_SNAPSHOT_USD_PER_GB_MONTH"
    ]) {
        Reflect.deleteProperty(process.env, key)
    }
})

describe("sandbox billing", () => {
    it("reserves full CPU and memory utilization for the requested TTL", () => {
        expect(estimatePersistentSandboxReservationMicrousd({ ttlMinutes: 30 })).toBe(85_201)
        expect(estimatePersistentSandboxReservationMicrousd({ ttlMinutes: 3 })).toBe(8_521)
    })

    it("settles CPU, memory, transfer, creation, and snapshot storage in microusd", () => {
        expect(
            calculateSandboxUsageMicrousd({
                activeCpuDurationMs: 30 * 60_000,
                provisionedMemoryGbMs: 2 * 30 * 60_000,
                ingressBytes: 100_000_000,
                egressBytes: 100_000_000,
                snapshotByteMs: 1_000_000_000 * 24 * 60 * 60_000,
                creations: 1,
                sessionCount: 1
            })
        ).toBe(117_867)
    })

    it("applies Vercel's one-minute provisioned-memory minimum per session", async () => {
        const usage = await collectSandboxBillableUsage(
            {
                listSessions: async () =>
                    (async function* () {
                        yield {
                            memory: 2048,
                            duration: 10_000,
                            activeCpuDurationMs: 2_000,
                            networkTransfer: { ingress: 10, egress: 20 }
                        }
                        yield {
                            memory: 2048,
                            duration: 90_000,
                            activeCpuDurationMs: 3_000,
                            networkTransfer: { ingress: 30, egress: 40 }
                        }
                    })(),
                listSnapshots: async () =>
                    (async function* () {
                        yield { sizeBytes: 100, createdAt: new Date(9_000) }
                    })()
            },
            10_000
        )

        expect(usage).toEqual({
            activeCpuDurationMs: 5_000,
            provisionedMemoryGbMs: 300_000,
            ingressBytes: 40,
            egressBytes: 60,
            snapshotByteMs: 100_000,
            creations: 1,
            sessionCount: 2
        })
    })
})
