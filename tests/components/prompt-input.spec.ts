// @vitest-environment jsdom

import {
    PromptInput,
    PromptInputTextarea,
    applyPromptTextareaSize
} from "@/components/prompt-kit/prompt-input"
import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { describe, expect, it, vi } from "vitest"

const defineScrollHeight = (element: HTMLTextAreaElement, value: number) => {
    Object.defineProperty(element, "scrollHeight", {
        configurable: true,
        value
    })
}

describe("applyPromptTextareaSize", () => {
    it("switches to internal scrolling after reaching the numeric max height", () => {
        const textarea = document.createElement("textarea")
        textarea.value = "wrapped content"
        defineScrollHeight(textarea, 320)

        applyPromptTextareaSize(textarea, 240)

        expect(textarea.style.height).toBe("240px")
        expect(textarea.style.overflowY).toBe("auto")
    })

    it("keeps scrolling hidden while content stays below the numeric max height", () => {
        const textarea = document.createElement("textarea")
        textarea.value = "short content"
        defineScrollHeight(textarea, 120)

        applyPromptTextareaSize(textarea, 240)

        expect(textarea.style.height).toBe("120px")
        expect(textarea.style.overflowY).toBe("hidden")
    })

    it("clears sizing when the value is empty", () => {
        const textarea = document.createElement("textarea")
        textarea.value = "   "
        textarea.style.height = "120px"
        textarea.style.overflowY = "auto"

        applyPromptTextareaSize(textarea, 240)

        expect(textarea.style.height).toBe("")
        expect(textarea.style.overflowY).toBe("")
    })
})

describe("PromptInputTextarea submit behavior", () => {
    const promptInputWithTextarea = (
        props: Omit<React.ComponentProps<typeof PromptInput>, "children">
    ): React.ComponentProps<typeof PromptInput> => ({
        ...props,
        children: React.createElement(PromptInputTextarea)
    })

    it("submits on desktop enter by default", () => {
        const onSubmit = vi.fn()

        render(React.createElement(PromptInput, promptInputWithTextarea({ onSubmit })))

        fireEvent.keyDown(screen.getByRole("textbox"), {
            key: "Enter"
        })

        expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it("does not submit on enter when keyboard submit is disabled", () => {
        const onSubmit = vi.fn()

        render(
            React.createElement(
                PromptInput,
                promptInputWithTextarea({ onSubmit, disableKeyboardSubmit: true })
            )
        )

        fireEvent.keyDown(screen.getByRole("textbox"), {
            key: "Enter"
        })

        expect(onSubmit).not.toHaveBeenCalled()
    })
})
