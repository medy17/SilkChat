import { appendQuotedSelection, formatQuotedSelection } from "@/lib/quote-selection"
import { describe, expect, it } from "vitest"

describe("formatQuotedSelection", () => {
    it("formats a single selected line as a markdown quote", () => {
        expect(formatQuotedSelection("Yeah basically do that to fix it")).toBe(
            "> Yeah basically do that to fix it"
        )
    })

    it("preserves multiple lines inside the quoted block", () => {
        expect(formatQuotedSelection("first line\nsecond line")).toBe("> first line\n> second line")
    })

    it("trims outer whitespace before quoting", () => {
        expect(formatQuotedSelection("\n  quoted text  \n")).toBe("> quoted text")
    })
})

describe("appendQuotedSelection", () => {
    it("appends a quote block to an existing draft with spacing", () => {
        expect(
            appendQuotedSelection("Need help with this", "Yeah basically do that to fix it")
        ).toBe("Need help with this\n\n> Yeah basically do that to fix it\n\n")
    })

    it("creates a quote-only draft when the composer is empty", () => {
        expect(appendQuotedSelection("", "Yeah basically do that to fix it")).toBe(
            "> Yeah basically do that to fix it\n\n"
        )
    })
})
