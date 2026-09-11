import { fn } from "storybook/test"
import type { ReactNode } from "react"
import type { FunctionReference } from "convex/server"
import { readFixture } from "./service-state"

// Storybook-only service boundary. No Convex client or WebSocket is created.
export function useQuery(query: FunctionReference<"query">, args?: unknown) {
    return args === "skip" ? undefined : readFixture(query)
}
const mutation = Object.assign(
    fn(async () => "storybook-result"),
    { withOptimisticUpdate: () => mutation }
)
const action = fn(async () => ({ success: true, sharedThreadId: "storybook-shared" }))
const client = {
    query: async (query: FunctionReference<"query">) => readFixture(query),
    mutation,
    action
}
const auth = { isAuthenticated: true, isLoading: false, isRefreshing: false }
const pagination = { results: [], status: "Exhausted", isLoading: false, loadMore: fn() }
export function useMutation() {
    return mutation
}
export function useAction() {
    return action
}
export function useConvex() {
    return client
}
export function useConvexAuth() {
    return auth
}
export function usePaginatedQuery() {
    return pagination
}
export const useQueries = fn(() => ({}))
export const optimisticallyUpdateValueInPaginatedQuery = fn()
export const usePreloadedQuery = fn()
export function ConvexProvider({ children }: { children: ReactNode }) {
    return children
}
export const ConvexProviderWithAuth = ConvexProvider
export class ConvexReactClient {
    constructor() {
        throw new Error("Storybook must use fixture queries, not a live Convex client.")
    }
}
