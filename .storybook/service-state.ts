import { getFunctionName, type FunctionReference } from "convex/server"
import { queryFixtures } from "./fixtures"

let currentFixtures: Record<string, unknown> = queryFixtures
export function resetWorkshopFixtures(overrides: Record<string, unknown> = {}) {
    currentFixtures = { ...queryFixtures, ...overrides }
}
export function readFixture(query: FunctionReference<"query">) {
    return currentFixtures[getFunctionName(query)]
}
export function readWorkshopOption(name: string) {
    return currentFixtures[name]
}
