// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react"
import type { Tool, UIToolInvocation } from "ai"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SkillLoaderRenderer } from "@/components/renderers/skill-loader"

const pending: UIToolInvocation<Tool> = {
    state: "input-available",
    toolCallId: "skill-1",
    input: { skill: "web_search" }
}
const completed: UIToolInvocation<Tool> = {
    ...pending,
    state: "output-available",
    output: { success: true, label: "Web Search" }
}
const view = (toolInvocation: UIToolInvocation<Tool>) =>
    createElement(SkillLoaderRenderer, { toolInvocation })

describe("skill loading feedback", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it("completes fast loads without ever showing a spinner", () => {
        const { rerender } = render(view(pending))
        expect(screen.getByRole("status").textContent).toBe("Loading Web Search skill")
        act(() => vi.advanceTimersByTime(200))
        expect(screen.queryByLabelText("Loading skill")).toBeNull()
        rerender(view(completed))
        expect(screen.getByRole("status").textContent).toBe("Loaded Web Search skill")
        act(() => vi.advanceTimersByTime(1000))
        expect(screen.queryByLabelText("Loading skill")).toBeNull()
    })

    it("shows a spinner for slow loads and removes it immediately on completion", () => {
        const { rerender } = render(view(pending))
        act(() => vi.advanceTimersByTime(300))
        expect(screen.queryByLabelText("Loading skill")).not.toBeNull()
        rerender(view(completed))
        expect(screen.queryByLabelText("Loading skill")).toBeNull()
        expect(screen.getByRole("status").textContent).toBe("Loaded Web Search skill")
    })

    it.each<UIToolInvocation<Tool>>([
        { ...pending, state: "output-error", errorText: "Skill unavailable" },
        { ...completed, output: { success: false, label: "Web Search" } }
    ])("shows failures instead of claiming a skill loaded", (failed) => {
        const { rerender } = render(view(pending))
        act(() => vi.advanceTimersByTime(300))
        rerender(view(failed))
        expect(screen.queryByLabelText("Loading skill")).toBeNull()
        expect(screen.getByRole("status").textContent).toBe("Failed to load Web Search skill")
    })
})
