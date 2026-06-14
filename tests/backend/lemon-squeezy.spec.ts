import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("convex/values", () => {
    const passthrough = () => ({})
    return {
        v: new Proxy(
            {},
            {
                get: () => passthrough
            }
        )
    }
})

vi.mock("../../convex/_generated/server", () => ({
    internalMutation: (config: unknown) => config,
    query: (config: unknown) => config
}))

import { recordLemonSqueezyWebhook } from "../../convex/billing"
import {
    parseLemonSqueezyWebhookPayload,
    verifyLemonSqueezySignature
} from "../../convex/lib/lemon_squeezy"

const recordLemonSqueezyWebhookHandler = recordLemonSqueezyWebhook as unknown as {
    handler: (
        ctx: LemonSqueezyTestCtx,
        args: { payload: ReturnType<typeof createSubscriptionPayload> }
    ) => Promise<unknown>
}

type LemonSqueezyTestCtx = {
    db: {
        query: ReturnType<typeof vi.fn>
        insert: ReturnType<typeof vi.fn>
        patch: ReturnType<typeof vi.fn>
    }
}

const createSubscriptionPayload = (overrides: Record<string, unknown> = {}) => ({
    meta: {
        event_name: "subscription_updated",
        webhook_id: "webhook-1",
        custom_data: {
            user_id: "user-1"
        }
    },
    data: {
        id: "sub-1",
        type: "subscriptions",
        attributes: {
            customer_id: "customer-1",
            order_id: "order-1",
            product_id: "product-1",
            variant_id: "variant-1",
            status: "active",
            renews_at: "2026-07-01T00:00:00.000000Z",
            ends_at: null,
            ...overrides
        }
    }
})

const createCtx = (options?: {
    existingEvent?: Record<string, unknown> | null
    existingSubscription?: Record<string, unknown> | null
    existingAccount?: Record<string, unknown> | null
}) =>
    ({
        db: {
            query: vi.fn().mockImplementation((table: string) => ({
                withIndex: vi.fn().mockReturnValue({
                    first: vi
                        .fn()
                        .mockResolvedValue(
                            table === "lemonSqueezyWebhookEvents"
                                ? (options?.existingEvent ?? null)
                                : table === "lemonSqueezySubscriptions"
                                  ? (options?.existingSubscription ?? null)
                                  : table === "prototypeCreditAccounts"
                                    ? (options?.existingAccount ?? null)
                                    : null
                        )
                })
            })),
            insert: vi.fn().mockResolvedValue("inserted-id"),
            patch: vi.fn()
        }
    }) as LemonSqueezyTestCtx

const hmacHex = async (body: string, secret: string) => {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    )
    const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(body))
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
}

describe("Lemon Squeezy billing", () => {
    beforeEach(() => {
        vi.setSystemTime(new Date("2026-06-13T00:00:00.000Z"))
    })

    it("verifies Lemon Squeezy HMAC signatures against the raw body", async () => {
        const rawBody = JSON.stringify(createSubscriptionPayload())
        const signature = await hmacHex(rawBody, "secret")

        await expect(
            verifyLemonSqueezySignature({
                rawBody,
                secret: "secret",
                signature
            })
        ).resolves.toBe(true)
        await expect(
            verifyLemonSqueezySignature({
                rawBody,
                secret: "wrong-secret",
                signature
            })
        ).resolves.toBe(false)
    })

    it("extracts the user, subscription, and pro plan from an active subscription payload", () => {
        expect(parseLemonSqueezyWebhookPayload(createSubscriptionPayload())).toMatchObject({
            eventId: "webhook-1",
            eventName: "subscription_updated",
            userId: "user-1",
            subscriptionId: "sub-1",
            customerId: "customer-1",
            status: "active",
            plan: "pro"
        })
    })

    it("records a subscription webhook once and upgrades the credit account", async () => {
        const ctx = createCtx({
            existingAccount: {
                _id: "account-1",
                enabled: true,
                plan: "free",
                monthlyBasicCredits: 99,
                monthlyProCredits: 1
            }
        })

        const result = await recordLemonSqueezyWebhookHandler.handler(ctx, {
            payload: createSubscriptionPayload()
        })

        expect(result).toEqual({
            status: "processed",
            eventId: "webhook-1",
            plan: "pro"
        })
        expect(ctx.db.insert).toHaveBeenCalledWith(
            "lemonSqueezyWebhookEvents",
            expect.objectContaining({
                eventId: "webhook-1",
                userId: "user-1",
                subscriptionId: "sub-1"
            })
        )
        expect(ctx.db.insert).toHaveBeenCalledWith(
            "lemonSqueezySubscriptions",
            expect.objectContaining({
                userId: "user-1",
                lemonSqueezySubscriptionId: "sub-1",
                status: "active",
                plan: "pro"
            })
        )
        expect(ctx.db.patch).toHaveBeenCalledWith(
            "account-1",
            expect.objectContaining({
                userId: "user-1",
                enabled: true,
                plan: "pro",
                monthlyBasicCredits: 99,
                monthlyProCredits: 1
            })
        )
    })

    it("does not reapply a webhook event that has already been processed", async () => {
        const ctx = createCtx({
            existingEvent: {
                _id: "event-1",
                eventId: "webhook-1"
            }
        })

        const result = await recordLemonSqueezyWebhookHandler.handler(ctx, {
            payload: createSubscriptionPayload()
        })

        expect(result).toEqual({
            status: "duplicate",
            eventId: "webhook-1"
        })
        expect(ctx.db.insert).not.toHaveBeenCalled()
        expect(ctx.db.patch).not.toHaveBeenCalled()
    })

    it("keeps a cancelled grace-period subscription on the pro plan", async () => {
        const ctx = createCtx({
            existingSubscription: {
                _id: "sub-record-1"
            },
            existingAccount: {
                _id: "account-1",
                enabled: true,
                plan: "pro"
            }
        })

        const result = await recordLemonSqueezyWebhookHandler.handler(ctx, {
            payload: createSubscriptionPayload({ status: "cancelled" })
        })

        expect(result).toMatchObject({
            status: "processed",
            plan: "pro"
        })
        expect(ctx.db.patch).toHaveBeenCalledWith(
            "sub-record-1",
            expect.objectContaining({
                status: "cancelled",
                plan: "pro"
            })
        )
        expect(ctx.db.patch).toHaveBeenCalledWith(
            "account-1",
            expect.objectContaining({
                plan: "pro"
            })
        )
    })

    it("downgrades an expired subscription to the free plan", async () => {
        const ctx = createCtx({
            existingSubscription: {
                _id: "sub-record-1"
            },
            existingAccount: {
                _id: "account-1",
                enabled: true,
                plan: "pro"
            }
        })

        const result = await recordLemonSqueezyWebhookHandler.handler(ctx, {
            payload: createSubscriptionPayload({ status: "expired" })
        })

        expect(result).toMatchObject({
            status: "processed",
            plan: "free"
        })
        expect(ctx.db.patch).toHaveBeenCalledWith(
            "sub-record-1",
            expect.objectContaining({
                status: "expired",
                plan: "free"
            })
        )
        expect(ctx.db.patch).toHaveBeenCalledWith(
            "account-1",
            expect.objectContaining({
                plan: "free"
            })
        )
    })

    it("downgrades a past-due subscription immediately", async () => {
        const ctx = createCtx({
            existingSubscription: {
                _id: "sub-record-1"
            },
            existingAccount: {
                _id: "account-1",
                enabled: true,
                plan: "pro"
            }
        })

        const result = await recordLemonSqueezyWebhookHandler.handler(ctx, {
            payload: createSubscriptionPayload({ status: "past_due" })
        })

        expect(result).toMatchObject({
            status: "processed",
            plan: "free"
        })
        expect(ctx.db.patch).toHaveBeenCalledWith(
            "account-1",
            expect.objectContaining({
                plan: "free"
            })
        )
    })

    it("restores pro when a recovered payment sends an active subscription", async () => {
        const ctx = createCtx({
            existingSubscription: {
                _id: "sub-record-1"
            },
            existingAccount: {
                _id: "account-1",
                enabled: true,
                plan: "free"
            }
        })

        const result = await recordLemonSqueezyWebhookHandler.handler(ctx, {
            payload: {
                ...createSubscriptionPayload({ status: "active" }),
                meta: {
                    event_name: "subscription_payment_recovered",
                    webhook_id: "webhook-recovered",
                    custom_data: {
                        user_id: "user-1"
                    }
                }
            }
        })

        expect(result).toMatchObject({
            status: "processed",
            plan: "pro"
        })
        expect(ctx.db.patch).toHaveBeenCalledWith(
            "account-1",
            expect.objectContaining({
                plan: "pro"
            })
        )
    })
})
