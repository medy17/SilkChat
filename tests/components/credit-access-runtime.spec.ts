// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { useConvexAuthMock, useQueryMock, useSessionMock } = vi.hoisted(() => ({
    useConvexAuthMock: vi.fn(),
    useQueryMock: vi.fn(),
    useSessionMock: vi.fn()
}))

vi.mock("@/hooks/auth-hooks", () => ({
    useSession: useSessionMock
}))

vi.mock("@convex-dev/react-query", () => ({
    useConvexAuth: useConvexAuthMock
}))

vi.mock("convex-helpers/react/cache", () => ({
    useQuery: useQueryMock
}))

import { CreditAccessRuntime, useCreditAccess } from "@/components/credits/credit-access-runtime"

const planSummary = {
    enabled: true,
    plan: "pro" as const,
    isStaff: true,
    usageMetering: {
        fiveHourLimitUsd: 2,
        monthlyLimitUsd: 20
    }
}

function CreditConsumer({ label }: { label: string }) {
    const { plan, isStaff } = useCreditAccess()
    return React.createElement("span", null, `${label}:${plan}:${isStaff}`)
}

describe("CreditAccessRuntime", () => {
    beforeEach(() => {
        localStorage.clear()
        useQueryMock.mockReset()
        useSessionMock.mockReturnValue({ data: { user: { id: "user-1" } } })
        useConvexAuthMock.mockReturnValue({ isLoading: false })
        useCreditAccess.setState({
            summary: null,
            plan: null,
            isStaff: false,
            isLoading: false
        })
    })

    it("owns one query while sharing credit access with many consumers", async () => {
        useQueryMock.mockReturnValue(planSummary)

        render(
            React.createElement(
                React.Fragment,
                null,
                React.createElement(CreditAccessRuntime),
                React.createElement(CreditConsumer, { label: "first" }),
                React.createElement(CreditConsumer, { label: "second" }),
                React.createElement(CreditConsumer, { label: "third" })
            )
        )

        expect(await screen.findByText("first:pro:true")).toBeTruthy()
        expect(screen.getByText("second:pro:true")).toBeTruthy()
        expect(screen.getByText("third:pro:true")).toBeTruthy()
        expect(useQueryMock).toHaveBeenCalledTimes(1)

        await waitFor(() => {
            expect(
                JSON.parse(localStorage.getItem("hosted-usage-plan:v3:user-1") || "null").value
            ).toEqual(planSummary)
        })
    })

    it("does not remount sibling UI when credit access hydrates", async () => {
        let liveSummary: typeof planSummary | undefined
        let footerMountCount = 0
        useQueryMock.mockImplementation(() => liveSummary)

        function FooterProbe() {
            React.useEffect(() => {
                footerMountCount += 1
            }, [])
            return React.createElement("div", null, "message-footer")
        }

        const renderTree = () =>
            React.createElement(
                React.Fragment,
                null,
                React.createElement(CreditAccessRuntime),
                React.createElement(FooterProbe),
                React.createElement(CreditConsumer, { label: "access" })
            )

        const view = render(renderTree())
        expect(footerMountCount).toBe(1)

        liveSummary = planSummary
        view.rerender(renderTree())

        expect(await screen.findByText("access:pro:true")).toBeTruthy()
        expect(footerMountCount).toBe(1)
    })
})
