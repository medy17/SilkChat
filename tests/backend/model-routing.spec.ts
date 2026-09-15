import { describe, expect, it, vi } from "vitest"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateText } from "ai"
import {
    applyModelRouting,
    getOpenRouterRouting,
    getRoutedOpenRouterModelId
} from "../../convex/lib/model_routing"
import {
    buildRoutingMetadata,
    endpointKey,
    parseRoutingEndpoints,
    parseZdrEndpointKeys,
    pricePerMillion
} from "../../convex/lib/model_routing_metadata"

const listing = {
    data: {
        endpoints: [
            {
                tag: "curated",
                pricing: { prompt: "0.000002", completion: "0.000008" },
                context_length: 128000
            },
            {
                tag: "private",
                pricing: { prompt: "0.000001", completion: "0.000004" },
                context_length: 64000
            },
            {
                tag: "private/flex",
                pricing: { prompt: "0", completion: "0" },
                context_length: 64000
            },
            { tag: "curated/fast", pricing: { prompt: "0.000004", completion: "0.000016" } }
        ]
    }
}
const keys = new Set([
    endpointKey("vendor/model", "private"),
    endpointKey("vendor/model", "private/flex")
])

describe("model routing metadata", () => {
    it("keeps discounted ZDR endpoints in floor pricing while curated and ZDR use their own pools", () => {
        const endpoints = parseRoutingEndpoints(listing, "vendor/model", keys)
        const routing = buildRoutingMetadata(endpoints, 123, ["curated"])
        expect(routing.silkchat?.pricingEndpoint).toBe("curated")
        expect(routing.zdr?.pricingEndpoint).toBe("private")
        expect(routing.floor?.pricing).toMatchObject({
            inputUsdPer1MTokens: 0,
            outputUsdPer1MTokens: 0
        })
        expect(routing.floor?.pricingEndpoint).toBe("private/flex")
        expect(Object.values(routing).every((summary) => !("endpoints" in summary!))).toBe(true)
    })

    it("does not disable a provider just because its price is missing", () => {
        const endpoints = parseRoutingEndpoints(
            { data: { endpoints: [{ tag: "private", pricing: {} }] } },
            "vendor/model",
            keys
        )
        const routing = buildRoutingMetadata(endpoints, 123)
        expect(routing.zdr).toMatchObject({ available: true, pricing: undefined })
        expect(applyModelRouting({ routing }, "zdr").routingUnavailableReason).toBeUndefined()
        expect(
            applyModelRouting({ routing: buildRoutingMetadata([], 123) }, "zdr")
                .routingUnavailableReason
        ).toBe("No ZDR providers available.")
    })

    it("distinguishes a failed ZDR refresh from a successful empty listing", () => {
        expect(() => parseZdrEndpointKeys({ error: "upstream unavailable" })).toThrow()
        expect(() => parseRoutingEndpoints({ data: {} }, "vendor/model")).toThrow()
        expect(
            buildRoutingMetadata(parseRoutingEndpoints(listing, "vendor/model"), 123, [], false).zdr
        ).toBeUndefined()
        expect(
            buildRoutingMetadata(parseRoutingEndpoints(listing, "vendor/model", new Set()), 123).zdr
                ?.available
        ).toBe(false)
    })

    it("preserves zero rates and rejects malformed or absent prices", () => {
        expect(pricePerMillion("0")).toBe(0)
        expect(pricePerMillion("0.000000875")).toBe(0.875)
        for (const value of [null, undefined, "", "1oops", false, -1, Infinity])
            expect(pricePerMillion(value)).toBeUndefined()
    })

    it("joins privacy by exact model and endpoint, not the provider name", () => {
        const zdrKeys = parseZdrEndpointKeys({
            data: [{ model_id: "vendor/another", tag: "private" }]
        })
        expect(
            parseRoutingEndpoints(listing, "vendor/model", zdrKeys).every((e) => e.zdr === false)
        ).toBe(true)
    })

    it("does not borrow another mode's prices and respects endpoint context limits", () => {
        const routing = buildRoutingMetadata(
            parseRoutingEndpoints(listing, "vendor/model", keys),
            123,
            ["curated"]
        )
        const model = {
            routing,
            inputUsdPer1MTokens: 100,
            outputUsdPer1MTokens: 100,
            contextLength: 128000
        }
        expect(applyModelRouting(model, "zdr")).toMatchObject({
            inputUsdPer1MTokens: 1,
            outputUsdPer1MTokens: 4,
            contextLength: 64000
        })
        expect(
            applyModelRouting({ inputUsdPer1MTokens: 100 }, "floor").inputUsdPer1MTokens
        ).toBeUndefined()
    })

    it("allows explicit tier preferences only in curated routing", () => {
        const routing = buildRoutingMetadata(
            parseRoutingEndpoints(
                {
                    data: {
                        endpoints: [
                            {
                                tag: "curated/fast",
                                pricing: { prompt: "0.000004", completion: "0.000016" }
                            }
                        ]
                    }
                },
                "vendor/model",
                keys
            ),
            123,
            ["curated/fast"]
        )
        expect(routing.silkchat?.pricingEndpoint).toBe("curated/fast")
        expect(routing.floor?.available).toBe(false)
    })
})

describe("OpenRouter request contract", () => {
    it.each(["silkchat", "zdr", "floor"] as const)(
        "sends %s through the installed SDK without dropping routing options",
        async (mode) => {
            const requestFetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
                const request = JSON.parse(String(init?.body))
                expect(request.model).toBe(mode === "floor" ? "vendor/model:floor" : "vendor/model")
                expect(request.provider.require_parameters).toBe(true)
                expect(request.provider.zdr).toBe(mode === "zdr" ? true : undefined)
                expect(request.provider.order).toEqual(
                    mode === "silkchat" ? ["curated"] : undefined
                )
                expect(request.provider.only).toBeUndefined()
                return new Response(
                    JSON.stringify({
                        id: "gen-test",
                        model: request.model,
                        created: 1,
                        choices: [
                            {
                                index: 0,
                                message: { role: "assistant", content: "OK" },
                                finish_reason: "stop"
                            }
                        ],
                        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost: 0 }
                    }),
                    { headers: { "Content-Type": "application/json" } }
                )
            })
            const routing = getOpenRouterRouting(mode, ["curated"])
            const provider = createOpenRouter({ apiKey: "test", fetch: requestFetch })
            const model = provider.chat(getRoutedOpenRouterModelId("vendor/model", mode), {
                provider: routing
            })
            // Background calls rely on model settings; chat also passes call-level options.
            await generateText({ model, prompt: "Hello", maxRetries: 0 })
            await generateText({
                model,
                prompt: "Hello",
                providerOptions: { openrouter: { provider: routing } },
                maxRetries: 0
            })
            expect(requestFetch).toHaveBeenCalledTimes(2)
        }
    )

    it("does not stack routing variants or remove semantic variants", () => {
        expect(getRoutedOpenRouterModelId("vendor/model:floor", "floor")).toBe("vendor/model:floor")
        expect(getRoutedOpenRouterModelId("vendor/model:nitro", "zdr")).toBe("vendor/model")
        expect(getRoutedOpenRouterModelId("vendor/model:thinking", "floor")).toBe(
            "vendor/model:thinking:floor"
        )
    })
})
