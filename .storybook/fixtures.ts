import type { Thread, SidebarProject } from "../src/components/threads/types"
import { MODELS_SHARED } from "../convex/lib/models"
import { DefaultSettings } from "../src/lib/default-user-settings"
import type { Doc } from "../convex/_generated/dataModel"
import type { PrototypeCreditSummary } from "../src/lib/prototype-credits"

export const demoThread: Thread = {
    _id: "storybook-thread" as Thread["_id"],
    title: "Planning a TypeScript project",
    authorId: "storybook-user",
    createdAt: 1789084800000,
    updatedAt: 1789084800000,
    pinned: false
}
export const demoProject: SidebarProject = {
    _id: "storybook-project" as SidebarProject["_id"],
    name: "Research",
    description: "Notes and reference material",
    color: "blue",
    threadCount: 3
}
export const demoModels = MODELS_SHARED
export const demoImage: Doc<"generatedImages"> = {
    _id: "storybook-image" as Doc<"generatedImages">["_id"],
    _creationTime: 1789084800000,
    userId: "storybook-user",
    storageKey: "storybook/sample.svg",
    prompt: "An abstract landscape in monochrome",
    createdAt: 1789084800000,
    aspectRatio: "3:2",
    resolution: "1K"
}
export const demoCredits: PrototypeCreditSummary = {
    enabled: true,
    plan: "pro",
    periodKey: "storybook",
    periodStartsAt: 1788220800000,
    periodEndsAt: 1790812800000,
    usageMetering: {
        fiveHour: { limitUsd: 10, usedUsd: 3, remainingUsd: 7, recoversAt: null },
        monthly: { limitUsd: 100, usedUsd: 24, remainingUsd: 76 }
    },
    requestCounts: { internal: 24, byok: 4, total: 28 }
}
export const demoUser = {
    id: "storybook-user",
    name: "Demo Contributor",
    email: "demo@example.test",
    emailVerified: true,
    image: null,
    createdAt: new Date(1789084800000),
    updatedAt: new Date(1789084800000)
}
export const queryFixtures: Record<string, unknown> = {
    "settings:getUserSettings": { ...DefaultSettings(demoUser.id), onboardingCompleted: true },
    "settings:getSharedModels": { version: "storybook", models: demoModels },
    "folders:getUserProjects": [demoProject],
    "threads:getUserThreads": [demoThread],
    "threads:getThread": demoThread,
    "threads:getUserThreadsByIds": [demoThread],
    "import_jobs:listImportJobs": [],
    "personas:listPersonaPickerOptions": { builtIns: [], userPersonas: [] },
    "analytics:getMyUsageStats": { totalRequests: 24, totalTokens: 18500, modelStats: [] },
    "analytics:getMyUsageChartData": []
}
