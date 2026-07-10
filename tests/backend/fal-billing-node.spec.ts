import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../convex/_generated/server", () => ({
    internalAction: (config: unknown) => config
}))

vi.mock("../../convex/_generated/api", () => ({
    internal: {
        credits: {
            reconcileSettledUsageCost: "reconcileSettledUsageCost"
        },
        fal_billing_node: {
            reconcileFalUsageCost: "reconcileFalUsageCost"
        }
    }
}))

import { reconcileFalUsageCost } from "../../convex/fal_billing_node"

const reconcileFalUsageCostHandler = reconcileFalUsageCost as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}

describe("fal billing reconciliation", () => {
    beforeEach(() => {
        vi.stubEnv("FAL_KEY", "fal-admin-key")
        vi.stubEnv("FAL_ADMIN_API_KEY", "")
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        vi.unstubAllGlobals()
    })

    it("uses FAL_KEY for billing-events reconciliation when no override key is set", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    billing_events: [
                        {
                            request_id: "fal-request-1",
                            cost_estimate_nano_usd: 4_600_000
                        }
                    ]
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            )
        )
        vi.stubGlobal("fetch", fetchMock)
        const ctx = {
            runMutation: vi.fn().mockResolvedValue({ reconciled: true }),
            scheduler: {
                runAfter: vi.fn()
            }
        }

        const result = await reconcileFalUsageCostHandler.handler(ctx, {
            userId: "user-1",
            messageKey: "image-1",
            requestId: "fal-request-1"
        })

        expect(result).toEqual({ reconciled: true, settledMicrousd: 4_600 })
        expect(fetchMock).toHaveBeenCalledWith(
            expect.objectContaining({
                href: expect.stringContaining("request_id=fal-request-1")
            }),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Key fal-admin-key"
                })
            })
        )
        expect(ctx.runMutation).toHaveBeenCalledWith("reconcileSettledUsageCost", {
            userId: "user-1",
            messageKey: "image-1",
            providerRequestId: "fal-request-1",
            settledMicrousd: 4_600,
            pricingSource: "fal_reported"
        })
        expect(ctx.scheduler.runAfter).not.toHaveBeenCalled()
    })

    it("returns unauthorized without retrying when the configured fal key lacks billing access", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403 }))
        )
        const ctx = {
            runMutation: vi.fn(),
            scheduler: {
                runAfter: vi.fn()
            }
        }

        const result = await reconcileFalUsageCostHandler.handler(ctx, {
            userId: "user-1",
            messageKey: "image-1",
            requestId: "fal-request-1"
        })

        expect(result).toEqual({
            reconciled: false,
            retryScheduled: false,
            reason: "unauthorized"
        })
        expect(ctx.runMutation).not.toHaveBeenCalled()
        expect(ctx.scheduler.runAfter).not.toHaveBeenCalled()
    })
})
