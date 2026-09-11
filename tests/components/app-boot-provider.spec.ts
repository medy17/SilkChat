// @vitest-environment jsdom
import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getFunctionName } from "convex/server"
import { createElement, type ReactNode } from "react"

const boundary = vi.hoisted(() => ({
    userId: "alice" as string | undefined,
    pending: false,
    authenticated: undefined as boolean | undefined,
    query: vi.fn()
}))
vi.mock("@/hooks/auth-hooks", () => ({
    useSession: () => ({
        data: boundary.userId ? { user: { id: boundary.userId } } : null,
        isPending: boundary.pending
    })
}))
vi.mock("@convex-dev/react-query", () => ({
    useConvexAuth: () => ({
        isLoading: boundary.pending,
        isAuthenticated: boundary.authenticated ?? !!boundary.userId
    })
}))
vi.mock("convex-helpers/react/cache", () => ({ useQuery: boundary.query }))

import {
    AppBootProvider,
    useAppConfiguration,
    useAccountStatus,
    useLiveUserSettings,
    useBillingSummary,
    usePersonaPickerOptions
} from "@/components/app-boot-provider"
import { useCurrentUserSettings } from "@/hooks/use-current-user-settings"
import { useUploadPolicy } from "@/hooks/use-upload-policy"
import { DefaultSettings } from "@/lib/default-user-settings"
import { DEFAULT_UPLOAD_POLICY } from "@/lib/file_constants"
import { useSharedModels } from "@/lib/shared-models"

const configuration = (userId: string) => ({
    userId,
    settings: { ...DefaultSettings(userId), invertSendNewlineBehavior: true },
    onboarding: { shouldShowOnboarding: true },
    toolAvailability: null,
    uploadPolicy: { ...DEFAULT_UPLOAD_POLICY, version: "server-version" }
})
const accountStatus = (userId: string) => ({
    userId,
    plan: {
        enabled: true,
        plan: "pro",
        isStaff: false,
        usageMetering: { fiveHourLimitUsd: 2, monthlyLimitUsd: 20 }
    },
    billing: { userId, plan: "pro", subscription: { status: "active" } }
})
const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(AppBootProvider, { children })
const useProbe = () => ({
    configuration: useAppConfiguration(),
    account: useAccountStatus(),
    settings: useCurrentUserSettings(boundary.userId, boundary.pending),
    freshSettings: useLiveUserSettings(),
    billing: useBillingSummary(),
    upload: useUploadPolicy()
})

describe("shared app boot data", () => {
    beforeEach(() => {
        localStorage.clear()
        boundary.userId = "alice"
        boundary.pending = false
        boundary.authenticated = undefined
        boundary.query.mockReset().mockReturnValue(undefined)
    })

    it("renders cached data immediately but waits for fresh settings and billing before side effects", () => {
        localStorage.setItem(
            "CVX_DISK_CACHE:app-configuration:v1:alice",
            JSON.stringify(configuration("alice"))
        )
        localStorage.setItem(
            "CVX_DISK_CACHE:account-status:v1:alice",
            JSON.stringify(accountStatus("alice"))
        )
        const { result, rerender } = renderHook(useProbe, { wrapper })
        expect(result.current.settings.invertSendNewlineBehavior).toBe(true)
        expect(result.current.account.value?.plan.plan).toBe("pro")
        expect(result.current.freshSettings).toBeUndefined()
        expect(result.current.billing).toBeUndefined()
        expect(result.current.configuration.live).toBeUndefined()

        boundary.query.mockImplementation((query) =>
            getFunctionName(query) === "settings:getAppConfiguration"
                ? { ...configuration("alice"), onboarding: { shouldShowOnboarding: false } }
                : accountStatus("alice")
        )
        rerender()
        expect(result.current.configuration.live?.onboarding?.shouldShowOnboarding).toBe(false)
        expect(result.current.freshSettings?.userId).toBe("alice")
        expect(result.current.billing?.subscription?.status).toBe("active")
    })

    it("waits for Convex to confirm a loaded session before subscribing", () => {
        boundary.authenticated = false
        const { result, rerender } = renderHook(useProbe, { wrapper })
        expect(boundary.query.mock.calls.every(([, args]) => args === "skip")).toBe(true)
        expect(result.current.configuration.live).toBeUndefined()
        boundary.query.mockClear()
        boundary.authenticated = true
        rerender()
        expect(boundary.query.mock.calls.map(([, args]) => args)).toEqual([{}, {}])
    })

    it("waits for the socket to sign out before subscribing as a guest", () => {
        boundary.userId = undefined
        boundary.authenticated = true
        const { rerender } = renderHook(useProbe, { wrapper })
        expect(boundary.query.mock.calls.every(([, args]) => args === "skip")).toBe(true)
        boundary.query.mockClear()
        boundary.authenticated = false
        rerender()
        expect(boundary.query.mock.calls.map(([, args]) => args)).toEqual([{}, "skip"])
    })

    it("keeps the existing model catalog visible until the expanded boot response arrives", () => {
        localStorage.setItem(
            "CVX_DISK_CACHE:shared-models:alice",
            JSON.stringify({
                version: "cached",
                models: [{ id: "cached-model" }]
            })
        )
        boundary.query.mockReturnValue(configuration("alice")) // Earlier boot response shape.
        const { result, rerender } = renderHook(useSharedModels, { wrapper })
        expect(result.current.models[0].id).toBe("cached-model")
        boundary.query.mockReturnValue({
            ...configuration("alice"),
            sharedModels: {
                version: "fresh",
                models: [{ id: "fresh-model" }]
            }
        })
        rerender()
        expect(result.current.models[0].id).toBe("fresh-model")
        boundary.userId = "bob"
        rerender()
        expect(result.current.models).toEqual([])
    })

    it("pauses persona updates while the picker opens without retaining another account's options", () => {
        const config = (userId: string, name: string) => ({
            ...configuration(userId),
            personas: {
                builtIns: [],
                userPersonas: [{ id: "persona", name }]
            }
        })
        boundary.query.mockReturnValue(config("alice", "Before"))
        const { result, rerender } = renderHook(
            ({ accept }: { accept: boolean }) => usePersonaPickerOptions(accept),
            {
                wrapper,
                initialProps: { accept: true }
            }
        )
        rerender({ accept: false })
        boundary.query.mockReturnValue(config("alice", "After"))
        rerender({ accept: false })
        expect(result.current.userPersonas[0].name).toBe("Before")
        rerender({ accept: true })
        expect(result.current.userPersonas[0].name).toBe("After")
        boundary.userId = "bob"
        boundary.query.mockReturnValue(config("bob", "Bob"))
        rerender({ accept: false })
        expect(result.current.userPersonas[0].name).toBe("Bob")
    })

    it("rejects previous-account responses during switching and never writes them into the next account cache", () => {
        boundary.query.mockImplementation((query) =>
            getFunctionName(query) === "settings:getAppConfiguration"
                ? configuration("alice")
                : accountStatus("alice")
        )
        const { result, rerender } = renderHook(useProbe, { wrapper })
        expect(result.current.settings.userId).toBe("alice")
        boundary.userId = "bob"
        rerender()
        expect(result.current.settings).toMatchObject({
            userId: "bob",
            invertSendNewlineBehavior: false
        })
        expect(result.current.account.value).toBeNull()
        expect(result.current.billing).toBeUndefined()
        expect(localStorage.getItem("CVX_DISK_CACHE:app-configuration:v1:bob")).toBeNull()
        expect(localStorage.getItem("CVX_DISK_CACHE:account-status:v1:bob")).toBeNull()
        boundary.userId = undefined
        rerender()
        expect(result.current.settings.userId).toBe("CACHE")
        expect(result.current.account.value).toBeNull()
    })

    it("treats a fresh missing account as authoritative instead of resurrecting the cached plan", () => {
        localStorage.setItem(
            "CVX_DISK_CACHE:account-status:v1:alice",
            JSON.stringify(accountStatus("alice"))
        )
        boundary.query.mockImplementation((query) =>
            getFunctionName(query) === "settings:getAppConfiguration"
                ? configuration("alice")
                : null
        )
        const { result } = renderHook(useProbe, { wrapper })
        expect(result.current.account).toEqual({ value: null, live: null })
    })

    it("settles guest account state without starting an account subscription", () => {
        boundary.userId = undefined
        const { result } = renderHook(useProbe, { wrapper })
        expect(result.current.account).toEqual({ value: null, live: null })
        const accountCall = boundary.query.mock.calls.find(
            ([query]) => getFunctionName(query) === "credits:getMyAccountStatus"
        )
        expect(accountCall?.[1]).toBe("skip")
    })

    it("shares only the two boot queries across consumers and invalidates the combined upload cache", () => {
        const config = configuration("alice")
        const account = accountStatus("alice")
        boundary.query.mockImplementation((query) =>
            getFunctionName(query) === "settings:getAppConfiguration" ? config : account
        )
        const { result } = renderHook(() => [useProbe(), useProbe()], { wrapper })
        // Multiple selectors do not mount additional query hooks.
        expect(boundary.query.mock.calls.map(([query]) => getFunctionName(query))).toEqual([
            "settings:getAppConfiguration",
            "credits:getMyAccountStatus"
        ])
        result.current[0].upload.invalidateUploadPolicy("server-version")
        expect(localStorage.getItem("CVX_DISK_CACHE:app-configuration:v1:alice")).not.toBeNull()
        result.current[0].upload.invalidateUploadPolicy("new-version")
        expect(localStorage.getItem("CVX_DISK_CACHE:app-configuration:v1:alice")).toBeNull()
    })
})
