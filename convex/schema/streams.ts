import { v } from "convex/values"

export const ResumableStream = v.object({
    finalizedAt: v.optional(v.number()),
    threadId: v.id("threads"),
    ownerClientId: v.optional(v.string()),
    createdAt: v.number()
})
