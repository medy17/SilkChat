import { ChatError } from "@/lib/errors"
import type { Infer } from "convex/values"
import { internal } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { httpAction } from "../_generated/server"
import { getUserIdentity } from "../lib/identity"
import { getResumableStreamContext } from "../lib/resumable_stream_context"
import type { Thread } from "../schema"

export const chatDELETE = httpAction(async (ctx, req) => {
    const { searchParams } = new URL(req.url)
    const threadId = searchParams.get("chatId")
    if (!threadId) return new ChatError("bad_request:api").toResponse()

    const session = await getUserIdentity(ctx.auth, { allowAnons: false })

    if ("error" in session) return new ChatError("unauthorized:chat").toResponse()

    let chat: Infer<typeof Thread> | null

    try {
        chat = await ctx.runQuery(internal.threads.getThreadById, {
            threadId: threadId as Id<"threads">
        })
    } catch {
        return new ChatError("not_found:chat").toResponse()
    }

    if (!chat) return new ChatError("not_found:chat").toResponse()

    if (chat.authorId !== session.id) return new ChatError("forbidden:chat").toResponse()

    if (!chat.isLive || !chat.currentStreamId) {
        return new Response(null, { status: 204 })
    }

    const streamContext = getResumableStreamContext()

    if (streamContext) {
        try {
            await streamContext.requestStreamStop(chat.currentStreamId)
        } catch (error) {
            console.error("[cvx][chat][stop] Failed to flag stream as stopped", {
                threadId,
                streamId: chat.currentStreamId,
                error
            })
        }
    }

    // Clear the live flag immediately so viewers settle without waiting for
    // the generation's own finish path (which may already be dead).
    await ctx.runMutation(internal.threads.updateThreadStreamingState, {
        threadId: threadId as Id<"threads">,
        isLive: false,
        currentStreamId: undefined
    })

    return new Response(null, { status: 204 })
})
