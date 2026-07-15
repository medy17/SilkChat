// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { useDiskCachedQueryMock, toastErrorMock } = vi.hoisted(() => ({
    useDiskCachedQueryMock: vi.fn(),
    toastErrorMock: vi.fn()
}))

vi.mock("@/lib/convex-cached-query", () => ({
    useDiskCachedQuery: useDiskCachedQueryMock
}))

vi.mock("sonner", () => ({
    toast: {
        error: toastErrorMock
    }
}))

import { usePrototypeCredits } from "@/hooks/use-prototype-credits"

const freshPlan = {
    enabled: true,
    plan: "free" as const,
    usageMetering: {
        fiveHourLimitUsd: 1,
        monthlyLimitUsd: 10
    }
}

const proPlan = {
    enabled: true,
    plan: "pro" as const,
    usageMetering: {
        fiveHourLimitUsd: 2,
        monthlyLimitUsd: 20
    }
}

const usageSummary = {
    periodKey: "2026-05",
    periodStartsAt: 1,
    periodEndsAt: 2,
    usageMetering: {
        fiveHour: {
            usedUsd: 0.75,
            remainingUsd: 1.25,
            recoversAt: 3
        },
        monthly: {
            usedUsd: 4,
            remainingUsd: 16
        }
    },
    requestCounts: {
        internal: 10,
        byok: 5,
        total: 15
    }
}

const cachedSummary = {
    enabled: true,
    plan: "free" as const,
    periodKey: "2026-05",
    periodStartsAt: 1,
    periodEndsAt: 2,
    usageMetering: {
        fiveHour: {
            limitUsd: 1,
            usedUsd: 0.25,
            remainingUsd: 0.75,
            recoversAt: 3
        },
        monthly: {
            limitUsd: 10,
            usedUsd: 2,
            remainingUsd: 8
        }
    },
    requestCounts: {
        internal: 7,
        byok: 1,
        total: 8
    }
}

describe("usePrototypeCredits", () => {
    beforeEach(() => {
        localStorage.clear()
        useDiskCachedQueryMock.mockReset()
        toastErrorMock.mockReset()
        vi.spyOn(console, "error").mockImplementation(() => {})
        vi.stubGlobal("fetch", vi.fn())
    })

    it("hydrates from the cached summary immediately while keeping fresh plan data off the network", () => {
        localStorage.setItem(
            "hosted-usage-summary:v2:user-1",
            JSON.stringify({
                value: cachedSummary,
                savedAt: Date.now()
            })
        )
        localStorage.setItem(
            "hosted-usage-plan:v2:user-1",
            JSON.stringify({
                value: freshPlan,
                savedAt: Date.now()
            })
        )
        useDiskCachedQueryMock.mockReturnValue(null)

        const { result } = renderHook(() =>
            usePrototypeCredits({
                userId: "user-1",
                isAuthLoading: false
            })
        )

        expect(result.current.summary).toEqual(cachedSummary)
        expect(global.fetch).not.toHaveBeenCalled()
    })

    it("revalidates stale plan data and recomputes the merged summary with the latest usage", async () => {
        localStorage.setItem(
            "hosted-usage-plan:v2:user-1",
            JSON.stringify({
                value: freshPlan,
                savedAt: Date.now() - 10 * 60 * 1000
            })
        )
        useDiskCachedQueryMock.mockReturnValue(usageSummary)
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => proPlan
        } as Response)

        const { result } = renderHook(() =>
            usePrototypeCredits({
                userId: "user-1",
                isAuthLoading: false
            })
        )

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith("/api/credit-summary", {
                cache: "no-store"
            })
        })

        await waitFor(() => {
            expect(result.current.summary).toEqual({
                enabled: true,
                plan: "pro",
                periodKey: "2026-05",
                periodStartsAt: 1,
                periodEndsAt: 2,
                usageMetering: {
                    fiveHour: {
                        limitUsd: 2,
                        usedUsd: 0.75,
                        remainingUsd: 1.25,
                        recoversAt: 3
                    },
                    monthly: {
                        limitUsd: 20,
                        usedUsd: 4,
                        remainingUsd: 16
                    }
                },
                requestCounts: {
                    internal: 10,
                    byok: 5,
                    total: 15
                }
            })
        })

        expect(
            JSON.parse(localStorage.getItem("hosted-usage-summary:v2:user-1") || "null").value
        ).toEqual(result.current.summary)
    })
})
