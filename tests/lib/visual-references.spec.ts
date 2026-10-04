import { parseBraveImageResults } from "@/lib/brave-image-search"
import { splitVisualContent } from "@/lib/visual-references"
import { describe, expect, it } from "vitest"

const result = (overrides: Record<string, unknown> = {}) => ({
    title: "Wrapping shuwa in banana leaves",
    url: "https://example.com/shuwa-recipe",
    source: "example.com",
    confidence: "high",
    properties: { url: "https://cdn.example.com/shuwa.jpg" },
    ...overrides
})

describe("visual reference search", () => {
    it("uses stricter confidence gating for step visuals", () => {
        const payload = {
            results: [
                result(),
                result({
                    title: "A loosely related dish",
                    confidence: "medium",
                    properties: { url: "https://cdn.example.com/medium.jpg" }
                }),
                result({
                    confidence: "low",
                    properties: { url: "https://cdn.example.com/low.jpg" }
                })
            ],
            extra: { might_be_offensive: false }
        }

        expect(parseBraveImageResults(payload, "step", 3)).toHaveLength(1)
        expect(parseBraveImageResults(payload, "gallery", 3)).toHaveLength(2)
        expect(parseBraveImageResults(payload, "inspect", 6)).toHaveLength(3)
    })

    it("rejects offensive results and unsafe asset or source links", () => {
        expect(
            parseBraveImageResults(
                { results: [result()], extra: { might_be_offensive: true } },
                "gallery",
                3
            )
        ).toEqual([])

        expect(
            parseBraveImageResults(
                {
                    results: [
                        result({ properties: { url: "http://cdn.example.com/image.jpg" } }),
                        result({ url: "javascript:alert(1)" })
                    ]
                },
                "gallery",
                3
            )
        ).toEqual([])
    })
})

describe("visual reference dimensions", () => {
    it("passes through reported sizes and skips images too small to show sharply", () => {
        const visuals = parseBraveImageResults(
            {
                results: [
                    result({
                        properties: {
                            url: "https://cdn.example.com/tiny.jpg",
                            width: 180,
                            height: 120
                        }
                    }),
                    result({
                        properties: {
                            url: "https://cdn.example.com/wide.jpg",
                            width: "1600",
                            height: 900
                        }
                    }),
                    result({ properties: { url: "https://cdn.example.com/unknown.jpg" } })
                ]
            },
            "gallery",
            3
        )

        expect(visuals.map(({ id, width, height }) => ({ id, width, height }))).toEqual([
            { id: "https://cdn.example.com/wide.jpg", width: 1600, height: 900 },
            { id: "https://cdn.example.com/unknown.jpg", width: undefined, height: undefined }
        ])
    })
})

describe("visual references in ordinary replies", () => {
    it.each([
        '<carousel mode="referential">\n<visual reference="img_a"></visual>\n\n## Details\nThe rest of the answer.',
        "<carousel> is a common UI pattern.\n\nMore explanation.",
        '<carousel mode="quick-look" query="unfinished'
    ])("preserves unfinished carousel text after streaming ends: %s", (tail) => {
        const content = `Intro paragraph.\n\n${tail}`
        expect(splitVisualContent(content)).toEqual([{ type: "markdown", content }])
        expect(splitVisualContent(content, true)).toEqual([
            { type: "markdown", content: "Intro paragraph.\n\n" }
        ])
    })

    it("lifts standalone visual lines out of prose but leaves inline and fenced tags alone", () => {
        expect(
            splitVisualContent(
                "Snow leopards blend into scree.\n<visual> snow   leopard </visual>\nThey hunt at dusk, see <visual>x</visual>.\n```html\n<visual>fenced</visual>\n```"
            )
        ).toEqual([
            { type: "markdown", content: "Snow leopards blend into scree.\n" },
            { type: "visual", cue: "snow leopard" },
            {
                type: "markdown",
                content:
                    "\nThey hunt at dusk, see <visual>x</visual>.\n```html\n<visual>fenced</visual>\n```"
            }
        ])
    })

    it("separates an optional card title from the search cue", () => {
        expect(
            splitVisualContent(
                '<visual title=" Beelzebufo  Was a Giant ">beelzebufo fossil</visual>\n<visual title="">snow leopard</visual>'
            )
        ).toEqual([
            { type: "visual", cue: "beelzebufo fossil", title: "Beelzebufo Was a Giant" },
            { type: "visual", cue: "snow leopard" }
        ])
    })

    it("holds back an unfinished visual line only while streaming", () => {
        expect(splitVisualContent("Intro.\n<visual>snow leo", true)).toEqual([
            { type: "markdown", content: "Intro.\n" }
        ])
        expect(splitVisualContent("Intro.\n<vis", true)).toEqual([
            { type: "markdown", content: "Intro.\n" }
        ])
        expect(splitVisualContent("Intro.\n<visual>snow leo")).toEqual([
            { type: "markdown", content: "Intro.\n<visual>snow leo" }
        ])
        expect(splitVisualContent("```html\n<visual>snow leo", true)).toEqual([
            { type: "markdown", content: "```html\n<visual>snow leo" }
        ])
    })
})
