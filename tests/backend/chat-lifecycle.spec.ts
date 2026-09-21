import { convexTest } from "convex-test"
import aggregate from "@convex-dev/aggregate/test"
import { describe, expect, it } from "vitest"
import schema from "../../convex/schema"
import { api, internal } from "../../convex/_generated/api"

const modules = import.meta.glob("../../convex/**/*.ts")
const setup = async () => {
    const t = convexTest(schema, modules)
    const ids = await t.run(async (ctx) => {
        const threadId = await ctx.db.insert("threads", {
            authorId: "user",
            title: "Chat",
            createdAt: 1,
            updatedAt: 1
        })
        await ctx.db.insert("messages", {
            threadId,
            messageId: "question",
            role: "user",
            parts: [{ type: "text", text: "Before" }],
            metadata: {},
            createdAt: 1,
            updatedAt: 1
        })
        const messageId = await ctx.db.insert("messages", {
            threadId,
            messageId: "assistant",
            role: "assistant",
            parts: [],
            metadata: {},
            createdAt: 2,
            updatedAt: 2
        })
        return { threadId, messageId }
    })
    const register = () =>
        t.mutation(internal.streams.appendStreamId, {
            threadId: ids.threadId,
            userId: "user",
            assistantMessageConvexId: ids.messageId
        })
    return { t, ...ids, register }
}

describe("chat turn lifecycle", () => {
    it.each(["untouched", "edited", "streaming", "new-message", "wrong-owner"])(
        "rolls back a rejected opening only while untouched: %s",
        async (state) => {
            const t = convexTest(schema, modules)
            aggregate.register(t, "aggregateFolderThreads")
            const created = await t.mutation(internal.threads.createThreadOrInsertMessages, {
                authorId: "user",
                userMessage: {
                    role: "user",
                    messageId: "opening",
                    parts: [{ type: "text", text: "Search" }]
                },
                proposedNewAssistantId: "answer"
            })
            if (!created || !("createdMessageIds" in created) || !created.createdMessageIds)
                throw new Error("Expected creation")
            if (state === "edited")
                await t.run((ctx) =>
                    ctx.db.patch(created.assistantMessageConvexId, {
                        parts: [{ type: "text", text: "Answer" }]
                    })
                )
            if (state === "streaming")
                await t.mutation(internal.streams.appendStreamId, {
                    threadId: created.threadId,
                    userId: "user",
                    assistantMessageConvexId: created.assistantMessageConvexId
                })
            if (state === "new-message")
                await t.mutation(internal.threads.createThreadOrInsertMessages, {
                    threadId: created.threadId,
                    authorId: "user",
                    userMessage: {
                        role: "user",
                        messageId: "next",
                        parts: [{ type: "text", text: "Next" }]
                    },
                    proposedNewAssistantId: "next-answer"
                })
            const rolledBack = await t.mutation(internal.threads.rollbackRejectedOpening, {
                threadId: created.threadId,
                authorId: state === "wrong-owner" ? "other" : "user",
                assistantMessageConvexId: created.assistantMessageConvexId,
                createdMessageIds: created.createdMessageIds
            })
            expect(rolledBack).toBe(state === "untouched")
            const remaining = await t.run(async (ctx) => ({
                thread: await ctx.db.get(created.threadId),
                messages: await ctx.db.query("messages").collect()
            }))
            if (state === "untouched") expect(remaining).toEqual({ thread: null, messages: [] })
            else expect(remaining.thread).not.toBeNull()
        }
    )

    it("marks only actual creation, not a replay or retry of the first message, as new", async () => {
        const t = convexTest(schema, modules)
        aggregate.register(t, "aggregateFolderThreads")
        const args = {
            authorId: "user",
            userMessage: {
                role: "user" as const,
                messageId: "opening",
                parts: [{ type: "text" as const, text: "Hello" }]
            },
            proposedNewAssistantId: "first-answer"
        }
        const created = await t.mutation(internal.threads.createThreadOrInsertMessages, args)
        expect(created).toMatchObject({ createdThread: true })
        if (!created || !("threadId" in created)) throw new Error("Expected a created thread")
        const replay = await t.mutation(internal.threads.createThreadOrInsertMessages, args)
        expect(replay).toMatchObject({ threadId: created.threadId })
        expect(replay).not.toHaveProperty("createdThread", true)
        const retry = await t.mutation(internal.threads.createThreadOrInsertMessages, {
            ...args,
            threadId: created.threadId,
            proposedNewAssistantId: "retry-answer",
            targetFromMessageId: "opening",
            targetMode: "retry"
        })
        expect(retry).toMatchObject({
            threadId: created.threadId,
            assistantMessageId: "first-answer"
        })
        expect(retry).not.toHaveProperty("createdThread", true)
    })
    it("saves the opening tool selection once and makes it available to replays and reconnects", async () => {
        const t = convexTest(schema, modules)
        aggregate.register(t, "aggregateFolderThreads")
        const args = {
            authorId: "user",
            proposedNewAssistantId: "opening-answer",
            userMessage: {
                role: "user" as const,
                messageId: "opening-question",
                parts: [{ type: "text" as const, text: "Find current news" }]
            },
            openingToolSelection: {
                enabledTools: [],
                skillIds: [],
                mode: "magic" as const,
                status: "pending" as const
            }
        }
        const created = await t.mutation(internal.threads.createThreadOrInsertMessages, args)
        if (!created || !("threadId" in created)) throw new Error("Expected thread")
        const selection = {
            enabledTools: ["web_search" as const],
            skillIds: ["web_search" as const],
            mode: "magic" as const,
            status: "complete" as const
        }
        await t.mutation(internal.threads.completeOpeningToolSelection, {
            threadId: created.threadId,
            authorId: "user",
            selection
        })
        // A delayed duplicate must not replace the saved result.
        await t.mutation(internal.threads.completeOpeningToolSelection, {
            threadId: created.threadId,
            authorId: "user",
            selection: { ...selection, enabledTools: [], skillIds: [] }
        })
        expect(await t.mutation(internal.threads.createThreadOrInsertMessages, args)).toMatchObject(
            { openingToolSelection: selection }
        )
        expect(
            await t.query(internal.chat_readiness.getThreadContext, {
                threadId: created.threadId,
                userId: "user"
            })
        ).toMatchObject({ openingToolSelection: selection })
        await expect(
            t.mutation(internal.threads.completeOpeningToolSelection, {
                threadId: created.threadId,
                authorId: "other-user",
                selection
            })
        ).rejects.toThrow("Thread unavailable")
    })

    it("publishes partial content without changing thread state until completion", async () => {
        const { t, threadId, messageId, register } = await setup()
        const streamId = await register()
        await t.mutation(internal.threads.updateThreadStreamingState, {
            threadId,
            isLive: true,
            currentStreamId: streamId,
            expectedStreamId: streamId
        })
        const before = await t.run((ctx) => ctx.db.get(threadId))
        const args = {
            threadId,
            messageId: "assistant",
            expectedMessageId: messageId,
            expectedStreamId: streamId,
            parts: [{ type: "text" as const, text: "Partial answer" }]
        }
        await t.mutation(internal.messages.patchMessage, args)
        expect(await t.run((ctx) => ctx.db.get(threadId))).toEqual(before)
        // Passive viewers still receive the saved content through the public query.
        const messages = await t
            .withIdentity({ subject: "user" })
            .query(api.threads.getThreadMessages, { threadId })
        expect(messages).toEqual(
            expect.arrayContaining([expect.objectContaining({ _id: messageId, parts: args.parts })])
        )
        await t.mutation(internal.messages.finalizeStream, {
            ...args,
            parts: [{ type: "text", text: "Complete answer" }]
        })
        const completed = await t.run((ctx) => ctx.db.get(threadId))
        expect(completed?.updatedAt).toBeGreaterThan(before!.updatedAt)
        expect(completed?.isLive).toBe(false)
        expect(completed?.currentStreamId).toBeUndefined()
    })

    it("keeps valid overlapping answers while only the latest turn controls live state", async () => {
        const { t, threadId, messageId, register } = await setup()
        const old = await register()
        const newerMessage = await t.run((ctx) =>
            ctx.db.insert("messages", {
                threadId,
                messageId: "newer",
                role: "assistant",
                parts: [],
                metadata: {},
                createdAt: 3,
                updatedAt: 3
            })
        )
        const current = await t.mutation(internal.streams.appendStreamId, {
            threadId,
            userId: "user",
            assistantMessageConvexId: newerMessage
        })
        await t.mutation(internal.threads.updateThreadStreamingState, {
            threadId,
            isLive: true,
            currentStreamId: current,
            expectedStreamId: current
        })
        await t.mutation(internal.messages.finalizeStream, {
            threadId,
            messageId: "assistant",
            expectedMessageId: messageId,
            expectedStreamId: old,
            parts: [{ type: "text", text: "Valid older answer" }],
            metadata: { modelId: "model" }
        })
        expect(await t.run((ctx) => ctx.db.get(messageId))).toMatchObject({
            parts: [{ type: "text", text: "Valid older answer" }]
        })
        expect(await t.run((ctx) => ctx.db.get(threadId))).toMatchObject({
            isLive: true,
            currentStreamId: current
        })
        expect(await t.run((ctx) => ctx.db.get(newerMessage))).toMatchObject({ parts: [] })
    })
    it("ignores old stream saves and cleanup after a new stream takes ownership", async () => {
        const { t, threadId, messageId, register } = await setup()
        const old = await register()
        const current = await register()
        await t.mutation(internal.threads.updateThreadStreamingState, {
            threadId,
            isLive: true,
            currentStreamId: current,
            expectedStreamId: current
        })
        await t.mutation(internal.messages.finalizeStream, {
            threadId,
            messageId: "assistant",
            expectedMessageId: messageId,
            expectedStreamId: old,
            parts: [{ type: "text", text: "Old answer" }],
            metadata: { modelId: "model" }
        })
        await t.mutation(internal.threads.updateThreadStreamingState, {
            threadId,
            isLive: false,
            expectedStreamId: old
        })
        expect(await t.run((ctx) => ctx.db.get(threadId))).toMatchObject({
            isLive: true,
            currentStreamId: current
        })
        expect(await t.run((ctx) => ctx.db.get(messageId))).toMatchObject({ parts: [] })
        expect(await t.run((ctx) => ctx.db.query("usageEvents").collect())).toHaveLength(0)
    })

    it("finalizes once and rejects delayed partial saves or restart attempts", async () => {
        const { t, threadId, messageId, register } = await setup()
        const streamId = await register()
        const args = {
            threadId,
            messageId: "assistant",
            expectedMessageId: messageId,
            expectedStreamId: streamId,
            parts: [{ type: "text" as const, text: "Complete" }],
            metadata: { modelId: "model", promptTokens: 10, completionTokens: 20 }
        }
        await t.mutation(internal.messages.finalizeStream, args)
        await t.mutation(internal.messages.finalizeStream, args)
        await t.mutation(internal.messages.patchMessage, {
            ...args,
            parts: [{ type: "text", text: "Partial" }]
        })
        await t.mutation(internal.threads.updateThreadStreamingState, {
            threadId,
            isLive: true,
            currentStreamId: streamId,
            expectedStreamId: streamId
        })
        expect(await t.run((ctx) => ctx.db.get(messageId))).toMatchObject({ parts: args.parts })
        expect(await t.run((ctx) => ctx.db.get(threadId))).toMatchObject({ isLive: false })
        expect(await t.run((ctx) => ctx.db.query("usageEvents").collect())).toHaveLength(1)
    })

    it("rejects admission after deletion starts and rejects another user's thread", async () => {
        const { t, threadId, messageId, register } = await setup()
        await expect(
            t.query(internal.chat_readiness.getThreadContext, { userId: "other", threadId })
        ).rejects.toThrow("Thread unavailable")
        await expect(
            t.mutation(internal.streams.appendStreamId, {
                threadId,
                userId: "other",
                assistantMessageConvexId: messageId
            })
        ).rejects.toThrow("Turn is no longer available")
        await t.run((ctx) =>
            ctx.db.insert("accountDeletionJobs", {
                userId: "user",
                status: "pending",
                createdAt: 1,
                updatedAt: 1
            })
        )
        expect(await t.query(internal.chat_readiness.get, { userId: "user", threadId })).toEqual({
            blocked: true
        })
        await expect(register()).rejects.toThrow("Account deletion is in progress")
        await expect(
            t.mutation(internal.threads.createThreadOrInsertMessages, {
                threadId,
                authorId: "user",
                proposedNewAssistantId: "next",
                userMessage: { role: "user", parts: [{ type: "text", text: "Hello" }] }
            })
        ).rejects.toThrow("Account deletion is in progress")
        expect(await t.run((ctx) => ctx.db.query("streams").collect())).toHaveLength(0)
    })

    it("returns committed edit history and cannot register a deleted retry placeholder", async () => {
        const { t, threadId, messageId, register } = await setup()
        const ready = await t.query(internal.chat_readiness.get, { userId: "user", threadId })
        expect(ready.blocked).toBe(false)
        if (ready.blocked) throw new Error("Unexpected blocked readiness")
        expect(ready.registry.settings.userId).toBe("user")
        expect(ready.context?.messages.some((message) => message._id === messageId)).toBe(true)
        await t.mutation(internal.threads.createThreadOrInsertMessages, {
            authorId: "user",
            threadId,
            targetFromMessageId: "question",
            targetMode: "edit",
            proposedNewAssistantId: "attempt-2",
            userMessage: { role: "user", parts: [{ type: "text", text: "After" }] }
        })
        await expect(register()).rejects.toThrow("Turn is no longer available")
        const context = await t.query(internal.chat_readiness.getThreadContext, {
            userId: "user",
            threadId
        })
        expect(context.messages).toHaveLength(2)
        expect(context.messages[0]._id).not.toBe(messageId)
        expect(context.messages[1].parts).toEqual([{ type: "text", text: "After" }])
    })
})
