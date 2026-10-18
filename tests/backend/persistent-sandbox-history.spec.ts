import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import schema from "../../convex/schema"
import { api, internal } from "../../convex/_generated/api"

const modules = import.meta.glob("../../convex/**/*.ts")

// A chat where the first answer requested the workspace and a later turn used it.
const setup = async (status: "active" | "provisioning" = "active") => {
    const t = convexTest(schema, modules)
    const ids = await t.run(async (ctx) => {
        const threadId = await ctx.db.insert("threads", {
            authorId: "user",
            title: "Chat",
            createdAt: 1,
            updatedAt: 1
        })
        const turns = [
            ["ask", "user"],
            ["request", "assistant"],
            ["follow-up", "user"],
            ["answer", "assistant"]
        ] as const
        for (const [index, [messageId, role]] of turns.entries()) {
            await ctx.db.insert("messages", {
                threadId,
                messageId,
                role,
                parts: [],
                metadata: {},
                createdAt: index + 1,
                updatedAt: index + 1
            })
        }
        const sandboxId = await ctx.db.insert("persistentSandboxes", {
            userId: "user",
            sourceThreadId: threadId,
            sourceMessageId: "request",
            sourceToolCallId: "tool-1",
            sourceCardId: "card-1",
            purpose: "Analyze a dataset",
            ttlMinutes: 30,
            runtime: "python",
            status,
            createdAt: 5,
            updatedAt: 5
        })
        return { threadId, sandboxId }
    })
    const sandbox = () => t.run((ctx) => ctx.db.get(ids.sandboxId))
    const scheduled = () => t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())
    return { t, ...ids, sandbox, scheduled }
}

describe("persistent sandbox history", () => {
    // Scheduled cleanup would call the sandbox provider; keep it queued so the test sees it.
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("stops the workspace when an edit or retry removes the message that requested it", async () => {
        const edit = await setup()
        await edit.t.mutation(internal.threads.createThreadOrInsertMessages, {
            authorId: "user",
            threadId: edit.threadId,
            targetFromMessageId: "ask",
            targetMode: "edit",
            proposedNewAssistantId: "request-2",
            userMessage: { role: "user", parts: [{ type: "text", text: "Different" }] }
        })
        expect(await edit.sandbox()).toMatchObject({
            status: "stopping",
            terminationReason: "user"
        })
        expect((await edit.scheduled()).map((job) => job.name)).toContain(
            "persistent_sandboxes_node:expirePersistentSandbox"
        )

        const retry = await setup()
        await retry.t.withIdentity({ subject: "user" }).mutation(api.threads.prepareThreadRetry, {
            threadId: retry.threadId,
            targetFromMessageId: "ask"
        })
        expect(await retry.sandbox()).toMatchObject({ status: "stopping" })
    })

    it("keeps the workspace when the edit comes after its request", async () => {
        const { t, threadId, sandbox, scheduled } = await setup()
        await t.withIdentity({ subject: "user" }).mutation(api.threads.prepareThreadRetry, {
            threadId,
            targetFromMessageId: "follow-up"
        })
        expect(await sandbox()).toMatchObject({ status: "active" })
        expect(await scheduled()).toHaveLength(0)
    })

    it("closes a workspace that is still starting so start-up cancels itself", async () => {
        const { t, threadId, sandboxId, sandbox, scheduled } = await setup("provisioning")
        await t.withIdentity({ subject: "user" }).mutation(api.threads.prepareThreadRetry, {
            threadId,
            targetFromMessageId: "ask"
        })
        expect(await sandbox()).toMatchObject({ status: "stopped", terminationReason: "user" })
        // Start-up owns its own cleanup, so nothing races it to settle the reservation.
        expect(await scheduled()).toHaveLength(0)
        // Every later start-up step refuses a record that is no longer provisioning.
        expect(
            await t.mutation(internal.persistent_sandboxes.markPersistentSandboxBillingReserved, {
                sandboxId,
                billingMessageKey: "billing-1",
                reservedMicrousd: 100
            })
        ).toBe(false)
        expect(
            await t.mutation(
                internal.persistent_sandboxes.markPersistentSandboxProvisioningFailed,
                {
                    sandboxId,
                    error: "late failure"
                }
            )
        ).toBeNull()
        expect(await sandbox()).toMatchObject({ status: "stopped" })
    })
})
