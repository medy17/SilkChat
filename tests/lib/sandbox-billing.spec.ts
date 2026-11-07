import { afterEach, describe, expect, it } from "vitest"
import {
    calculateSandboxUsageMicrousd,
    collectSandboxBillableUsage,
    accrueComputerStorageMicrousd,
    estimateComputerSessionReservationMicrousd,
    estimateComputerStorageMonthlyMicrousd,
    getComputerStorageLimits
} from "../../convex/lib/sandbox_billing"
import { getConfiguredHostedUsageLimits, usdToMicrousd } from "../../convex/lib/usage_metering"

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
    it("fits a session reservation inside the default free 5-hour limit", () => {
        const reservation = estimateComputerSessionReservationMicrousd({ sessionMinutes: 30 })
        expect(reservation).toBe(37_201)
        expect(reservation).toBeLessThan(
            getConfiguredHostedUsageLimits("free").fiveHourMicrousd / 2
        )
    })

    it.each([
        { allowanceUsd: 0.5, driveGb: 5, snapshotGb: 2 },
        { allowanceUsd: 1, driveGb: 10, snapshotGb: 3.125 },
        { allowanceUsd: 18, driveGb: 20, snapshotGb: 10 }
    ])(
        "scales storage limits to a $allowanceUsd allowance",
        ({ allowanceUsd, driveGb, snapshotGb }) => {
            const limits = getComputerStorageLimits(usdToMicrousd(allowanceUsd))
            expect(limits.driveLimitBytes / 1e9).toBeCloseTo(driveGb, 3)
            expect(limits.snapshotMaxBytes / 1e9).toBeCloseTo(snapshotGb, 3)
        }
    )

    it("keeps a Drive at Vercel's minimum size and a valid multiple", () => {
        const { driveLimitBytes } = getComputerStorageLimits(0)
        expect(driveLimitBytes).toBe(1024 ** 3)
        expect(getComputerStorageLimits(usdToMicrousd(0.5)).driveLimitBytes % 4096).toBe(0)
    })

    it("keeps a full computer inside the default free allowance", () => {
        const allowance = usdToMicrousd(0.5)
        const { driveLimitBytes, snapshotMaxBytes } = getComputerStorageLimits(allowance)
        expect(
            estimateComputerStorageMonthlyMicrousd({
                driveBytes: driveLimitBytes,
                snapshotBytes: snapshotMaxBytes
            })
        ).toBeLessThan(allowance)
    })

    it("prices Drive and snapshot storage at their own rates, pro rata", () => {
        const monthly = estimateComputerStorageMonthlyMicrousd({
            driveBytes: 2_000_000_000,
            snapshotBytes: 1_000_000_000
        })
        expect(monthly).toBe(180_000)
        expect(accrueComputerStorageMicrousd(monthly, 24 * 60 * 60_000)).toBe(6_000)
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
