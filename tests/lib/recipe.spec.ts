import {
    formatRecipeQuantity,
    formatScaledQuantity,
    parseIsoDurationSeconds,
    parseRecipeBlock,
    parseRecipeInline,
    splitRecipeContent
} from "@/lib/recipe"
import { convertUnit, identifyUnit } from "parse-ingredient"
import { describe, expect, it } from "vitest"

describe("native recipe parsing", () => {
    it("captures complete and streaming recipe blocks without losing surrounding markdown", () => {
        const complete = splitRecipeContent(
            'Before\n<recipe servings="2">\n# Soup\n</recipe>\nAfter'
        )
        const streaming = splitRecipeContent('<recipe servings="2">\n# Soup\n## Ingredients')

        expect(complete).toEqual([
            { type: "markdown", content: "Before\n" },
            { type: "recipe", content: "\n# Soup\n", openingAttributes: ' servings="2"' },
            { type: "markdown", content: "\nAfter" }
        ])
        expect(streaming).toEqual([
            {
                type: "recipe",
                content: "\n# Soup\n## Ingredients",
                openingAttributes: ' servings="2"'
            }
        ])

        const fenced = '```xml\n<recipe servings="2">\n# Soup\n</recipe>\n```'
        expect(splitRecipeContent(fenced)).toEqual([{ type: "markdown", content: fenced }])
    })

    it("uses structural tags so visible section headings can be localized freely", () => {
        const recipe = parseRecipeBlock(`
# Kartoffelsuppe
<description>Eine kurze, wärmende Kartoffelsuppe.</description>
<ingredients>
## Zutaten
- <qty value="500" unit="g" scale>500 g</qty> Kartoffeln
- Salz nach Geschmack
</ingredients>
<steps>
## Zubereitung
1. <step>Alles für <timer value="PT20M">20 Minuten</timer> köcheln lassen.</step>
</steps>
<notes>
## Hinweise
Warm servieren.
</notes>
`)

        expect(recipe).toMatchObject({
            title: "Kartoffelsuppe",
            description: "Eine kurze, wärmende Kartoffelsuppe.",
            ingredients: [
                { raw: expect.stringContaining("Kartoffeln") },
                { raw: "Salz nach Geschmack" }
            ],
            steps: [{ raw: expect.stringContaining("köcheln lassen") }],
            notes: "Warm servieren."
        })
        expect(recipe?.ingredients[0]?.group).toBeUndefined()
    })

    it("parses localized sections while keeping canonical quantities and timers", () => {
        const recipe = parseRecipeBlock(
            `
# 基本の煮物

## 材料
- <qty value="3" unit="count" scale>3個</qty> じゃがいも
- サラダ油 適量

## 手順
1. <qty value="3" unit="count" scale>3個</qty>を弱火で<timer value="PT15M">15分</timer>煮ます。
`,
            ' servings="2"'
        )

        expect(recipe?.title).toBe("基本の煮物")
        expect(recipe?.servings).toBe(2)
        expect(recipe?.ingredients).toHaveLength(2)
        expect(recipe?.steps).toHaveLength(1)
        expect(recipe?.ingredients[0]?.tokens).toContainEqual({
            type: "quantity",
            display: "3個",
            value: 3,
            unit: "count",
            scalable: true
        })
        expect(recipe?.steps[0]?.tokens).toContainEqual({
            type: "timer",
            display: "15分",
            durationSeconds: 900
        })
    })

    it("prefers explicit multiline step boundaries over Markdown numbering", () => {
        const recipe = parseRecipeBlock(`
# Soup
## Ingredients
- <qty value="1" unit="l" scale>1 l</qty> stock
## Steps
1. <step>Bring the stock to a boil.
Then reduce the heat for <timer value="PT8M">8 minutes</timer>.</step>
2. <step>Serve immediately.</step>
`)

        expect(recipe?.steps).toHaveLength(2)
        expect(recipe?.steps[0]?.raw).toBe(
            'Bring the stock to a boil. Then reduce the heat for <timer value="PT8M">8 minutes</timer>.'
        )
        expect(recipe?.steps[0]?.tokens).toContainEqual({
            type: "timer",
            display: "8 minutes",
            durationSeconds: 480
        })
    })

    it("captures optional recipe and step visual cues without showing them as instructions", () => {
        const recipe = parseRecipeBlock(
            `
# Omani Shuwa
## Ingredients
- <qty value="1" unit="kg" scale>1 kg</qty> lamb
## Steps
1. <step>Wrap the seasoned lamb securely.
<visual>wrapping Omani shuwa lamb in banana leaves</visual></step>
2. <step>Cook until tender.</step>
`,
            ' servings="4" visual="finished Omani shuwa lamb platter"'
        )

        expect(recipe?.visualCue).toBe("finished Omani shuwa lamb platter")
        expect(recipe?.steps[0]).toMatchObject({
            raw: "Wrap the seasoned lamb securely.",
            visualCue: "wrapping Omani shuwa lamb in banana leaves"
        })
        expect(recipe?.steps[0]?.tokens).toEqual([
            { type: "text", text: "Wrap the seasoned lamb securely." }
        ])
        expect(recipe?.steps[1]?.visualCue).toBeUndefined()
    })

    it("caps visual searches at three per recipe", () => {
        const recipe = parseRecipeBlock(
            `
# Soup
## Ingredients
- stock
## Steps
1. <step>First. <visual>first soup action</visual></step>
2. <step>Second. <visual>second soup action</visual></step>
3. <step>Third. <visual>third soup action</visual></step>
`,
            ' visual="finished soup bowl"'
        )

        expect(recipe?.visualCue).toBe("finished soup bowl")
        expect(recipe?.steps.map((step) => step.visualCue)).toEqual([
            "first soup action",
            "second soup action",
            undefined
        ])
    })

    it("degrades malformed or unknown inline fields to their readable text", () => {
        const tokens = parseRecipeInline(
            'Use <qty value="2" unit="barrel" scale>2 barrels</qty> and <timer value="soon">a while</timer>.'
        )

        expect(tokens).toEqual([
            { type: "text", text: "Use " },
            { type: "text", text: "2 barrels" },
            { type: "text", text: " and " },
            { type: "text", text: "a while" },
            { type: "text", text: "." }
        ])
    })

    it("scales only opted-in quantities and preserves unfamiliar localized display text", () => {
        const [scalable, fixed, words] = [
            parseRecipeInline('<qty value="1.5" unit="cup-us" scale>1½ US cups</qty>')[0],
            parseRecipeInline('<qty value="180" unit="g">180 g</qty>')[0],
            parseRecipeInline('<qty value="2.5" unit="count" scale>كوبان ونصف</qty>')[0]
        ]

        expect(scalable?.type).toBe("quantity")
        expect(fixed?.type).toBe("quantity")
        expect(words?.type).toBe("quantity")
        if (
            scalable?.type !== "quantity" ||
            fixed?.type !== "quantity" ||
            words?.type !== "quantity"
        ) {
            throw new Error("Expected quantity tokens")
        }

        expect(formatScaledQuantity(scalable, 2)).toBe("3 US cups")
        expect(formatScaledQuantity(fixed, 2)).toBe("180 g")
        expect(formatScaledQuantity(words, 2)).toBe("كوبان ونصف ×2")
    })

    it("accepts bounded ISO clock durations only", () => {
        expect(parseIsoDurationSeconds("PT45S")).toBe(45)
        expect(parseIsoDurationSeconds("PT1H30M")).toBe(5400)
        expect(parseIsoDurationSeconds("overnight")).toBeNull()
        expect(parseIsoDurationSeconds("PT0S")).toBeNull()
    })

    it("formats adjusted quantities as decimals rather than generating fractions", () => {
        const quantity = parseRecipeInline('<qty value="1" unit="tbsp" scale>1 tbsp</qty>')[0]
        if (quantity?.type !== "quantity") throw new Error("Expected a quantity token")

        expect(formatScaledQuantity(quantity, 1.5)).toBe("1.5 tbsp")
    })

    it("converts recognized dimensions without converting count expressions", () => {
        const grams = parseRecipeInline('<qty value="454" unit="g" scale>454 g</qty>')[0]
        const heaped = parseRecipeInline('<qty value="1" unit="count" scale>1 heaped tsp</qty>')[0]
        if (grams?.type !== "quantity" || heaped?.type !== "quantity") {
            throw new Error("Expected quantity tokens")
        }

        expect(formatRecipeQuantity(grams, 1, "imperial")).toBe("1 lb")
        expect(formatRecipeQuantity(heaped, 2, "metric")).toBe("2 heaped tsp")
    })

    it("converts explicit regional culinary volumes", () => {
        const australianTablespoon = parseRecipeInline(
            '<qty value="1" unit="tbsp-au" scale>1 Australian tbsp</qty>'
        )[0]
        const imperialGallon = parseRecipeInline(
            '<qty value="1" unit="gallon-imperial" scale>1 imperial gallon</qty>'
        )[0]
        if (australianTablespoon?.type !== "quantity" || imperialGallon?.type !== "quantity") {
            throw new Error("Expected quantity tokens")
        }

        expect(formatRecipeQuantity(australianTablespoon, 1, "metric")).toBe("20 ml")
        expect(formatRecipeQuantity(imperialGallon, 1, "metric")).toBe("4.55 l")
    })

    it("gets special culinary units from the patched conversion library", () => {
        expect(identifyUnit("tbsp-au")).toBe("australian tablespoon")
        expect(identifyUnit("cup-imperial")).toBe("cup")
        expect(identifyUnit("fl-oz-us")).toBe("fluid ounce")
        expect(convertUnit(1, "australian tablespoon", "milliliter")).toBe(20)
        expect(convertUnit(1, "japanese cup", "milliliter")).toBe(200)
        expect(convertUnit(1, "stone", "kilogram")).toBeCloseTo(6.35029318)
    })
})
