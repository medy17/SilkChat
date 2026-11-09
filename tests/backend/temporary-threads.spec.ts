import aggregate from "@convex-dev/aggregate/test"
import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import { api, internal } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import schema from "../../convex/schema"
import { TEMPORARY_THREAD_TTL_MS } from "../../convex/lib/temporary_threads"

const modules = import.meta.glob("../../convex/**/*.ts")

const setup = () => {
    const t = convexTest(schema, modules)
    aggregate.register(t, "aggregateFolderThreads")
    const user = t.withIdentity({ subject: "user" })
    const startChat = async (text: string, temporary?: boolean) => {
        const created = await t.mutation(internal.threads.createThreadOrInsertMessages, {
            authorId: "user",
            userMessage: { role: "user", messageId: `${text}-q`, parts: [{ type: "text", text }] },
            proposedNewAssistantId: `${text}-a`,
            temporary
        })
        if (!created || !("threadId" in created)) throw new Error("Expected a created thread")
        return created.threadId as Id<"threads">
    }
    const sidebarIds = async () => {
        const result = await user.query(api.threads.getUserThreadsPaginated, {
            paginationOpts: { numItems: 20, cursor: null }
        })
        return result.page.map((thread) => thread._id)
    }
    return { t, user, startChat, sidebarIds }
}

describe("temporary chats", () => {
    it("stay out of the sidebar and search until kept, then keep the chosen personalization", async () => {
        const { t, user, startChat, sidebarIds } = setup()
        const saved = await startChat("saved")
        const temporary = await startChat("secret", true)

        expect(await sidebarIds()).toEqual([saved])
        const search = await user.query(api.threads.searchUserThreads, {
            query: "secret",
            paginationOpts: { numItems: 20, cursor: null }
        })
        expect(search.page).toEqual([])
        expect(await t.run((ctx) => ctx.db.get(temporary))).toMatchObject({
            personalizationDisabled: true
        })

        await user.mutation(api.threads.keepTemporaryThread, {
            threadId: temporary,
            usePersonalization: false
        })

        expect(await sidebarIds()).toContain(temporary)
        const kept = await t.run((ctx) => ctx.db.get(temporary))
        expect(kept?.temporaryExpiresAt).toBeUndefined()
        expect(kept?.personalizationDisabled).toBe(true)
    })

    it("get memory back in their tools only when kept with personalization and asked for", async () => {
        const { t, user, startChat } = setup()
        const openingToolSelection = {
            enabledTools: ["web_search" as const],
            skillIds: [],
            status: "complete" as const,
            mode: "magic" as const
        }
        const keep = async (usePersonalization: boolean, restoreMemory: boolean) => {
            const threadId = await startChat(`keep-${usePersonalization}-${restoreMemory}`, true)
            await t.run((ctx) => ctx.db.patch(threadId, { openingToolSelection }))
            await user.mutation(api.threads.keepTemporaryThread, {
                threadId,
                usePersonalization,
                restoreMemory
            })
            const kept = await t.run((ctx) => ctx.db.get(threadId))
            return kept?.openingToolSelection?.enabledTools
        }

        expect(await keep(true, true)).toEqual(["web_search", "supermemory"])
        expect(await keep(true, false)).toEqual(["web_search"])
        expect(await keep(false, true)).toEqual(["web_search"])
    })

    it("can't change the choice once kept, and pass it on to branches", async () => {
        const { t, user, startChat } = setup()
        const threadId = await startChat("private", true)
        await user.mutation(api.threads.keepTemporaryThread, {
            threadId,
            usePersonalization: false
        })
        await user.mutation(api.threads.keepTemporaryThread, {
            threadId,
            usePersonalization: true
        })
        expect((await t.run((ctx) => ctx.db.get(threadId)))?.personalizationDisabled).toBe(true)

        const branch = await user.mutation(api.threads.branchThread, {
            threadId,
            messageId: "private-a"
        })
        if (!branch || !("threadId" in branch)) throw new Error("Expected a branch")
        const branched = await t.run((ctx) => ctx.db.get(branch.threadId as Id<"threads">))
        expect(branched?.personalizationDisabled).toBe(true)
    })

    it("are never filed into the folder they were started from", async () => {
        const { t } = setup()
        const folderId = await t.run((ctx) =>
            ctx.db.insert("projects", {
                authorId: "user",
                name: "Work",
                createdAt: 1,
                updatedAt: 1
            })
        )
        const created = await t.mutation(internal.threads.createThreadOrInsertMessages, {
            authorId: "user",
            userMessage: { role: "user", messageId: "q", parts: [{ type: "text", text: "Hi" }] },
            proposedNewAssistantId: "a",
            folderId,
            temporary: true
        })
        if (!created || !("threadId" in created)) throw new Error("Expected a created thread")
        expect((await t.run((ctx) => ctx.db.get(created.threadId)))?.projectId).toBeUndefined()
    })

    it("lose only the thread row when left, and survive while still streaming", async () => {
        const { t, user, startChat } = setup()
        const live = await startChat("live", true)
        await t.run((ctx) => ctx.db.patch(live, { isLive: true }))
        expect(await user.mutation(api.threads.discardTemporaryThread, { threadId: live })).toEqual(
            { discarded: false }
        )

        const left = await startChat("left", true)
        expect(await user.mutation(api.threads.discardTemporaryThread, { threadId: left })).toEqual(
            { discarded: true }
        )
        expect(await t.run((ctx) => ctx.db.get(left))).toBeNull()
        const messages = await t.run((ctx) =>
            ctx.db
                .query("messages")
                .withIndex("byThreadId", (q) => q.eq("threadId", left))
                .collect()
        )
        expect(messages).toHaveLength(2)
    })

    it("are swept once expired, except a recently live stream", async () => {
        const { t, startChat } = setup()
        const kept = await startChat("kept")
        const fresh = await startChat("fresh", true)
        const expired = await startChat("expired", true)
        const streaming = await startChat("streaming", true)
        const past = Date.now() - TEMPORARY_THREAD_TTL_MS
        await t.run(async (ctx) => {
            await ctx.db.patch(expired, { temporaryExpiresAt: past })
            await ctx.db.patch(streaming, { temporaryExpiresAt: Date.now() - 1, isLive: true })
        })

        await t.mutation(internal.threads.sweepExpiredTemporaryThreads, {})

        const remaining = await t.run(async (ctx) =>
            Promise.all([kept, fresh, expired, streaming].map((id) => ctx.db.get(id)))
        )
        expect(remaining.map((thread) => thread?._id ?? null)).toEqual([
            kept,
            fresh,
            null,
            streaming
        ])
    })
})
