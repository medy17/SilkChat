import { describe, expect, it } from "vitest"
import { validatePreparedImageRequest } from "../../convex/lib/image_generation/shared"
import { MODELS_SHARED } from "../../convex/lib/models"
import type { ImageResolution } from "../../convex/lib/models"
import { resolveImageSizeForModel } from "../../convex/lib/models/fal"

const resolve = (
    modelId: string,
    size: string,
    resolution?: ImageResolution,
    referenceCount = 0
) => {
    const model = MODELS_SHARED.find((candidate) => candidate.id === modelId)
    if (!model) throw new Error(`Missing shared model ${modelId}`)
    const result = resolveImageSizeForModel({ model, size, resolution, referenceCount })
    if (!result) throw new Error(`Missing fal descriptor for ${modelId}`)
    return result
}

const pixelsOf = (result: ReturnType<typeof resolve>) =>
    result.ok && result.size.kind === "pixels"
        ? {
              size: `${result.size.width}x${result.size.height}`,
              resolution: result.size.resolution
          }
        : result

describe("image size resolution", () => {
    it("keeps preset ratios on their existing sizes", () => {
        expect(pixelsOf(resolve("gpt-image-2.5-flare", "3:4", "4K"))).toEqual({
            size: "2448x3264",
            resolution: "4K"
        })
        // Equivalent ratios match the preset and keep its name.
        const doubled = resolve("gpt-image-2.5-flare", "32:18", "1K")
        expect(doubled.ok && doubled.size.canonical).toBe("16:9")
    })

    it.each([
        ["4K", "2400x3392"],
        ["2K", "1696x2400"],
        ["1K", "848x1200"]
    ] as const)("fits a free ratio to GPT Image's %s pixel budget", (resolution, expected) => {
        expect(pixelsOf(resolve("gpt-image-2.5-flare", "2480:3508", resolution))).toEqual({
            size: expected,
            resolution
        })
    })

    it("takes legal pixel sizes exactly and labels them by their pixel count", () => {
        expect(pixelsOf(resolve("gpt-image-2.5-flare", "2400x3392", "1K"))).toEqual({
            size: "2400x3392",
            resolution: "4K"
        })
        // A typed preset keeps its preset's label even when its area tops that budget.
        expect(pixelsOf(resolve("gpt-image-2.5-flare", "1568x672"))).toEqual({
            size: "1568x672",
            resolution: "1K"
        })
    })

    it("suggests a size up when the request is under the pixel floor", () => {
        expect(resolve("gpt-image-2.5-flare", "800x800")).toEqual({
            ok: false,
            reason: "It must be between 0.66 and 8.29 megapixels.",
            nearest: "816x816"
        })
        // Shapes whose long side rounds down just under the floor at one size up.
        for (const size of ["214x200", "820x619", "552x1155", "374x200", "444x200"]) {
            const result = resolve("gpt-image-2.5-flare", size)
            const nearest = !result.ok ? result.nearest : undefined
            expect(nearest, size).toBeDefined()
            expect(resolve("gpt-image-2.5-flare", nearest ?? "").ok, size).toBe(true)
        }
    })

    it("treats an unknown stored resolution as none instead of crashing", () => {
        const model = MODELS_SHARED.find((candidate) => candidate.id === "flux-2-flex")
        if (!model) throw new Error("Missing shared model flux-2-flex")
        for (const resolution of ["", "8K"]) {
            expect(
                resolveImageSizeForModel({ model, size: "16:9", resolution }),
                resolution
            ).toMatchObject({ ok: true, size: { canonical: "16:9" } })
        }
    })

    it("rejects illegal pixel sizes with the nearest legal one", () => {
        expect(resolve("gpt-image-2.5-flare", "2480x3508")).toEqual({
            ok: false,
            reason: "Width and height must be multiples of 16.",
            nearest: "2400x3392"
        })
        expect(resolve("gpt-image-2.6-flare", "2496x3520")).toMatchObject({
            ok: false,
            nearest: "2416x3408"
        })
        expect(resolve("gpt-image-2.5-flare", "4800x1600")).toMatchObject({
            ok: false,
            reason: "The longest side can be at most 3840px.",
            nearest: "3840x1280"
        })
    })

    it("rejects shapes past the 3:1 limit without suggesting a size", () => {
        expect(resolve("gpt-image-2.5-flare", "5000x100")).toEqual({
            ok: false,
            reason: "The aspect ratio can be at most 3:1."
        })
        expect(resolve("gpt-image-2.5-flare", "4:1")).toMatchObject({ ok: false })
    })

    it("limits preset-only models to their presets", () => {
        expect(resolve("gpt-5.4-image-2", "2480:3508")).toMatchObject({ ok: false })
        expect(resolve("gpt-5.4-image-2", "2400x3392")).toMatchObject({ ok: false })
        expect(resolve("flux-2-flex", "1:1").ok).toBe(true)
    })

    it("limits aspect-ratio endpoints to the model's ratio list", () => {
        const equivalent = resolve("grok-imagine-image-pro", "40:18")
        expect(equivalent.ok && equivalent.size.canonical).toBe("20:9")
        expect(resolve("grok-imagine-image-pro", "3508:2480")).toMatchObject({ ok: false })
        expect(resolve("grok-imagine-image-pro", "1024x1024")).toMatchObject({ ok: false })
    })

    it("lets auto-sizing edit endpoints ignore the size but still checks it", () => {
        const edit = resolve("gpt-5-image", "9:16", undefined, 1)
        expect(edit.ok && edit.size.kind).toBe("auto")
        expect(resolve("gpt-5-image", "21:9", undefined, 1)).toMatchObject({ ok: false })
    })

    it.each([
        ["gpt-image-2.5-flare", "2480:3508", "2K"],
        ["gpt-image-2.5-flare", "2400x3392", "1K"],
        ["gpt-image-2.5-flare", "16:9", "4K"],
        ["grok-imagine-image-pro", "40:18", "2K"]
    ] as const)(
        "resolves %s %s to a canonical size that resolves the same again",
        (modelId, size, resolution) => {
            const first = resolve(modelId, size, resolution)
            if (!first.ok) throw new Error("Expected the size to resolve")
            const again = resolve(modelId, first.size.canonical, first.size.resolution)
            expect(again).toEqual(first)
        }
    )
})

describe("unsupported sizes in requests", () => {
    it("rejects a size the model can't make before anything is reserved", () => {
        expect(() =>
            validatePreparedImageRequest({
                modelId: "gpt-image-2.5-flare",
                aspectRatio: "2480x3508",
                referenceCount: 0
            })
        ).toThrow(
            "GPT Image 2.5 Flare can't make 2480x3508. Width and height must be multiples of 16. Try 2400x3392."
        )
    })

    it("stores the resolved size and the resolution it falls in", () => {
        const validated = validatePreparedImageRequest({
            modelId: "gpt-image-2.5-flare",
            aspectRatio: "2480 : 3508",
            resolution: "4K",
            referenceCount: 0
        })

        expect(validated).toMatchObject({ aspectRatio: "2400x3392", resolution: "4K" })
    })

    it("drops an unknown resolution on a model without resolution tiers", () => {
        for (const resolution of ["", "8K"]) {
            const validated = validatePreparedImageRequest({
                modelId: "flux-2-flex",
                aspectRatio: "1:1",
                resolution,
                referenceCount: 0
            })
            expect(validated.resolution, resolution).toBeUndefined()
        }
    })
})
