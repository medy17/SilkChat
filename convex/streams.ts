import { v } from "convex/values"
import { internalMutation, internalQuery } from "./_generated/server"

export const getStreamsByThreadId = internalQuery({
    args: { threadId: v.id("threads") },
    handler: async ({ db }, { threadId }) => {
        return await db
            .query("streams")
            .withIndex("byThreadId", (q) => q.eq("threadId", threadId))
            .collect()
    }
})

export const appendStreamId = internalMutation({
    args: { threadId: v.id("threads"), ownerClientId: v.optional(v.string()) },
    handler: async ({ db }, { threadId, ownerClientId }) => {
        return await db.insert("streams", { threadId, ownerClientId, createdAt: Date.now() })
    }
})
