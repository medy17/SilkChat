// @vitest-environment jsdom

import { isComposerPasteTarget } from "@/lib/composer-paste"
import { describe, expect, it } from "vitest"

describe("composer paste targeting", () => {
    it("routes paste handling only to the focused main composer", () => {
        const composer = document.createElement("textarea")
        const messageEditor = document.createElement("textarea")

        expect(isComposerPasteTarget(composer, composer)).toBe(true)
        expect(isComposerPasteTarget(messageEditor, composer)).toBe(false)
        expect(isComposerPasteTarget(document.body, composer)).toBe(false)
        expect(isComposerPasteTarget(composer, null)).toBe(false)
    })
})
