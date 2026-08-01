import { describe, expect, it, vi } from "vitest"

vi.mock("../../convex/_generated/server", () => ({
    internalMutation: (config: unknown) => config,
    internalQuery: (config: unknown) => config,
    query: (config: unknown) => config
}))

import { getPreparedImageGenerationCardResult, patchMessage } from "../../convex/messages"

const handler = (
    getPreparedImageGenerationCardResult as unknown as {
        handler: (
            ctx: {
                auth: { getUserIdentity: () => Promise<Record<string, unknown> | null> }
                db: {
                    get: ReturnType<typeof vi.fn>
                    query: ReturnType<typeof vi.fn>
                }
            },
            args: {
                threadId: string
                messageId: string
                toolCallId: string
                cardId: string
            }
        ) => Promise<unknown>
    }
).handler

const preparedResult = {
    success: true,
    kind: "prepared_image_generation",
    status: "submitting",
    cardId: "card-1"
}

const createCtx = ({ authorId = "user-1" }: { authorId?: string } = {}) => ({
    auth: {
        getUserIdentity: vi.fn().mockResolvedValue({
            subject: "auth-user-1",
            userId: "user-1",
            isAnonymous: false
        })
    },
    db: {
        get: vi.fn().mockResolvedValue({ _id: "thread-1", authorId }),
        query: vi.fn().mockReturnValue({
            withIndex: vi.fn().mockReturnValue({
                collect: vi.fn().mockResolvedValue([
                    {
                        threadId: "thread-1",
                        messageId: "assistant-1",
                        parts: [
                            {
                                type: "tool-invocation",
                                toolInvocation: {
                                    toolName: "prepareImageGeneration",
                                    toolCallId: "tool-1",
                                    state: "result",
                                    result: preparedResult
                                }
                            }
                        ]
                    }
                ])
            })
        })
    }
})

describe("prepared image generation card query", () => {
    it("returns the persisted card result for its thread owner", async () => {
        await expect(
            handler(createCtx(), {
                threadId: "thread-1",
                messageId: "assistant-1",
                toolCallId: "tool-1",
                cardId: "card-1"
            })
        ).resolves.toEqual(preparedResult)
    })

    it("does not expose a card from another user's thread", async () => {
        const ctx = createCtx({ authorId: "user-2" })

        await expect(
            handler(ctx, {
                threadId: "thread-1",
                messageId: "assistant-1",
                toolCallId: "tool-1",
                cardId: "card-1"
            })
        ).resolves.toBeNull()
        expect(ctx.db.query).not.toHaveBeenCalled()
    })
})

describe("assistant message persistence", () => {
    it("patches the message in the requested thread when a branch shares its message id", async () => {
        const sourceMessage = {
            _id: "source-message",
            threadId: "source-thread",
            messageId: "assistant-1",
            metadata: { modelId: "old-model" }
        }
        const branchMessage = {
            _id: "branch-message",
            threadId: "branch-thread",
            messageId: "assistant-1",
            metadata: {}
        }
        const patch = vi.fn()
        const ctx = {
            db: {
                get: vi.fn(),
                patch,
                query: vi.fn().mockReturnValue({
                    withIndex: vi.fn().mockReturnValue({
                        collect: vi.fn().mockResolvedValue([sourceMessage, branchMessage])
                    })
                }),
                insert: vi.fn()
            }
        }
        const patchHandler = (
            patchMessage as unknown as {
                handler: (
                    context: typeof ctx,
                    args: {
                        threadId: string
                        messageId: string
                        parts: Array<{ type: "text"; text: string }>
                    }
                ) => Promise<void>
            }
        ).handler
        const parts = [{ type: "text" as const, text: "Persisted branch response" }]

        await patchHandler(ctx, {
            threadId: "branch-thread",
            messageId: "assistant-1",
            parts
        })

        expect(patch).toHaveBeenCalledWith("branch-message", {
            parts,
            metadata: {},
            updatedAt: expect.any(Number)
        })
        expect(patch).toHaveBeenCalledWith("branch-thread", {
            updatedAt: expect.any(Number)
        })
        expect(patch).not.toHaveBeenCalledWith("source-message", expect.objectContaining({ parts }))
    })
})
