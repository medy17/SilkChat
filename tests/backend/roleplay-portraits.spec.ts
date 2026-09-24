import { beforeEach, describe, expect, it, vi } from "vitest"

const { getUserIdentityMock, r2GetMetadataMock } = vi.hoisted(() => ({
    getUserIdentityMock: vi.fn(),
    r2GetMetadataMock: vi.fn()
}))

vi.mock("convex/values", () => {
    const passthrough = () => ({})
    return { v: new Proxy({}, { get: () => passthrough }) }
})

vi.mock("../../convex/_generated/server", () => ({
    internalMutation: (config: unknown) => config,
    mutation: (config: unknown) => config
}))

vi.mock("../../convex/lib/identity", () => ({ getUserIdentity: getUserIdentityMock }))
vi.mock("../../convex/lib/account_deletion_status", () => ({ assertAccountNotDeleting: vi.fn() }))
vi.mock("../../convex/attachments", () => ({ r2: { getMetadata: r2GetMetadataMock } }))

import { setRoleplayPortrait } from "../../convex/roleplay_portraits"

type Handler = (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>
const handler = (setRoleplayPortrait as unknown as { handler: Handler }).handler

const cardMessage = (threadId: string) => ({
    threadId,
    messageId: "assistant-1",
    parts: [
        {
            type: "tool-invocation",
            toolInvocation: {
                toolName: "prepareImageGeneration",
                toolCallId: "call-1",
                state: "result",
                result: {
                    cardId: "card-1",
                    portrait: { characterId: "kael", name: "Kael" },
                    assets: [
                        { generatedImageId: "image-1", storageKey: "generations/user-1/kael.png" }
                    ]
                }
            }
        }
    ]
})

const createCtx = (messages: unknown[]) => {
    const patch = vi.fn()
    return {
        patch,
        ctx: {
            auth: {},
            db: {
                get: vi.fn(async () => ({
                    _id: "thread-1",
                    authorId: "user-1",
                    roleplayPortraits: [
                        { characterId: "kael", storageKey: "generations/user-1/older.png" }
                    ]
                })),
                query: () => ({ withIndex: () => ({ collect: async () => messages }) }),
                patch
            }
        }
    }
}

const cardSource = {
    kind: "card",
    messageId: "assistant-1",
    toolCallId: "call-1",
    cardId: "card-1",
    generatedImageId: "image-1"
}

describe("setRoleplayPortrait", () => {
    beforeEach(() => {
        getUserIdentityMock.mockReset().mockResolvedValue({ id: "user-1" })
        r2GetMetadataMock
            .mockReset()
            .mockResolvedValue({ authorId: "user-1", uploadStatus: "ready" })
    })

    it("sets a SilkScreen variant from this thread, replacing the character's portrait", async () => {
        const { ctx, patch } = createCtx([cardMessage("thread-1")])
        await handler(ctx, { threadId: "thread-1", characterId: "kael", source: cardSource })
        expect(patch).toHaveBeenCalledWith("thread-1", {
            roleplayPortraits: [
                {
                    characterId: "kael",
                    storageKey: "generations/user-1/kael.png",
                    generatedImageId: "image-1"
                }
            ]
        })
    })

    it("rejects a card that belongs to another thread", async () => {
        const { ctx, patch } = createCtx([cardMessage("thread-2")])
        await expect(
            handler(ctx, { threadId: "thread-1", characterId: "kael", source: cardSource })
        ).rejects.toThrow("not part of this conversation")
        expect(patch).not.toHaveBeenCalled()
    })

    it("accepts a crop only from the user's own portrait uploads", async () => {
        const { ctx, patch } = createCtx([cardMessage("thread-1")])
        await expect(
            handler(ctx, {
                threadId: "thread-1",
                characterId: "kael",
                source: { ...cardSource, kind: "crop", storageKey: "generations/user-1/kael.png" }
            })
        ).rejects.toThrow("unexpected storage key")

        r2GetMetadataMock.mockResolvedValueOnce({ authorId: "user-2" })
        await expect(
            handler(ctx, {
                threadId: "thread-1",
                characterId: "kael",
                source: {
                    ...cardSource,
                    kind: "crop",
                    storageKey: "roleplay-portraits/user-1/kael.webp"
                }
            })
        ).rejects.toThrow("could not be found")
        expect(patch).not.toHaveBeenCalled()
    })

    it("assigns a completed crop in one mutation and rejects a crop from a foreign card", async () => {
        const { ctx, patch } = createCtx([cardMessage("thread-1")])
        const args = {
            threadId: "thread-1",
            characterId: "kael",
            source: {
                ...cardSource,
                kind: "crop",
                storageKey: "roleplay-portraits/user-1/crop.webp"
            }
        }
        await handler(ctx, args)
        expect(patch).toHaveBeenCalledWith("thread-1", {
            roleplayPortraits: [
                {
                    characterId: "kael",
                    storageKey: args.source.storageKey,
                    generatedImageId: "image-1"
                }
            ]
        })
        expect(ctx.db.get).toHaveBeenCalledTimes(1)
        const foreign = createCtx([cardMessage("thread-2")])
        await expect(handler(foreign.ctx, args)).rejects.toThrow("not part of this conversation")
        expect(foreign.patch).not.toHaveBeenCalled()
    })

    it("rejects nonowners, reserved IDs and unfinished crop uploads", async () => {
        const { ctx, patch } = createCtx([cardMessage("thread-1")])
        getUserIdentityMock.mockResolvedValueOnce({ id: "someone-else" })
        await expect(
            handler(ctx, { threadId: "thread-1", characterId: "kael", source: cardSource })
        ).rejects.toThrow("Thread not found")
        await expect(
            handler(ctx, { threadId: "thread-1", characterId: "user", source: cardSource })
        ).rejects.toThrow("already have their own portraits")
        r2GetMetadataMock.mockResolvedValueOnce({ authorId: "user-1", uploadStatus: "pending" })
        await expect(
            handler(ctx, {
                threadId: "thread-1",
                characterId: "kael",
                source: {
                    ...cardSource,
                    kind: "crop",
                    storageKey: "roleplay-portraits/user-1/crop.webp"
                }
            })
        ).rejects.toThrow("could not be found")
        expect(patch).not.toHaveBeenCalled()
    })
})
