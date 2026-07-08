// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest"

import {
    THEME_VIOLATION_CLASS,
    clearThemeAudit,
    findThemeViolationsInClassName,
    findThemeViolationsInInlineStyle,
    runThemeAudit
} from "@/lib/dev-theme-audit"

describe("theme audit className scanner", () => {
    it("flags hardcoded arbitrary radius but allows radius tokens", () => {
        expect(findThemeViolationsInClassName("rounded-[8px] p-2")).toEqual([
            { kind: "radius", value: "rounded-[8px]" }
        ])
        expect(findThemeViolationsInClassName("rounded-tl-[6px]")).toEqual([
            { kind: "radius", value: "rounded-tl-[6px]" }
        ])
        expect(findThemeViolationsInClassName("rounded-[var(--radius-md)]")).toEqual([])
    })

    it("flags hardcoded arbitrary colors but allows color tokens and named utilities", () => {
        expect(findThemeViolationsInClassName("bg-[#ff0000]")).toEqual([
            { kind: "color", value: "bg-[#ff0000]" }
        ])
        expect(findThemeViolationsInClassName("text-[rgb(0,0,0)]")).toEqual([
            { kind: "color", value: "text-[rgb(0,0,0)]" }
        ])
        expect(findThemeViolationsInClassName("bg-[var(--primary)]")).toEqual([])
        expect(findThemeViolationsInClassName("bg-primary text-muted-foreground")).toEqual([])
    })

    it("ignores non-color arbitrary utilities and respects responsive/state variants", () => {
        // Arbitrary width is not a token concern.
        expect(findThemeViolationsInClassName("w-[240px]")).toEqual([])
        // Variant-prefixed hardcoded values still count.
        expect(findThemeViolationsInClassName("hover:bg-[#123456]")).toEqual([
            { kind: "color", value: "hover:bg-[#123456]" }
        ])
        expect(findThemeViolationsInClassName("md:rounded-[10px]")).toEqual([
            { kind: "radius", value: "md:rounded-[10px]" }
        ])
    })
})

describe("theme audit inline-style scanner", () => {
    it("flags literal radius and color declarations, allows tokens", () => {
        expect(findThemeViolationsInInlineStyle("border-radius: 8px")).toEqual([
            { kind: "radius", value: "border-radius: 8px" }
        ])
        expect(findThemeViolationsInInlineStyle("background-color: #fff")).toEqual([
            { kind: "color", value: "background-color: #fff" }
        ])
        expect(findThemeViolationsInInlineStyle("border-radius: var(--radius-lg)")).toEqual([])
        expect(findThemeViolationsInInlineStyle("color: var(--foreground)")).toEqual([])
    })
})

describe("runThemeAudit DOM tagging", () => {
    beforeEach(() => {
        document.body.innerHTML = ""
    })

    it("tags offenders, counts by kind, and skips ignored subtrees", () => {
        document.body.innerHTML = `
            <div class="rounded-[8px]"></div>
            <div class="bg-[#abcdef]"></div>
            <div class="rounded-[var(--radius-md)]"></div>
            <div data-dev-audit-ignore><span class="rounded-[4px]"></span></div>
        `

        const result = runThemeAudit(document.body)

        expect(result.radius).toBe(1)
        expect(result.color).toBe(1)
        expect(result.elements).toBe(2)
        expect(document.querySelectorAll(`.${THEME_VIOLATION_CLASS}`).length).toBe(2)

        clearThemeAudit(document.body)
        expect(document.querySelectorAll(`.${THEME_VIOLATION_CLASS}`).length).toBe(0)
    })
})
