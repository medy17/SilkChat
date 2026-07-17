import { describe, expect, it, vi } from "vitest"

vi.mock("convex/values", () => ({
    ConvexError: class ConvexError extends Error {},
    v: new Proxy(
        {},
        {
            get:
                () =>
                (..._args: unknown[]) => ({})
        }
    )
}))

vi.mock("../../convex/_generated/server", () => ({
    internalMutation: (config: unknown) => config,
    internalQuery: (config: unknown) => config,
    mutation: (config: unknown) => config,
    query: (config: unknown) => config
}))

vi.mock("../../convex/lib/account_deletion_status", () => ({
    assertAccountNotDeleting: vi.fn()
}))

vi.mock("../../convex/lib/identity", () => ({
    getUserIdentity: vi.fn()
}))

import {
    beginPersistentSandboxExecution,
    claimPersistentSandboxIdleStop,
    claimPersistentSandboxRequest,
    claimPersistentSandboxStop,
    finishPersistentSandboxExecution,
    markPersistentSandboxProvisioningFailed
} from "../../convex/persistent_sandboxes"

const claimHandler = claimPersistentSandboxRequest as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const failProvisioningHandler = markPersistentSandboxProvisioningFailed as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const beginExecutionHandler = beginPersistentSandboxExecution as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const finishExecutionHandler = finishPersistentSandboxExecution as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const claimIdleStopHandler = claimPersistentSandboxIdleStop as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const claimStopHandler = claimPersistentSandboxStop as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}

const requestPart = (
    toolCallId: string,
    cardId: string,
    overrides: Record<string, unknown> = {}
) => ({
    type: "tool-invocation",
    toolInvocation: {
        state: "result",
        toolName: "request_persistent_sandbox",
        toolCallId,
        result: {
            success: true,
            kind: "persistent_sandbox_request",
            status: "pending_confirmation",
            cardId,
            purpose: "Run several related analyses",
            runtime: "python3.13",
            ttlMinutes: 5,
            ...overrides
        }
    }
})

const createCtx = (firstCardOverrides: Record<string, unknown> = {}) => {
    const records = new Map<string, Record<string, any>>()
    const messages = [
        {
            _id: "message-doc-1",
            _creationTime: Date.now(),
            threadId: "thread-1",
            messageId: "assistant-1",
            role: "assistant",
            parts: [requestPart("tool-1", "card-1", firstCardOverrides)]
        },
        {
            _id: "message-doc-2",
            _creationTime: Date.now(),
            threadId: "thread-1",
            messageId: "assistant-2",
            role: "assistant",
            parts: [requestPart("tool-2", "card-2")]
        }
    ]
    let nextId = 1

    const db = {
        get: vi.fn(async (id: string) => {
            if (id === "thread-1") return { _id: id, authorId: "user-1" }
            return records.get(id) ?? null
        }),
        insert: vi.fn(async (_table: string, value: Record<string, unknown>) => {
            const id = `sandbox-${nextId++}`
            records.set(id, { _id: id, ...value })
            return id
        }),
        patch: vi.fn(async (id: string, update: Record<string, unknown>) => {
            const record = records.get(id)
            if (record) Object.assign(record, update)
            const message = messages.find((candidate) => candidate._id === id)
            if (message) Object.assign(message, update)
        }),
        query: vi.fn((table: string) => ({
            withIndex: (indexName: string, applyIndex: (query: any) => any) => {
                let filterValue: unknown
                const query = {
                    eq: (_field: string, value: unknown) => {
                        filterValue = value
                        return query
                    }
                }
                applyIndex(query)

                if (table === "messages") {
                    return {
                        collect: async () =>
                            messages.filter((message) => message.messageId === filterValue)
                    }
                }

                const filtered = [...records.values()].filter((record) =>
                    indexName === "bySourceCardId"
                        ? record.sourceCardId === filterValue
                        : record.userId === filterValue
                )
                return {
                    first: async () => filtered[0] ?? null,
                    order: () => ({ take: async () => filtered.reverse() })
                }
            }
        }))
    }

    return { ctx: { db }, records }
}

describe("persistent sandbox lifecycle", () => {
    it("atomically reserves only one account-wide sandbox", async () => {
        const { ctx, records } = createCtx()

        const first = await claimHandler.handler(ctx, {
            userId: "user-1",
            threadId: "thread-1",
            messageId: "assistant-1",
            toolCallId: "tool-1",
            cardId: "card-1",
            sandboxName: "sandbox-name-1"
        })
        const second = await claimHandler.handler(ctx, {
            userId: "user-1",
            threadId: "thread-1",
            messageId: "assistant-2",
            toolCallId: "tool-2",
            cardId: "card-2",
            sandboxName: "sandbox-name-2"
        })

        expect(first.ok).toBe(true)
        expect(second).toMatchObject({ ok: false, reason: "active_exists" })
        expect([...records.values()]).toHaveLength(1)
        expect([...records.values()][0]?.status).toBe("provisioning")
    })

    it("rejects and marks stale approval cards as expired", async () => {
        const { ctx, records } = createCtx({ confirmationExpiresAt: Date.now() - 1 })

        const result = await claimHandler.handler(ctx, {
            userId: "user-1",
            threadId: "thread-1",
            messageId: "assistant-1",
            toolCallId: "tool-1",
            cardId: "card-1",
            sandboxName: "sandbox-name-1"
        })

        expect(result).toEqual({ ok: false, reason: "expired_card" })
        expect(records.size).toBe(0)
        expect(ctx.db.patch).toHaveBeenCalledWith(
            "message-doc-1",
            expect.objectContaining({
                parts: [
                    expect.objectContaining({
                        toolInvocation: expect.objectContaining({
                            result: expect.objectContaining({ status: "expired" })
                        })
                    })
                ]
            })
        )
    })

    it("does not let a late provisioning failure overwrite a user stop", async () => {
        const patch = vi.fn()
        const record = { _id: "sandbox-1", status: "stopping" }

        const result = await failProvisioningHandler.handler(
            { db: { get: vi.fn().mockResolvedValue(record), patch } },
            { sandboxId: "sandbox-1", error: "create finished too late" }
        )

        expect(result).toBeNull()
        expect(patch).not.toHaveBeenCalled()
    })

    it("uses activity leases so an old idle timer cannot stop newer execution", async () => {
        const record = {
            _id: "sandbox-1",
            userId: "user-1",
            status: "active",
            sessionState: "running",
            activityLeaseId: "old-lease",
            executionInProgress: false,
            scheduledIdleStopId: "scheduled-old",
            expiresAt: 20_000
        }
        const patch = vi.fn(async (_id: string, update: Record<string, unknown>) =>
            Object.assign(record, update)
        )
        const ctx = { db: { get: vi.fn(async () => ({ ...record })), patch } }

        const begun = await beginExecutionHandler.handler(ctx, {
            sandboxId: "sandbox-1",
            userId: "user-1",
            activityLeaseId: "new-lease",
            now: 10_000
        })
        const staleIdleStop = await claimIdleStopHandler.handler(ctx, {
            sandboxId: "sandbox-1",
            activityLeaseId: "old-lease"
        })
        const finished = await finishExecutionHandler.handler(ctx, {
            sandboxId: "sandbox-1",
            activityLeaseId: "new-lease",
            executionInProgress: false,
            scheduledIdleStopId: "scheduled-new",
            now: 11_000
        })

        expect(begun).toMatchObject({ scheduledIdleStopId: "scheduled-old" })
        expect(staleIdleStop).toBeNull()
        expect(finished).toBe(true)
        expect(record).toMatchObject({
            activityLeaseId: "new-lease",
            scheduledIdleStopId: "scheduled-new",
            sessionState: "running"
        })
    })

    it("does not let a model release delete a sandbox during execution", async () => {
        const patch = vi.fn()
        const record = {
            _id: "sandbox-1",
            userId: "user-1",
            status: "active",
            executionInProgress: true
        }

        const result = await claimStopHandler.handler(
            { db: { get: vi.fn().mockResolvedValue(record), patch } },
            { sandboxId: "sandbox-1", userId: "user-1", reason: "model" }
        )

        expect(result).toBeNull()
        expect(patch).not.toHaveBeenCalled()
    })
})
