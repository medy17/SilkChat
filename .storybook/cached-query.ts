import { fn } from "storybook/test"
import type { FunctionReference } from "convex/server"
import { readFixture } from "./service-state"

export function useDiskCachedQuery(
    query: FunctionReference<"query">,
    options: { default: unknown }
) {
    return readFixture(query) ?? options.default
}
const pagination = { results: [], status: "Exhausted", loadMore: fn() }
export function useDiskCachedPaginatedQuery() {
    return pagination
}
export const clearDiskCache = fn()
