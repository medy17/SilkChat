import { convexTest } from "convex-test"
import { describe, expect, it, vi } from "vitest"
import schema from "../../convex/schema"
import { api } from "../../convex/_generated/api"
import { DefaultSettings } from "../../src/lib/default-user-settings"

const modules = import.meta.glob("../../convex/**/*.ts")

describe("app boot queries", () => {
    it("preserves the existing public configuration contracts and reflects settings changes", async () => {
        const t = convexTest(schema, modules)
        const user = t.withIdentity({ subject: "alice" })
        await t.run((ctx) =>
            ctx.db.insert("settings", {
                ...DefaultSettings("alice"),
                telemetryEnabled: false,
                generalProviders: {
                    supermemory: { enabled: true, encryptedKey: "obsolete-secret" }
                }
            })
        )
        const config = await user.query(api.settings.getAppConfiguration, {})
        expect(config.settings).toEqual(await user.query(api.settings.getUserSettings, {}))
        expect(config.settings?.generalProviders.supermemory).toBeUndefined()
        expect(config.toolAvailability).toEqual(
            await user.query(api.settings.getToolAvailability, {})
        )
        expect(config.uploadPolicy).toEqual(await user.query(api.attachments.getUploadPolicy, {}))
        expect(config.onboarding).toEqual(await user.query(api.settings.getOnboardingStatus, {}))
        expect(config.settings?.telemetryEnabled).toBe(false)
        expect(config.sharedModels).toEqual(await user.query(api.settings.getSharedModels, {}))
        expect(config.personas).toEqual(await user.query(api.personas.listPersonaPickerOptions, {}))

        await user.mutation(api.settings.completeOnboarding, {})
        expect((await user.query(api.settings.getAppConfiguration, {})).onboarding).toEqual({
            shouldShowOnboarding: false
        })
        expect(
            (await t.withIdentity({ subject: "bob" }).query(api.settings.getAppConfiguration, {}))
                .settings?.userId
        ).toBe("bob")
    })

    it("computes dev model limits from the boot catalog without a selected-model query", async () => {
        vi.stubEnv("DEV_CREDIT_LAB_ENABLED", "1")
        try {
            const t = convexTest(schema, modules).withIdentity({ subject: "alice" })
            const config = await t.query(api.settings.getAppConfiguration, {})
            const model = config.sharedModels.models[0]
            expect(config.devModelLimits?.[model.id]).toEqual(
                await t.query(api.settings.getDevModelContextLimits, { modelId: model.id })
            )
        } finally {
            vi.unstubAllEnvs()
        }
    })

    it("keeps guest upload policy available without exposing account or settings data", async () => {
        const t = convexTest(schema, modules)
        for (const client of [t, t.withIdentity({ subject: "guest", isAnonymous: true })]) {
            expect(await client.query(api.settings.getAppConfiguration, {})).toMatchObject({
                userId: null,
                settings: null,
                onboarding: null,
                toolAvailability: null,
                uploadPolicy: await t.query(api.attachments.getUploadPolicy, {})
            })
            expect(await client.query(api.credits.getMyAccountStatus, {})).toBeNull()
        }
    })

    it("keeps plan and billing consistent across subscription changes and account isolation", async () => {
        const t = convexTest(schema, modules)
        const user = t.withIdentity({ subject: "alice" })
        const ids = await t.run(async (ctx) => ({
            account: await ctx.db.insert("prototypeCreditAccounts", {
                userId: "alice",
                enabled: true,
                plan: "pro",
                updatedAt: 1
            }),
            subscription: await ctx.db.insert("lemonSqueezySubscriptions", {
                userId: "alice",
                lemonSqueezySubscriptionId: "subscription",
                status: "active",
                plan: "pro",
                updatedAt: 1,
                lastEventId: "event"
            })
        }))
        const status = await user.query(api.credits.getMyAccountStatus, {})
        expect(status?.plan).toEqual(await user.query(api.credits.getMyCreditPlanSummary, {}))
        expect(status?.billing).toEqual(await user.query(api.billing.getMyBillingSummary, {}))
        expect(status?.activeSandbox).toEqual(
            await user.query(api.persistent_sandboxes.getMyActivePersistentSandbox, {})
        )
        expect(status?.importJobs).toEqual(
            await user.query(api.import_jobs.listImportJobs, { limit: 6 })
        )
        await t.run(async (ctx) => {
            await ctx.db.patch(ids.account, { plan: "free" })
            await ctx.db.patch(ids.subscription, { status: "expired" })
        })
        expect(await user.query(api.credits.getMyAccountStatus, {})).toMatchObject({
            plan: { plan: "free" },
            billing: { plan: "free", subscription: { status: "expired" } }
        })
        expect(
            await t.withIdentity({ subject: "bob" }).query(api.credits.getMyAccountStatus, {})
        ).toMatchObject({
            userId: "bob",
            plan: { plan: "free" },
            billing: { userId: "bob", subscription: null }
        })
    })

    it("reflects import progress and sandbox completion without exposing sandbox credentials", async () => {
        const t = convexTest(schema, modules)
        const user = t.withIdentity({ subject: "alice" })
        const ids = await t.run(async (ctx) => {
            const threadId = await ctx.db.insert("threads", {
                authorId: "alice",
                title: "Chat",
                createdAt: 1,
                updatedAt: 1
            })
            const sandbox = await ctx.db.insert("persistentSandboxes", {
                userId: "alice",
                sourceThreadId: threadId,
                sourceMessageId: "message",
                sourceToolCallId: "tool",
                sourceCardId: "card",
                purpose: "Code",
                ttlMinutes: 5,
                runtime: "python",
                status: "active",
                sessionState: "running",
                sandboxName: "private-provider-handle",
                createdAt: 1,
                updatedAt: 1
            })
            const job = await ctx.db.insert("importJobs", {
                authorId: "alice",
                status: "importing",
                attachmentMode: "skip",
                createdAt: 1,
                updatedAt: 1,
                totalSourceFiles: 1,
                preparedSourceFiles: 1,
                totalThreads: 1,
                processedThreads: 0,
                importedThreads: 0,
                failedThreads: 0,
                warningCount: 0,
                errorCount: 0,
                recentWarnings: [],
                recentErrors: []
            })
            return { sandbox, job }
        })
        const before = await user.query(api.credits.getMyAccountStatus, {})
        expect(before?.activeSandbox).toMatchObject({ status: "active", sessionState: "running" })
        expect(before?.activeSandbox).not.toHaveProperty("sandboxName")
        expect(before?.importJobs[0].processedThreads).toBe(0)
        await t.run(async (ctx) => {
            await ctx.db.patch(ids.sandbox, { status: "stopped", sessionState: "stopped" })
            await ctx.db.patch(ids.job, {
                status: "completed",
                processedThreads: 1,
                importedThreads: 1
            })
        })
        const after = await user.query(api.credits.getMyAccountStatus, {})
        expect(after?.activeSandbox).toBeNull()
        expect(after?.importJobs[0]).toMatchObject({ status: "completed", processedThreads: 1 })
        const other = await t
            .withIdentity({ subject: "bob" })
            .query(api.credits.getMyAccountStatus, {})
        expect(other?.activeSandbox).toBeNull()
        expect(other?.importJobs).toEqual([])
    })
})
