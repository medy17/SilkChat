// @vitest-environment jsdom

import type { PromptEditorHandle } from "@/components/composer/prompt-editor"
import { PromptInput, PromptInputEditor } from "@/components/prompt-kit/prompt-input"
import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { beforeAll, describe, expect, it, vi } from "vitest"

beforeAll(() => {
    // jsdom has no layout; CodeMirror only needs these to exist.
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList
    Range.prototype.getBoundingClientRect = () => new DOMRect()
})

const renderEditor = (
    props: Omit<React.ComponentProps<typeof PromptInput>, "children">,
    value = "hello",
    disabled = false
) => {
    const ref = React.createRef<PromptEditorHandle>()
    const onChange = vi.fn()
    render(
        React.createElement(PromptInput, {
            ...props,
            children: React.createElement(PromptInputEditor, { ref, value, onChange, disabled })
        })
    )
    return { ref, onChange, textbox: screen.getByRole("textbox") }
}

describe("PromptInputEditor keyboard behavior", () => {
    it("submits on enter by default", () => {
        const onSubmit = vi.fn()
        const { textbox, ref } = renderEditor({ onSubmit })

        fireEvent.keyDown(textbox, { key: "Enter" })

        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(ref.current?.getValue()).toBe("hello")
    })

    it("inserts a newline instead of submitting when keyboard submit is disabled", () => {
        const onSubmit = vi.fn()
        const { textbox, onChange } = renderEditor({ onSubmit, disableKeyboardSubmit: true })

        fireEvent.keyDown(textbox, { key: "Enter" })

        expect(onSubmit).not.toHaveBeenCalled()
        expect(onChange).toHaveBeenLastCalledWith("hello\n")
    })

    it("swaps enter and modifier-enter when send behavior is inverted", () => {
        const onSubmit = vi.fn()
        const { textbox, onChange } = renderEditor({ onSubmit, invertSendNewlineBehavior: true })

        fireEvent.keyDown(textbox, { key: "Enter" })
        expect(onSubmit).not.toHaveBeenCalled()
        expect(onChange).toHaveBeenLastCalledWith("hello\n")

        fireEvent.keyDown(textbox, { key: "Enter", ctrlKey: true })
        expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it("ignores enter while disabled", () => {
        const { textbox, onChange } = renderEditor({ disableKeyboardSubmit: true }, "- item", true)

        fireEvent.keyDown(textbox, { key: "Enter" })

        expect(onChange).not.toHaveBeenCalled()
    })

    it("continues a list on shift-enter", () => {
        const { textbox, onChange } = renderEditor({ onSubmit: vi.fn() }, "1. first")

        fireEvent.keyDown(textbox, { key: "Enter", shiftKey: true })

        expect(onChange).toHaveBeenLastCalledWith("1. first\n2. ")
    })

    it("clears without leaving the cleared text in undo history", () => {
        const { ref, textbox, onChange } = renderEditor({}, "")

        const now = Date.now()
        const clock = vi.spyOn(Date, "now").mockReturnValue(now)
        ref.current?.setValue("sent prompt")
        // Past CodeMirror's 500ms window for merging edits into one undo step.
        clock.mockReturnValue(now + 1000)
        ref.current?.clear()
        fireEvent.keyDown(textbox, { key: "z", ctrlKey: true })

        expect(ref.current?.getValue()).toBe("")
        expect(onChange).not.toHaveBeenCalled()
    })

    it("sets text without reporting it as an edit, like assigning a textarea value", () => {
        const { ref, onChange } = renderEditor({})

        ref.current?.setValue("> quoted\n\n")

        expect(ref.current?.getValue()).toBe("> quoted\n\n")
        expect(onChange).not.toHaveBeenCalled()
    })
})
