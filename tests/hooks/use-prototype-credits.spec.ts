// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { useCreditAccessMock, useDiskCachedQueryMock, toastErrorMock } = vi.hoisted(() => ({
    useCreditAccessMock: vi.fn(),
    useDiskCachedQueryMock: vi.fn(),
    toastErrorMock: vi.fn()
}))

vi.mock("@/components/credits/credit-access-runtime", () => ({
    useCreditAccess: useCreditAccessMock
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

const proPlan = {
    enabled: true,
    plan: "pro" as const,
    isStaff: false,
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
        useCreditAccessMock.mockReset()
        useDiskCachedQueryMock.mockReset()
        toastErrorMock.mockReset()
        vi.spyOn(console, "error").mockImplementation(() => {})
        vi.stubGlobal("fetch", vi.fn())
    })

    it("hydrates from the cached summary while shared access is loading", () => {
        localStorage.setItem(
            "hosted-usage-summary:v2:user-1",
            JSON.stringify({
                value: cachedSummary,
                savedAt: Date.now()
            })
        )
        useCreditAccessMock.mockImplementation(
            (
                selector: (state: { summary: typeof proPlan | null; isLoading: boolean }) => unknown
            ) => selector({ summary: null, isLoading: true })
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

    it("combines shared plan access with the latest usage without an HTTP request", async () => {
        useCreditAccessMock.mockImplementation(
            (
                selector: (state: { summary: typeof proPlan | null; isLoading: boolean }) => unknown
            ) => selector({ summary: proPlan, isLoading: false })
        )
        useDiskCachedQueryMock.mockReturnValue(usageSummary)

        const { result } = renderHook(() =>
            usePrototypeCredits({
                userId: "user-1",
                isAuthLoading: false
            })
        )

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
        expect(global.fetch).not.toHaveBeenCalled()
    })
})
