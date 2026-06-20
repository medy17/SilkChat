import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { UserAccess } from "./schema/access"
import { LemonSqueezySubscription, LemonSqueezyWebhookEvent } from "./schema/billing"
import { PrototypeCreditReservation } from "./schema/credit_reservations"
import {
    PrototypeCreditAccount,
    PrototypeCreditEvent,
    PrototypeToolCallReservation
} from "./schema/credits"
import { Project } from "./schema/folders"
import { GeneratedImage } from "./schema/generated_image"
import { GeneratedImageFacets } from "./schema/generated_image_facets"
import { ImageGenerationJob } from "./schema/image_generation_job"
import { ImportJob, ImportJobSource, ImportJobThread } from "./schema/import_job"
import { Message } from "./schema/message"
import { ThreadPersonaSnapshot, UserPersona } from "./schema/persona"
import { UserSettings } from "./schema/settings"
import { ResumableStream } from "./schema/streams"
import { SharedThread, Thread } from "./schema/thread"
import { UsageEvent } from "./schema/usage"

export {
    Thread,
    Message,
    SharedThread,
    UsageEvent,
    PrototypeCreditAccount,
    PrototypeCreditReservation,
    PrototypeCreditEvent,
    PrototypeToolCallReservation,
    UserSettings,
    Project,
    UserPersona,
    ThreadPersonaSnapshot,
    ImportJob,
    ImportJobSource,
    ImportJobThread,
    GeneratedImage,
    GeneratedImageFacets,
    ImageGenerationJob,
    UserAccess,
    LemonSqueezySubscription,
    LemonSqueezyWebhookEvent
}

export default defineSchema({
    session: defineTable({
        expiresAt: v.number(),
        token: v.string(),
        createdAt: v.number(),
        updatedAt: v.number(),
        ipAddress: v.optional(v.union(v.null(), v.string())),
        userAgent: v.optional(v.union(v.null(), v.string())),
        userId: v.string()
    })
        .index("expiresAt", ["expiresAt"])
        .index("expiresAt_userId", ["expiresAt", "userId"])
        .index("token", ["token"])
        .index("userId", ["userId"])
        .index("byUserIdAndExpiresAt", ["userId", "expiresAt"]),
    account: defineTable({
        accountId: v.string(),
        providerId: v.string(),
        userId: v.string(),
        accessToken: v.optional(v.union(v.null(), v.string())),
        refreshToken: v.optional(v.union(v.null(), v.string())),
        idToken: v.optional(v.union(v.null(), v.string())),
        accessTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
        refreshTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
        scope: v.optional(v.union(v.null(), v.string())),
        password: v.optional(v.union(v.null(), v.string())),
        createdAt: v.number(),
        updatedAt: v.number()
    })
        .index("accountId", ["accountId"])
        .index("accountId_providerId", ["accountId", "providerId"])
        .index("providerId_userId", ["providerId", "userId"])
        .index("userId", ["userId"]),
    verification: defineTable({
        identifier: v.string(),
        value: v.string(),
        expiresAt: v.number(),
        createdAt: v.number(),
        updatedAt: v.number()
    })
        .index("expiresAt", ["expiresAt"])
        .index("identifier", ["identifier"]),
    twoFactor: defineTable({
        secret: v.string(),
        backupCodes: v.string(),
        userId: v.string(),
        verified: v.optional(v.union(v.null(), v.boolean()))
    }).index("userId", ["userId"]),
    oauthApplication: defineTable({
        name: v.optional(v.union(v.null(), v.string())),
        icon: v.optional(v.union(v.null(), v.string())),
        metadata: v.optional(v.union(v.null(), v.string())),
        clientId: v.optional(v.union(v.null(), v.string())),
        clientSecret: v.optional(v.union(v.null(), v.string())),
        redirectUrls: v.optional(v.union(v.null(), v.string())),
        type: v.optional(v.union(v.null(), v.string())),
        disabled: v.optional(v.union(v.null(), v.boolean())),
        userId: v.optional(v.union(v.null(), v.string())),
        createdAt: v.optional(v.union(v.null(), v.number())),
        updatedAt: v.optional(v.union(v.null(), v.number()))
    })
        .index("clientId", ["clientId"])
        .index("userId", ["userId"]),
    oauthAccessToken: defineTable({
        accessToken: v.optional(v.union(v.null(), v.string())),
        refreshToken: v.optional(v.union(v.null(), v.string())),
        accessTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
        refreshTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
        clientId: v.optional(v.union(v.null(), v.string())),
        userId: v.optional(v.union(v.null(), v.string())),
        scopes: v.optional(v.union(v.null(), v.string())),
        createdAt: v.optional(v.union(v.null(), v.number())),
        updatedAt: v.optional(v.union(v.null(), v.number()))
    })
        .index("accessToken", ["accessToken"])
        .index("refreshToken", ["refreshToken"])
        .index("clientId", ["clientId"])
        .index("userId", ["userId"]),
    oauthConsent: defineTable({
        clientId: v.optional(v.union(v.null(), v.string())),
        userId: v.optional(v.union(v.null(), v.string())),
        scopes: v.optional(v.union(v.null(), v.string())),
        createdAt: v.optional(v.union(v.null(), v.number())),
        updatedAt: v.optional(v.union(v.null(), v.number())),
        consentGiven: v.optional(v.union(v.null(), v.boolean()))
    })
        .index("clientId_userId", ["clientId", "userId"])
        .index("userId", ["userId"]),
    jwks: defineTable({
        publicKey: v.string(),
        privateKey: v.string(),
        createdAt: v.number(),
        expiresAt: v.optional(v.union(v.null(), v.number()))
    }),
    rateLimit: defineTable({
        key: v.string(),
        count: v.number(),
        lastRequest: v.number()
    }).index("key", ["key"]),
    threads: defineTable(Thread)
        .index("byAuthor", ["authorId"])
        .index("byAuthorUpdatedAt", ["authorId", "updatedAt"])
        .index("byProject", ["projectId"])
        .index("byAuthorAndProject", ["authorId", "projectId"])
        .index("byAuthorAndProjectUpdatedAt", ["authorId", "projectId", "updatedAt"])
        .searchIndex("search_title", {
            searchField: "title",
            filterFields: ["authorId"]
        }),

    messages: defineTable(Message)
        .index("byThreadId", ["threadId"])
        .index("byMessageId", ["messageId"]),
    userPersonas: defineTable(UserPersona)
        .index("byAuthor", ["authorId"])
        .index("byAuthorUpdatedAt", ["authorId", "updatedAt"]),
    threadPersonaSnapshots: defineTable(ThreadPersonaSnapshot).index("byThreadId", ["threadId"]),

    sharedThreads: defineTable(SharedThread).index("byAuthorId", ["authorId"]),
    streams: defineTable(ResumableStream).index("byThreadId", ["threadId"]),
    // apiKeys: defineTable(ApiKey)
    //     .index("byUser", ["userId"])
    //     .index("byUserProvider", ["userId", "provider"]),
    settings: defineTable(UserSettings).index("byUser", ["userId"]),
    userAccess: defineTable(UserAccess).index("byUser", ["userId"]),

    usageEvents: defineTable(UsageEvent).index("byUserDay", ["userId", "daysSinceEpoch"]),
    prototypeCreditAccounts: defineTable(PrototypeCreditAccount).index("byUser", ["userId"]),
    prototypeCreditReservations: defineTable(PrototypeCreditReservation)
        .index("byUserPeriod", ["userId", "periodKey"])
        .index("byUserMessageKey", ["userId", "messageKey"]),
    prototypeCreditEvents: defineTable(PrototypeCreditEvent)
        .index("byUserPeriod", ["userId", "periodKey"])
        .index("byUserMessageKey", ["userId", "messageKey"]),
    prototypeToolCallReservations: defineTable(PrototypeToolCallReservation)
        .index("byUserPeriod", ["userId", "periodKey"])
        .index("byUserMessageKey", ["userId", "messageKey"]),
    lemonSqueezySubscriptions: defineTable(LemonSqueezySubscription)
        .index("byUser", ["userId"])
        .index("bySubscriptionId", ["lemonSqueezySubscriptionId"]),
    lemonSqueezyWebhookEvents: defineTable(LemonSqueezyWebhookEvent).index("byEventId", [
        "eventId"
    ]),

    projects: defineTable(Project)
        .index("byAuthor", ["authorId"])
        .searchIndex("search_name", {
            searchField: "name",
            filterFields: ["authorId"]
        }),

    importJobs: defineTable(ImportJob)
        .index("byAuthorUpdatedAt", ["authorId", "updatedAt"])
        .index("byAuthorStatusUpdatedAt", ["authorId", "status", "updatedAt"])
        .index("byStatusUpdatedAt", ["status", "updatedAt"]),

    importJobSources: defineTable(ImportJobSource)
        .index("byJobId", ["jobId"])
        .index("byJobIdAndClientSourceId", ["jobId", "clientSourceId"]),

    importJobThreads: defineTable(ImportJobThread)
        .index("byJobId", ["jobId"])
        .index("byJobIdAndStatus", ["jobId", "status"])
        .index("byJobIdAndDocumentKey", ["jobId", "documentKey"])
        .index("byStatusUpdatedAt", ["status", "updatedAt"]),

    generatedImages: defineTable(GeneratedImage)
        .index("byUserId", ["userId"])
        .index("byUserIdAndCreatedAt", ["userId", "createdAt"])
        .searchIndex("search_text", {
            searchField: "searchText",
            filterFields: ["userId"]
        }),

    generatedImageFacets: defineTable(GeneratedImageFacets).index("byUserId", ["userId"]),

    imageGenerationJobs: defineTable(ImageGenerationJob)
        .index("byUserIdAndCreatedAt", ["userId", "createdAt"])
        .index("byFalRequestId", ["falRequestId"])
})
