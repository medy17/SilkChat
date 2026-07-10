// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react"
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
    basic: {
        limit: 100
    },
    pro: {
        limit: 20
    }
}

const proPlan = {
    enabled: true,
    plan: "pro" as const,
    basic: {
        limit: 200
    },
    pro: {
        limit: 80
    }
}

const usageSummary = {
    periodKey: "2026-05",
    periodStartsAt: 1,
    periodEndsAt: 2,
    basic: {
        used: 12
    },
    pro: {
        used: 3
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
    basic: {
        limit: 100,
        used: 8,
        remaining: 92
    },
    pro: {
        limit: 20,
        used: 2,
        remaining: 18
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
                basic: {
                    limit: 200,
                    used: 12,
                    remaining: 188
                },
                pro: {
                    limit: 80,
                    used: 3,
                    remaining: 77
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

    it("posts dev plan changes and refreshes the visible summary", async () => {
        localStorage.setItem(
            "hosted-usage-plan:v2:user-1",
            JSON.stringify({
                value: freshPlan,
                savedAt: Date.now()
            })
        )
        useDiskCachedQueryMock.mockReturnValue(usageSummary)
        vi.mocked(global.fetch)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({})
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => proPlan
            } as Response)

        const { result } = renderHook(() =>
            usePrototypeCredits({
                userId: "user-1",
                isAuthLoading: false
            })
        )

        await act(async () => {
            await result.current.setCreditPlan("pro")
        })

        expect(global.fetch).toHaveBeenNthCalledWith(
            1,
            "/api/dev/credit-plan",
            expect.objectContaining({
                method: "POST"
            })
        )

        await waitFor(() => {
            expect(result.current.summary?.plan).toBe("pro")
        })
    })
})
