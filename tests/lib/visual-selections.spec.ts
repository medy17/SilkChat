import { describe, expect, it } from "vitest"
import { collectVisualRequests, visualRequestKey } from "@/lib/visual-selections"
import { splitVisualContent } from "@/lib/visual-references"
import { parseRecipeBlock } from "@/lib/recipe"

describe("visual selection markup", () => {
    it("normalizes carousel groups to the existing persisted keys and preserves child labels", () => {
        const grouped =
            '<carousel mode="referential" title="Comparison">\n  <visual reference="img_b" title="Second search"></visual>\n  <visual reference="img_a" title="Earlier turn" />\n</carousel>'
        expect(splitVisualContent(grouped)).toEqual([
            {
                type: "visual",
                cue: "",
                title: "Comparison",
                refs: ["img_b", "img_a"],
                itemTitles: { img_b: "Second search", img_a: "Earlier turn" }
            }
        ])
        const [canonical] = collectVisualRequests(grouped)
        expect(visualRequestKey(canonical)).toBe('["refs","gallery",3,["img_b","img_a"]]')
        const [quick] = collectVisualRequests(
            '<carousel\n mode="quick-look"\n query="snow  leopard" title="Wildlife"\n></carousel>'
        )
        expect(visualRequestKey(quick)).toBe(
            visualRequestKey(
                collectVisualRequests('<visual title="Old heading">snow leopard</visual>')[0]
            )
        )
        expect(
            collectVisualRequests('<carousel mode="quick-look" query="snow leopard" />')
        ).toEqual([quick])
        expect(
            collectVisualRequests('<visual reference="img_a" title="Single image"></visual>')[0]
                .refs
        ).toEqual(["img_a"])
    })

    it("holds a streaming carousel as one unit and never searches its partial children", () => {
        const markup =
            '<carousel mode="referential" title="Compare">\n<visual reference="img_a"></visual>\n<visual reference="img_b"></visual>\n</carousel>'
        for (let length = 1; length < markup.length; length++) {
            expect(
                splitVisualContent(`Intro.\n${markup.slice(0, length)}`, true).filter(
                    (segment) => segment.type === "visual"
                )
            ).toEqual([])
        }
        expect(
            collectVisualRequests(
                '<carousel mode="quick-look" query="ignored">\n<visual>also ignored</visual>'
            )
        ).toEqual([])
        expect(collectVisualRequests(`~~~html\n${markup}\n~~~`)).toEqual([])
        expect(collectVisualRequests(markup)).toHaveLength(1)
    })

    it("does not turn invalid or mixed carousel modes into searches", () => {
        for (const markup of [
            '<carousel query="no implicit mode"></carousel>',
            '<carousel mode="quick-look" title="not a query"></carousel>',
            '<carousel mode="quick-look" query="ignored"><visual reference="img_a"></visual></carousel>',
            '<carousel mode="unknown"><visual>ignored</visual></carousel>',
            '<carousel mode="referential">\n<carousel mode="referential"></carousel>\n<visual>ignored</visual>\n</carousel>'
        ])
            expect(collectVisualRequests(markup)).toEqual([])
        for (const markup of [
            '<carousel mode="referential" query="ignored"><visual reference=""></visual></carousel>',
            '<carousel mode="referential"><visual>ignored</visual></carousel>',
            '<visual reference="">ignored</visual>'
        ])
            expect(collectVisualRequests(markup)[0].refs).toEqual([])
        const [request] = collectVisualRequests('<visual reference="">snow leopard</visual>')
        expect(visualRequestKey(request)).not.toBe(
            visualRequestKey({ cue: "snow leopard", limit: 3, variant: "gallery" })
        )
    })

    it("extracts recipe queries and references while skipping fenced examples", () => {
        const wrap = (step: string) =>
            `<recipe servings="2">\n# Soup\n## Ingredients\n- Lentils\n## Steps\n1. <step>Simmer. ${step}</step>\n</recipe>`
        expect(
            collectVisualRequests(
                wrap('<carousel mode="quick-look" query="simmering lentils"></carousel>')
            )
        ).toEqual(collectVisualRequests(wrap("<visual>simmering lentils</visual>")))

        const recipe =
            '<recipe servings="2" visual="lentil soup">\n# Soup\n## Ingredients\n- Lentils\n## Steps\n1. <step>Simmer. <visual reference="img_4"></visual></step>\n</recipe>'
        const requests = collectVisualRequests(
            `\`\`\`html\n<visual>ignored</visual>\n\`\`\`\n${recipe}`
        )
        expect(requests).toEqual([
            { cue: "lentil soup", variant: "gallery", limit: 3 },
            { cue: "", variant: "step", limit: 1, refs: ["img_4"] }
        ])
    })

    it("keeps the text after a self-closing quick-look carousel in a recipe step", () => {
        const recipe = parseRecipeBlock(
            '# Soup\n## Ingredients\n- Lentils\n## Steps\n1. <step>Stir. <carousel mode="quick-look" query="simmering lentils" /> Serve warm.</step>',
            'servings="2"'
        )
        expect(recipe?.steps[0].visualCue).toBe("simmering lentils")
        expect(recipe?.steps[0].raw).toBe("Stir. Serve warm.")
    })

    it("bounds standalone visuals server-side", () => {
        expect(
            collectVisualRequests(
                Array.from({ length: 20 }, (_, i) => `<visual>subject ${i}</visual>`).join("\n")
            )
        ).toHaveLength(3)
    })
})
