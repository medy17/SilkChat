/**
 * Live audit for the house rule in AGENTS.md: use theme radius/colour tokens, never
 * hardcode. We detect the clear-cut offenders — Tailwind arbitrary-value utilities whose
 * bracket contains a literal instead of a `var(--…)` token — from class strings and inline
 * styles. Token-based arbitrary values (e.g. `rounded-[var(--radius-md)]`) are allowed.
 */

export type ThemeViolationKind = "radius" | "color"

export type ThemeViolation = {
    kind: ThemeViolationKind
    /** The offending utility or inline declaration, for display. */
    value: string
}

const ARBITRARY_UTILITY = /([a-zA-Z][a-zA-Z0-9:_-]*)-\[([^\]]*)\]/g

const COLOR_UTILITY_BASES = new Set([
    "bg",
    "text",
    "border",
    "ring",
    "fill",
    "stroke",
    "from",
    "via",
    "to",
    "decoration",
    "outline",
    "caret",
    "accent",
    "divide",
    "shadow"
])

const LITERAL_COLOR = /^(#|rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color\()/i
const HAS_LENGTH_LITERAL = /\d(px|rem|em|%|vh|vw|pt)/i
const LEADING_NUMBER = /^\d/

const stripVariants = (utility: string) => {
    const segments = utility.split(":")
    return segments[segments.length - 1] ?? utility
}

const isRadiusUtility = (base: string) => base === "rounded" || base.startsWith("rounded-")

/**
 * Extract theme-token violations from a single `class`/`className` string.
 * Pure and DOM-free so it can be unit tested directly.
 */
export const findThemeViolationsInClassName = (className: string): ThemeViolation[] => {
    if (!className) return []

    const violations: ThemeViolation[] = []
    const pattern = new RegExp(ARBITRARY_UTILITY.source, "g")

    for (const match of className.matchAll(pattern)) {
        const rawUtility = match[1]
        const bracketValue = match[2]
        // Token-based arbitrary values are exactly what we want people to use.
        if (bracketValue.includes("var(--")) continue

        const base = stripVariants(rawUtility)
        const token = `${rawUtility}-[${bracketValue}]`

        if (isRadiusUtility(base)) {
            if (HAS_LENGTH_LITERAL.test(bracketValue) || LEADING_NUMBER.test(bracketValue)) {
                violations.push({ kind: "radius", value: token })
            }
            continue
        }

        const colorBase = base.replace(/^-/, "").split("-")[0]
        if (COLOR_UTILITY_BASES.has(colorBase) && LITERAL_COLOR.test(bracketValue.trim())) {
            violations.push({ kind: "color", value: token })
        }
    }

    return violations
}

/**
 * Extract violations from an inline `style` attribute string (e.g. `border-radius:8px`).
 */
export const findThemeViolationsInInlineStyle = (style: string): ThemeViolation[] => {
    if (!style) return []

    const violations: ThemeViolation[] = []
    for (const declaration of style.split(";")) {
        const [rawProp, ...rest] = declaration.split(":")
        const prop = rawProp?.trim().toLowerCase()
        const value = rest.join(":").trim()
        if (!prop || !value || value.includes("var(--")) continue

        if (prop.includes("radius") && HAS_LENGTH_LITERAL.test(value)) {
            violations.push({ kind: "radius", value: `${prop}: ${value}` })
        } else if (
            (prop === "color" ||
                prop === "background" ||
                prop === "background-color" ||
                prop === "border-color" ||
                prop === "fill" ||
                prop === "stroke") &&
            LITERAL_COLOR.test(value)
        ) {
            violations.push({ kind: "color", value: `${prop}: ${value}` })
        }
    }

    return violations
}

export const findElementThemeViolations = (element: Element): ThemeViolation[] => {
    const className =
        typeof element.className === "string"
            ? element.className
            : (element.getAttribute("class") ?? "")
    const inlineStyle = element.getAttribute("style") ?? ""

    return [
        ...findThemeViolationsInClassName(className),
        ...findThemeViolationsInInlineStyle(inlineStyle)
    ]
}

export const THEME_VIOLATION_CLASS = "dev-theme-violation"

export type ThemeAuditResult = {
    radius: number
    color: number
    elements: number
}

/**
 * Walk the document, tag offending elements with {@link THEME_VIOLATION_CLASS}, and return
 * counts. Elements the audit itself owns (marked with `data-dev-audit-ignore`) are skipped
 * so the dock/overlay never flags themselves.
 */
export const runThemeAudit = (root: ParentNode = document): ThemeAuditResult => {
    const result: ThemeAuditResult = { radius: 0, color: 0, elements: 0 }
    const elements = root.querySelectorAll<HTMLElement>("*")

    for (const element of elements) {
        if (element.closest("[data-dev-audit-ignore]")) {
            element.classList.remove(THEME_VIOLATION_CLASS)
            continue
        }

        const violations = findElementThemeViolations(element)
        if (violations.length === 0) {
            element.classList.remove(THEME_VIOLATION_CLASS)
            continue
        }

        element.classList.add(THEME_VIOLATION_CLASS)
        result.elements += 1
        for (const violation of violations) {
            result[violation.kind] += 1
        }
    }

    return result
}

export const clearThemeAudit = (root: ParentNode = document) => {
    for (const element of root.querySelectorAll(`.${THEME_VIOLATION_CLASS}`)) {
        element.classList.remove(THEME_VIOLATION_CLASS)
    }
}
