import { type UnitSystem, convertUnit } from "parse-ingredient"

export const RECIPE_UNITS = [
    "mcg",
    "mg",
    "g",
    "kg",
    "stone",
    "ml",
    "cl",
    "dl",
    "l",
    "oz",
    "lb",
    "fl-oz",
    "fl-oz-us",
    "fl-oz-imperial",
    "tsp",
    "tbsp",
    "tbsp-au",
    "dsp",
    "cup-us",
    "cup-metric",
    "cup-imperial",
    "cup-jp",
    "pint-us",
    "pint-imperial",
    "quart-us",
    "quart-imperial",
    "gallon-us",
    "gallon-imperial",
    "count"
] as const

export type RecipeUnit = (typeof RECIPE_UNITS)[number]
export type RecipeMeasurementSystem = "metric" | "imperial"

export type RecipeInlineToken =
    | { type: "text"; text: string }
    | {
          type: "quantity"
          display: string
          value: number
          unit: RecipeUnit
          scalable: boolean
      }
    | { type: "timer"; display: string; durationSeconds: number }

export type RecipeIngredient = {
    group?: string
    raw: string
    tokens: RecipeInlineToken[]
}

export type RecipeStep = {
    raw: string
    tokens: RecipeInlineToken[]
    visualCue?: string
}

export type ParsedRecipe = {
    title: string
    description?: string
    visualCue?: string
    servings: number
    ingredients: RecipeIngredient[]
    steps: RecipeStep[]
    notes?: string
    raw: string
}

export type RecipeContentSegment =
    | { type: "markdown"; content: string }
    | { type: "recipe"; content: string; openingAttributes: string }

const ATTRIBUTE_PATTERN = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
const INLINE_TAG_PATTERN = /<(qty|timer)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi
const STEP_TAG_PATTERN = /<step\b[^>]*>([\s\S]*?)<\/step\s*>/gi
const VISUAL_TAG_PATTERN = /<visual\b[^>]*>([\s\S]*?)<\/visual\s*>/gi
const DESCRIPTION_TAG_PATTERN = /<description\b[^>]*>([\s\S]*?)<\/description\s*>/i
const SECTION_TAG_PATTERN = /^<(\/)?(ingredients|steps|notes)\s*>$/i
const NUMBER_TOKEN_PATTERN = /(?:\d+\s+)?\d+(?:[.,]\d+)?(?:\/\d+)?[¼½¾⅓⅔⅛⅜⅝⅞]?|[¼½¾⅓⅔⅛⅜⅝⅞]/u
const MAX_RECIPE_VISUAL_SEARCHES = 3

const INGREDIENT_HEADINGS = new Set([
    "ingredient",
    "ingredients",
    "ingredientes",
    "ingrédients",
    "材料",
    "सामग्री",
    "المكونات",
    "المقادير"
])

const STEP_HEADINGS = new Set([
    "step",
    "steps",
    "method",
    "directions",
    "instructions",
    "preparation",
    "préparation",
    "preparación",
    "手順",
    "作り方",
    "अनुदेश",
    "विधि",
    "طريقة التحضير",
    "طريقة عمل"
])

const NOTE_HEADINGS = new Set([
    "note",
    "notes",
    "tips",
    "conseils",
    "notas",
    "コツ・ポイント",
    "टिप्पणियाँ",
    "ملاحظات"
])

const normalizeHeading = (value: string) =>
    value
        .trim()
        .toLocaleLowerCase()
        .replace(/[：:]$/, "")

export const parseTagAttributes = (source: string) => {
    const attributes: Record<string, string | true> = {}

    for (const match of source.matchAll(ATTRIBUTE_PATTERN)) {
        const name = match[1]?.toLocaleLowerCase()
        if (!name) continue
        attributes[name] = match[2] ?? match[3] ?? match[4] ?? true
    }

    return attributes
}

const isRecipeUnit = (value: unknown): value is RecipeUnit =>
    typeof value === "string" && RECIPE_UNITS.includes(value as RecipeUnit)

export const parseIsoDurationSeconds = (value: unknown) => {
    if (typeof value !== "string") return null
    const match = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(
        value.trim()
    )
    if (!match || (!match[1] && !match[2] && !match[3])) return null

    const seconds =
        Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)
    return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : null
}

export const parseRecipeInline = (source: string): RecipeInlineToken[] => {
    const tokens: RecipeInlineToken[] = []
    let cursor = 0

    for (const match of source.matchAll(INLINE_TAG_PATTERN)) {
        const index = match.index ?? 0
        if (index > cursor) tokens.push({ type: "text", text: source.slice(cursor, index) })

        const tag = match[1]?.toLocaleLowerCase()
        const attributes = parseTagAttributes(match[2] ?? "")
        const display = match[3]?.trim() ?? ""

        if (tag === "qty") {
            const value = Number(attributes.value)
            const unit = attributes.unit
            if (Number.isFinite(value) && value >= 0 && isRecipeUnit(unit) && display) {
                tokens.push({
                    type: "quantity",
                    display,
                    value,
                    unit,
                    scalable: attributes.scale === true || attributes.scale === "true"
                })
            } else {
                tokens.push({ type: "text", text: display || match[0] })
            }
        } else {
            const durationSeconds = parseIsoDurationSeconds(attributes.value)
            if (durationSeconds && display) {
                tokens.push({ type: "timer", display, durationSeconds })
            } else {
                tokens.push({ type: "text", text: display || match[0] })
            }
        }

        cursor = index + match[0].length
    }

    if (cursor < source.length) tokens.push({ type: "text", text: source.slice(cursor) })
    return tokens.length > 0 ? tokens : [{ type: "text", text: source }]
}

const maskMarkdownFences = (content: string) => {
    let activeFence: { marker: "`" | "~"; length: number } | undefined

    return content
        .split(/(?<=\n)/)
        .map((line) => {
            const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line)
            const wasInsideFence = Boolean(activeFence)

            if (!activeFence && opening?.[1]) {
                activeFence = {
                    marker: opening[1][0] as "`" | "~",
                    length: opening[1].length
                }
            } else if (activeFence) {
                const trimmed = line.trimStart()
                const markerRun = trimmed.match(/^[`~]+/)?.[0]
                if (
                    markerRun?.[0] === activeFence.marker &&
                    markerRun.length >= activeFence.length &&
                    trimmed.slice(markerRun.length).trim() === ""
                ) {
                    activeFence = undefined
                }
            }

            return wasInsideFence || opening ? line.replace(/[^\r\n]/g, " ") : line
        })
        .join("")
}

export const splitRecipeContent = (content: string): RecipeContentSegment[] => {
    const searchableContent = maskMarkdownFences(content)
    const segments: RecipeContentSegment[] = []
    const lower = searchableContent.toLocaleLowerCase()
    const openingPattern = /<recipe\b([^>]*)>/gi
    let cursor = 0

    for (;;) {
        openingPattern.lastIndex = cursor
        const opening = openingPattern.exec(searchableContent)
        if (!opening) break

        if ((opening.index ?? 0) > cursor) {
            segments.push({
                type: "markdown",
                content: content.slice(cursor, opening.index)
            })
        }

        const bodyStart = openingPattern.lastIndex
        const closingIndex = lower.indexOf("</recipe>", bodyStart)
        const bodyEnd = closingIndex >= 0 ? closingIndex : content.length
        segments.push({
            type: "recipe",
            content: content.slice(bodyStart, bodyEnd),
            openingAttributes: opening[1] ?? ""
        })
        cursor = closingIndex >= 0 ? closingIndex + "</recipe>".length : content.length
        if (closingIndex < 0) break
    }

    if (cursor < content.length) {
        segments.push({ type: "markdown", content: content.slice(cursor) })
    }
    if (segments.length === 0) return [{ type: "markdown", content }]
    return segments.filter((segment) => segment.content.length > 0)
}

const stripInlineMarkup = (value: string) =>
    value
        .replace(/<\/?(?:qty|timer|step|visual|description)\b[^>]*>/gi, "")
        .replace(/\*\*|__/g, "")
        .trim()

const stripStepMarkup = (value: string) => value.replace(/<\/?step\b[^>]*>/gi, "").trim()

const normalizeVisualCue = (value: unknown) => {
    if (typeof value !== "string") return undefined
    const cue = stripInlineMarkup(value).replace(/\s+/g, " ").trim().slice(0, 160)
    return cue || undefined
}

const parseRecipeStep = (source: string): RecipeStep => {
    let visualCue: string | undefined
    const raw = source
        .replace(VISUAL_TAG_PATTERN, (_match, cue: string) => {
            visualCue ??= normalizeVisualCue(cue)
            return ""
        })
        .replace(/\s+/g, " ")
        .trim()

    return { raw, tokens: parseRecipeInline(raw), visualCue }
}

const parseTaggedSteps = (source: string): RecipeStep[] =>
    [...source.matchAll(STEP_TAG_PATTERN)]
        .map((match) => match[1]?.replace(/\s+/g, " ").trim() ?? "")
        .filter(Boolean)
        .map(parseRecipeStep)

export const parseRecipeBlock = (body: string, openingAttributes = ""): ParsedRecipe | null => {
    const attributes = parseTagAttributes(openingAttributes)
    const parsedServings = Number(attributes.servings)
    const servings = Number.isFinite(parsedServings) && parsedServings > 0 ? parsedServings : 1
    const visualCue = normalizeVisualCue(attributes.visual)
    const descriptionMatch = DESCRIPTION_TAG_PATTERN.exec(body)
    const explicitDescription = descriptionMatch?.[1]
        ? stripInlineMarkup(descriptionMatch[1].replace(/\s+/g, " "))
        : undefined
    const parseableBody = descriptionMatch ? body.replace(descriptionMatch[0], "") : body
    const lines = parseableBody.replace(/\r\n?/g, "\n").split("\n")
    let title = "Recipe"
    let section: "intro" | "ingredients" | "steps" | "notes" = "intro"
    let structuralSection: "ingredients" | "steps" | "notes" | undefined
    let ingredientGroup: string | undefined
    const intro: string[] = []
    const ingredients: RecipeIngredient[] = []
    const steps: RecipeStep[] = []
    const stepSectionLines: string[] = []
    const notes: string[] = []

    for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue

        const sectionTag = SECTION_TAG_PATTERN.exec(line)
        if (sectionTag?.[2]) {
            if (sectionTag[1]) {
                structuralSection = undefined
                section = "intro"
            } else {
                structuralSection = sectionTag[2].toLocaleLowerCase() as
                    | "ingredients"
                    | "steps"
                    | "notes"
                section = structuralSection
                if (section === "ingredients") ingredientGroup = undefined
            }
            continue
        }

        const heading = /^(#{1,6})\s+(.+)$/.exec(line)
        if (heading) {
            const level = heading[1]?.length ?? 1
            const headingText = stripInlineMarkup(heading[2] ?? "")
            const normalized = normalizeHeading(headingText)

            if (level === 1 && title === "Recipe") {
                title = headingText
                continue
            }
            if (structuralSection && level <= 2) continue
            if (INGREDIENT_HEADINGS.has(normalized)) {
                section = "ingredients"
                ingredientGroup = undefined
                continue
            }
            if (STEP_HEADINGS.has(normalized)) {
                section = "steps"
                continue
            }
            if (NOTE_HEADINGS.has(normalized)) {
                section = "notes"
                continue
            }
            if (section === "ingredients") {
                ingredientGroup = headingText
                continue
            }
        }

        if (section === "ingredients") {
            const item = /^[-*+]\s+(.+)$/.exec(line)
            if (item?.[1]) {
                ingredients.push({
                    group: ingredientGroup,
                    raw: item[1],
                    tokens: parseRecipeInline(item[1])
                })
            } else if (ingredients.length > 0) {
                const current = ingredients[ingredients.length - 1]
                current.raw += ` ${line}`
                current.tokens = parseRecipeInline(current.raw)
            }
            continue
        }

        if (section === "steps") {
            stepSectionLines.push(rawLine)
            const item = /^(?:\d+[.)]|[-*+])\s+(.+)$/.exec(line)
            if (item?.[1]) {
                steps.push(parseRecipeStep(stripStepMarkup(item[1])))
            } else if (steps.length > 0) {
                const current = steps[steps.length - 1]
                const continued = parseRecipeStep(stripStepMarkup(`${current.raw} ${line}`))
                Object.assign(current, {
                    ...continued,
                    visualCue: current.visualCue ?? continued.visualCue
                })
            }
            continue
        }

        if (section === "notes") notes.push(line.replace(/^[-*+]\s+/, ""))
        else intro.push(line)
    }

    const taggedSteps = parseTaggedSteps(stepSectionLines.join("\n"))
    const resolvedSteps = taggedSteps.length >= steps.length ? taggedSteps : steps
    const stepVisualLimit = Math.max(0, MAX_RECIPE_VISUAL_SEARCHES - (visualCue ? 1 : 0))
    let stepVisualCount = 0
    const limitedSteps = resolvedSteps.map((step) => {
        if (!step.visualCue) return step
        stepVisualCount += 1
        return stepVisualCount <= stepVisualLimit ? step : { ...step, visualCue: undefined }
    })

    if (ingredients.length === 0 && limitedSteps.length === 0) return null

    return {
        title,
        description:
            explicitDescription ??
            (intro.length > 0 ? stripInlineMarkup(intro.join(" ")) : undefined),
        visualCue,
        servings,
        ingredients,
        steps: limitedSteps,
        notes: notes.length > 0 ? stripInlineMarkup(notes.join(" ")) : undefined,
        raw: body
    }
}

export const formatRecipeNumber = (value: number) => {
    const roundedInteger = Math.round(value)
    if (Math.abs(value - roundedInteger) < 0.001) return String(roundedInteger)
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
}

export const formatScaledQuantity = (
    token: Extract<RecipeInlineToken, { type: "quantity" }>,
    multiplier: number
) => {
    if (!token.scalable || multiplier === 1) return token.display
    const scaled = formatRecipeNumber(token.value * multiplier)
    if (NUMBER_TOKEN_PATTERN.test(token.display))
        return token.display.replace(NUMBER_TOKEN_PATTERN, scaled)
    return `${token.display} ×${formatRecipeNumber(multiplier)}`
}

const getRecipeConversionSystem = (unit: RecipeUnit): UnitSystem => {
    if (unit.endsWith("-imperial") || unit === "stone") return "imperial"
    if (unit.endsWith("-us") || ["oz", "lb", "fl-oz"].includes(unit)) return "us"
    return "metric"
}

const convertRecipeUnit = (
    value: number,
    fromUnit: RecipeUnit,
    toUnit: string,
    toSystem: UnitSystem
) =>
    convertUnit(value, fromUnit, toUnit, {
        fromSystem: getRecipeConversionSystem(fromUnit),
        toSystem
    })

export const getRecipeUnitSystem = (unit: RecipeUnit): RecipeMeasurementSystem | null => {
    if (["mcg", "mg", "g", "kg", "ml", "cl", "dl", "l", "cup-metric", "cup-jp"].includes(unit)) {
        return "metric"
    }
    if (
        [
            "stone",
            "oz",
            "lb",
            "fl-oz",
            "fl-oz-us",
            "fl-oz-imperial",
            "tsp",
            "tbsp",
            "tbsp-au",
            "dsp",
            "cup-us",
            "cup-imperial",
            "pint-us",
            "pint-imperial",
            "quart-us",
            "quart-imperial",
            "gallon-us",
            "gallon-imperial"
        ].includes(unit)
    ) {
        return "imperial"
    }
    return null
}

type ConvertedRecipeQuantity = [value: number, label: string]

const chooseMetricMass = (grams: number): ConvertedRecipeQuantity => {
    const kilograms = convertRecipeUnit(grams, "g", "kilogram", "metric")
    if (kilograms !== null && kilograms >= 1) return [kilograms, "kg"]
    const milligrams = convertRecipeUnit(grams, "g", "milligram", "metric")
    if (milligrams !== null && grams < 1) return [milligrams, "mg"]
    return [grams, "g"]
}

const chooseImperialMass = (grams: number): ConvertedRecipeQuantity | null => {
    const pounds = convertRecipeUnit(grams, "g", "pound", "us")
    const ounces = convertRecipeUnit(grams, "g", "ounce", "us")
    if (pounds === null || ounces === null) return null
    return pounds >= 1 ? [pounds, "lb"] : [ounces, "oz"]
}

const chooseMetricVolume = (milliliters: number): ConvertedRecipeQuantity => {
    const liters = convertRecipeUnit(milliliters, "ml", "liter", "metric")
    return liters !== null && liters >= 1 ? [liters, "l"] : [milliliters, "ml"]
}

const chooseImperialVolume = (milliliters: number): ConvertedRecipeQuantity | null => {
    const candidates: Array<[unit: string, label: string]> = [
        ["cup", "US cups"],
        ["fluid ounce", "US fl oz"],
        ["tablespoon", "tbsp"],
        ["teaspoon", "tsp"]
    ]

    for (const [target, label] of candidates) {
        const converted = convertRecipeUnit(milliliters, "ml", target, "us")
        if (converted !== null && (converted >= 1 || target === "teaspoon")) {
            return [converted, label]
        }
    }
    return null
}

export const formatRecipeQuantity = (
    token: Extract<RecipeInlineToken, { type: "quantity" }>,
    multiplier: number,
    system?: RecipeMeasurementSystem
) => {
    if (!system || token.unit === "count" || getRecipeUnitSystem(token.unit) === system) {
        return formatScaledQuantity(token, multiplier)
    }

    const value = token.value * (token.scalable ? multiplier : 1)
    let converted: ConvertedRecipeQuantity | null = null

    const grams = convertRecipeUnit(value, token.unit, "gram", "metric")
    if (grams !== null) {
        converted = system === "metric" ? chooseMetricMass(grams) : chooseImperialMass(grams)
    } else {
        const milliliters = convertRecipeUnit(value, token.unit, "milliliter", "metric")
        if (milliliters === null) return formatScaledQuantity(token, multiplier)
        converted =
            system === "metric"
                ? chooseMetricVolume(milliliters)
                : chooseImperialVolume(milliliters)
    }

    if (!converted) return formatScaledQuantity(token, multiplier)
    return `${formatRecipeNumber(converted[0])} ${converted[1]}`
}
