import { describe, expect, it } from "vitest"

import { findEntryByOpenRouterSlug } from "@/lib/model-benchmark-matching"

const dataset = [
    { slug: "glm-5-3", name: "GLM-5.3 (Max)" },
    { slug: "orbit-2", name: "Orbit 2 (Non-reasoning)" },
    { slug: "orbit-2-reasoning", name: "Orbit 2 (Reasoning)" },
    { slug: "nova-v4-pro", name: "Nova V4 Pro 0813 (Max)" },
    { slug: "quill-8-max", name: "Quill 8 Max (0902)" },
    { slug: "gemma-5-31b", name: "Gemma 5 31B" }
]

const match = (slug: string, reasoning = false) =>
    findEntryByOpenRouterSlug(slug, dataset, { reasoning })?.slug ?? null

describe("findEntryByOpenRouterSlug", () => {
    it("maps the OpenRouter model part to the slug with dots as hyphens", () => {
        expect(match("z-ai/glm-5.3")).toBe("glm-5-3")
    })

    it("ignores OpenRouter variant suffixes and instruction-tuned or preview markers", () => {
        expect(match("z-ai/glm-5.3:free")).toBe("glm-5-3")
        expect(match("google/gemma-5-31b-it")).toBe("gemma-5-31b")
    })

    it("prefers the reasoning run only for reasoning-capable models", () => {
        expect(match("acme/orbit-2", true)).toBe("orbit-2-reasoning")
        expect(match("acme/orbit-2", false)).toBe("orbit-2")
    })

    it("matches dated checkpoints by the name when the slug drops the date", () => {
        expect(match("nova/nova-v4-pro-0813")).toBe("nova-v4-pro")
        expect(match("quill/quill-8-max-0902")).toBe("quill-8-max")
    })

    it("returns null instead of guessing when nothing matches", () => {
        expect(match("acme/unknown-model")).toBeNull()
        expect(match("nova/nova-v4-pro-0424")).toBeNull()
    })
})
