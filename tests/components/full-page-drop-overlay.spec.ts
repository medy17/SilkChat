// @vitest-environment jsdom

import { FullPageDropOverlay } from "@/components/full-page-drop-overlay"
import { fireEvent, render, screen } from "@testing-library/react"
import { createElement } from "react"
import { describe, expect, it, vi } from "vitest"

const isShown = () =>
    screen.getByText("Add Attachment").closest(".fixed")?.classList.contains("opacity-100")

describe("FullPageDropOverlay", () => {
    it("still shows for a file drag after text has been dragged across the page", () => {
        render(createElement(FullPageDropOverlay, { onDrop: vi.fn() }))

        const text = { dataTransfer: { types: ["text/plain"] } }
        fireEvent.dragEnter(window, text)
        fireEvent.dragLeave(window, text)
        fireEvent.dragLeave(window, text)

        fireEvent.dragEnter(window, { dataTransfer: { types: ["Files"] } })
        expect(isShown()).toBe(true)
    })
})
