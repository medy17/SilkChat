import { getRoleplayPortraitIdError, upsertRoleplayPortrait } from "@/lib/roleplay-portraits"
import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import { type MutationCtx, internalMutation, mutation } from "./_generated/server"
import { r2 } from "./attachments"
import { assertAccountNotDeleting } from "./lib/account_deletion_status"
import { getUserIdentity } from "./lib/identity"

const writePortrait = async (
    ctx: MutationCtx,
    thread: Doc<"threads">,
    {
        characterId,
        storageKey,
        generatedImageId
    }: {
        characterId: string
        storageKey: string
        generatedImageId?: string
    }
) => {
    const idError = getRoleplayPortraitIdError(characterId)
    if (idError) throw new Error(idError)

    await ctx.db.patch(thread._id, {
        roleplayPortraits: upsertRoleplayPortrait(thread.roleplayPortraits ?? [], {
            characterId,
            storageKey,
            ...(generatedImageId ? { generatedImageId } : {})
        })
    })
}

// A SilkScreen variant must come from a card in this thread, so a portrait can only
// ever point at the conversation's own images.
const findCardAssetKey = async (
    ctx: MutationCtx,
    threadId: Id<"threads">,
    source: { messageId: string; toolCallId: string; cardId: string; generatedImageId: string }
) => {
    const messages = await ctx.db
        .query("messages")
        .withIndex("byMessageId", (q) => q.eq("messageId", source.messageId))
        .collect()
    const message = messages.find((candidate) => candidate.threadId === threadId)
    for (const part of message?.parts ?? []) {
        if (
            part.type !== "tool-invocation" ||
            part.toolInvocation.toolName !== "prepareImageGeneration" ||
            part.toolInvocation.toolCallId !== source.toolCallId
        ) {
            continue
        }
        const result = part.toolInvocation.result as
            | {
                  cardId?: string
                  assets?: Array<{ generatedImageId?: string; storageKey?: string }>
              }
            | undefined
        if (result?.cardId !== source.cardId) continue
        const asset = result.assets?.find(
            (candidate) => candidate.generatedImageId === source.generatedImageId
        )
        if (asset?.storageKey) return asset.storageKey
    }
    throw new Error("That image is not part of this conversation.")
}

// Crops share the avatar size policy, but have their own file namespace.
const assertOwnedCrop = async (ctx: MutationCtx, userId: string, key: string) => {
    if (!key.startsWith(`roleplay-portraits/${userId}/`)) {
        throw new Error("Uploaded portrait has an unexpected storage key.")
    }
    const metadata = await r2.getMetadata(ctx, key)
    if (!metadata || metadata.authorId !== userId || metadata.uploadStatus !== "ready") {
        throw new Error("Uploaded portrait could not be found.")
    }
}

export const setRoleplayPortrait = mutation({
    args: {
        threadId: v.id("threads"),
        characterId: v.string(),
        source: v.union(
            v.object({
                kind: v.literal("card"),
                messageId: v.string(),
                toolCallId: v.string(),
                cardId: v.string(),
                generatedImageId: v.string()
            }),
            v.object({
                kind: v.literal("crop"),
                storageKey: v.string(),
                messageId: v.string(),
                toolCallId: v.string(),
                cardId: v.string(),
                generatedImageId: v.string()
            })
        )
    },
    handler: async (ctx, { threadId, characterId, source }) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new Error("Unauthorized")
        await assertAccountNotDeleting(ctx, user.id)

        const thread = await ctx.db.get(threadId)
        if (!thread || thread.authorId !== user.id) throw new Error("Thread not found.")

        const sourceKey = await findCardAssetKey(ctx, threadId, source)
        if (source.kind === "crop") await assertOwnedCrop(ctx, user.id, source.storageKey)
        await writePortrait(ctx, thread, {
            characterId,
            storageKey: source.kind === "crop" ? source.storageKey : sourceKey,
            generatedImageId: source.generatedImageId
        })
    }
})

// The model's assign tool resolves the image from the thread's own references before
// calling this, so the key is already known to belong to the conversation.
export const assignRoleplayPortraitInternal = internalMutation({
    args: {
        threadId: v.id("threads"),
        userId: v.string(),
        characterId: v.string(),
        storageKey: v.string(),
        generatedImageId: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        await assertAccountNotDeleting(ctx, args.userId)
        const thread = await ctx.db.get(args.threadId)
        if (!thread || thread.authorId !== args.userId) throw new Error("Thread not found.")
        await writePortrait(ctx, thread, args)
    }
})
