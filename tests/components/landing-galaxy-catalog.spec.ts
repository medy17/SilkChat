import { buildGalaxyCatalog, resolveGalaxyLab } from "@/components/landing-page/galaxy/catalog"
import type { SharedModel } from "@/convex/lib/models"
import { describe, expect, it } from "vitest"

const model = (overrides: Partial<SharedModel> & { id: string }): SharedModel =>
    ({
        name: overrides.id,
        adapters: ["openrouter:x/y"],
        abilities: [],
        ...overrides
    }) as SharedModel

describe("resolveGalaxyLab", () => {
    it("prefers the developer, then the icon override, then the direct provider", () => {
        expect(resolveGalaxyLab(model({ id: "a", developer: "Meta", customIcon: "openai" }))).toBe(
            "meta"
        )
        expect(
            resolveGalaxyLab(model({ id: "b", customIcon: "bflabs", adapters: ["fal:x"] }))
        ).toBe("bfl")
        expect(resolveGalaxyLab(model({ id: "c", adapters: ["i3-anthropic:claude"] }))).toBe(
            "anthropic"
        )
    })

    it("leaves out labs without a brand icon", () => {
        expect(resolveGalaxyLab(model({ id: "a", developer: "Deepgram" }))).toBeNull()
        expect(
            resolveGalaxyLab(model({ id: "b", adapters: ["fal:bytedance/seedream"] }))
        ).toBeNull()
    })
})

describe("buildGalaxyCatalog", () => {
    it("drops sunset and decision models and orders labs by model count", () => {
        const catalog = buildGalaxyCatalog(
            [
                model({ id: "gpt", developer: "OpenAI" }),
                model({ id: "gpt-old", developer: "OpenAI", legacy: true }),
                model({ id: "gpt-gone", developer: "OpenAI", sunsetOn: "2026-01-01" }),
                model({ id: "router", developer: "OpenAI", mode: "decision" } as never),
                model({
                    id: "img",
                    developer: "Google",
                    mode: "image",
                    supportedImageSizes: ["1:1"]
                })
            ],
            [],
            new Date("2026-11-11")
        )

        expect(catalog.models.map((entry) => entry.id)).toEqual(["gpt", "gpt-old", "img"])
        expect(catalog.labs.map((lab) => [lab.key, lab.count, lab.outputs])).toEqual([
            ["openai", 2, ["text"]],
            ["google", 1, ["image"]]
        ])
    })

    it("adds OpenRouter's models for known labs once, after SilkChat's own", () => {
        const catalog = buildGalaxyCatalog(
            [
                model({
                    id: "opus",
                    developer: "Anthropic",
                    name: "Claude Opus 5",
                    adapters: ["openrouter:anthropic/opus-5"]
                }),
                model({
                    id: "sonnet",
                    developer: "Anthropic",
                    name: "Claude Sonnet 5",
                    adapters: ["i3-anthropic:sonnet"]
                })
            ],
            [
                { id: "anthropic/opus-5", name: "Opus by slug", outputs: ["text"] },
                { id: "anthropic/sonnet-5", name: "Claude Sonnet-5", outputs: ["text"] },
                { id: "anthropic/haiku-5", name: "Claude Haiku 5", outputs: ["text"] },
                { id: "nvidia/nemotron", name: "Nemotron", outputs: ["text"] }
            ],
            new Date("2026-11-11")
        )

        expect(catalog.models.map((entry) => [entry.id, entry.curated])).toEqual([
            ["opus", true],
            ["sonnet", true],
            ["anthropic/haiku-5", false]
        ])
        expect(catalog.labs).toMatchObject([{ key: "anthropic", count: 3 }])
    })
})
