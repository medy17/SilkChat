import {
    OG_DEMOS,
    OG_SQUARE_STRESS_DEMOS,
    SHARED_OG_QUESTION_SPEC,
    createSharedOgContent,
    createSharedThreadOgContent,
    ellipsizeOgText,
    fitOgContent,
    isOgDemo,
    isOgPreview,
    resolveSharedOgQuestion
} from "@/lib/og-content"
import { isOgFormat, renderOgImage } from "@/lib/og-image"
import {
    IMMUTABLE_OG_CACHE_CONTROL,
    NO_STORE_CACHE_CONTROL,
    createOgErrorResponse,
    renderSharedOgResponse,
    withImmutableOgCache
} from "@/lib/og-response"
import { describe, expect, it, vi } from "vitest"

const mockOgAssetFetch = () =>
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = new URL(typeof input === "string" ? input : input.toString())
        const filename = url.pathname.split("/").pop()
        if (!filename) return new Response("Not found", { status: 404 })

        const asset = await readFile(join(process.cwd(), "public", "og", filename))
        return new Response(new Uint8Array(asset))
    })

describe("isOgFormat", () => {
    it.each(["wide", "landscape", "square"])("accepts the supported %s format", (format) => {
        expect(isOgFormat(format)).toBe(true)
    })

    it.each([null, "", "portrait", "WIDE"])("rejects unsupported format %s", (format) => {
        expect(isOgFormat(format)).toBe(false)
    })
})

describe("OG route demos", () => {
    it.each(["home", "about", "personas", "shared"])("recognizes the supported %s demo", (demo) => {
        expect(isOgDemo(demo)).toBe(true)
    })

    it("keeps every demo personal and title-first", () => {
        for (const demo of Object.values(OG_DEMOS)) {
            expect(demo.title).toMatch(/[?.]$/)
            expect(demo.supportingText).toMatch(/SilkChat|Ahmed|Socrates|Seraphine/)
        }
    })

    it("recognizes the long-copy previews without treating arbitrary values as demos", () => {
        expect(isOgPreview("shared-long-question")).toBe(true)
        expect(isOgPreview("shared-long-name")).toBe(true)
        expect(isOgPreview("anything")).toBe(false)
    })
})

describe("OG copy fitting", () => {
    it("ellipsizes at a useful word boundary", () => {
        const result = ellipsizeOgText(
            "A deliberately long question that should never be cut halfway through a word",
            45
        )

        expect(result).toMatch(/…$/)
        expect(result.length).toBeLessThanOrEqual(45)
        expect(result).not.toMatch(/half…$/)
    })

    it("shortens only the sharer name while keeping the personal attribution", () => {
        const content = createSharedOgContent({
            id: "long-name",
            question: "What makes a star shimmer",
            sharerName: "Alexandria-Cassandra Montgomery-Worthington"
        })

        expect(content.title).toBe("What makes a star shimmer?")
        expect(content.supportingText).toBe(
            "Alexandria-Cassandra… shared this conversation with you."
        )
    })

    it("uses a friendly anonymous fallback when no sharer name is available", () => {
        const content = createSharedOgContent({
            id: "anonymous",
            question: "Could this work",
            sharerName: "   "
        })

        expect(content.supportingText).toBe("Someone shared this conversation with you.")
    })

    it("gives square cards larger type and bounded copy", () => {
        const fitted = fitOgContent(OG_SQUARE_STRESS_DEMOS[0], "square")

        expect(fitted.title).toMatch(/…$/)
        expect(fitted.title.length).toBeLessThanOrEqual(92)
        expect(fitted.titleSize).toBeGreaterThan(fitted.supportingSize)
        expect(fitted.titleSize).toBeGreaterThan(72)
    })

    it("wraps curated route copy without clipping it to dynamic-content limits", () => {
        for (const demo of [OG_DEMOS.home, OG_DEMOS.about, OG_DEMOS.personas]) {
            const fitted = fitOgContent(demo, "wide")

            expect(fitted.title).toBe(demo.title)
            expect(fitted.supportingText).toBe(demo.supportingText)
        }
    })

    it("defines a concise, question-only generation contract", () => {
        expect(SHARED_OG_QUESTION_SPEC).toMatchObject({
            minWords: 4,
            maxWords: 10,
            maxGraphemes: 72
        })
        expect(SHARED_OG_QUESTION_SPEC.instructions.join(" ")).toContain("Return only the question")
    })

    it("prefers saved questions and gives legacy shares a deterministic fallback", () => {
        expect(
            resolveSharedOgQuestion({
                shareQuestion: "Why do stars shimmer?",
                title: "Ignored legacy title"
            })
        ).toBe("Why do stars shimmer?")

        expect(
            resolveSharedOgQuestion({
                title: "Atmospheric Starlight",
                messages: [
                    {
                        role: "user",
                        parts: [{ type: "text", text: "Why does starlight seem to move?" }]
                    }
                ]
            })
        ).toBe("Why does starlight seem to move?")

        expect(
            resolveSharedOgQuestion({
                title: "Atmospheric Starlight",
                messages: [
                    {
                        role: "user",
                        parts: [{ type: "text", text: "Explain atmospheric turbulence" }]
                    }
                ]
            })
        ).toBe("What should we know about Atmospheric Starlight?")

        expect(resolveSharedOgQuestion({ title: "New Chat", messages: [] })).toBeNull()
    })

    it("builds dynamic shared-card copy from the persisted snapshot", () => {
        expect(
            createSharedThreadOgContent({
                id: "shared-1",
                shareQuestion: "Why do stars shimmer?",
                sharerName: "Ahmed",
                title: "Ignored title",
                messages: []
            })
        ).toMatchObject({
            id: "shared-1",
            title: "Why do stars shimmer?",
            supportingText: "Ahmed shared this conversation with you."
        })

        expect(
            createSharedThreadOgContent({ id: "legacy-empty", title: "New Chat", messages: [] })
        ).toBeNull()
    })
})

describe("renderOgImage", () => {
    it("returns a PNG response for the default social-card format", async () => {
        const fetchSpy = mockOgAssetFetch()
        const response = await renderOgImage("wide", undefined, "https://assets.test")
        const bytes = new Uint8Array(await response.arrayBuffer())

        expect(response.status).toBe(200)
        expect(response.headers.get("content-type")).toBe("image/png")
        expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
        fetchSpy.mockRestore()
    })

    it("renders arbitrary dynamic text using only fixed deployment assets", async () => {
        const fetchSpy = mockOgAssetFetch()

        const response = await renderOgImage(
            "wide",
            createSharedOgContent({
                id: "dynamic",
                question: "Could every shared question be unique",
                sharerName: "A different person"
            }),
            "https://assets.test"
        )

        expect(response.status).toBe(200)
        const fetchedUrls = fetchSpy.mock.calls.map(
            ([input]) => new URL(typeof input === "string" ? input : input.toString())
        )
        expect(fetchedUrls.map((url) => url.pathname).sort()).toEqual([
            "/og/geist-500.ttf",
            "/og/geist-700.ttf"
        ])
        expect(fetchedUrls.every((url) => url.search === "")).toBe(true)
        fetchSpy.mockRestore()
    })
})

describe("OG response caching", () => {
    it("makes backend and lookup failures explicitly non-cacheable", () => {
        for (const status of [400, 404, 503] as const) {
            const response = createOgErrorResponse("Unavailable", status)

            expect(response.status).toBe(status)
            expect(response.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL)
        }
    })

    it("adds immutable caching only when a card rendered successfully", () => {
        const response = withImmutableOgCache(new Response("png"))

        expect(response.headers.get("cache-control")).toBe(IMMUTABLE_OG_CACHE_CONTROL)
    })

    it("never renders a generic card when shared-thread lookup fails", async () => {
        const render = vi.fn(async () => new Response("png"))

        const response = await renderSharedOgResponse({
            sharedThreadId: "shared-1",
            load: async () => ({ status: "unavailable" }),
            render
        })

        expect(response.status).toBe(503)
        expect(response.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL)
        expect(render).not.toHaveBeenCalled()
    })
})
import { readFile } from "node:fs/promises"
import { join } from "node:path"
