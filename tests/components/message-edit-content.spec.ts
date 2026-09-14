// @vitest-environment jsdom
import { createElement } from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { MessageEditContent } from "@/components/message-edit-content"
import { MemoizedMarkdown } from "@/components/memoized-markdown"

afterEach(cleanup)

it("preserves multiple rendered code blocks and their expansion state across edit/cancel", async () => {
    const code = Array.from({ length: 30 }, (_, index) => `const value${index} = ${index}`).join(
        "\n"
    )
    const content = `Choose one:\n\n\`\`\`js\n${code}\n\`\`\`\n\n\`\`\`js\n${code}\n\`\`\``
    const view = (editing: boolean) =>
        createElement(MessageEditContent, {
            editing,
            editor: createElement("textarea", { defaultValue: content }),
            children: createElement(MemoizedMarkdown, { content })
        })
    const { container, rerender } = render(view(false))
    await waitFor(() =>
        expect(screen.getAllByRole("button", { name: /more lines/ })).toHaveLength(2)
    )
    const blocks = Array.from(container.querySelectorAll("[data-message-code-block]"))
    fireEvent.click(screen.getAllByRole("button", { name: /more lines/ })[0])
    expect(screen.getAllByRole("button", { name: /more lines/ })).toHaveLength(1)
    for (let index = 0; index < 3; index++) {
        rerender(view(true))
        expect(screen.getByRole("textbox")).toBeTruthy()
        expect(screen.queryByRole("button", { name: /more lines/ })).toBeNull()
        rerender(view(false))
        expect(screen.queryByRole("textbox")).toBeNull()
        expect(screen.getAllByRole("button", { name: /more lines/ })).toHaveLength(1)
        expect(Array.from(container.querySelectorAll("[data-message-code-block]"))).toEqual(blocks)
    }
})

it("updates rendered code after saving changed text", async () => {
    const view = (editing: boolean, content: string) =>
        createElement(MessageEditContent, {
            editing,
            editor: createElement("textarea"),
            children: createElement(MemoizedMarkdown, { content })
        })
    const { container, rerender } = render(view(false, "```text\noriginal code\n```"))
    await waitFor(() => expect(container.textContent).toContain("original code"))
    rerender(view(true, "```text\noriginal code\n```"))
    rerender(view(false, "```text\nreplacement code\n```"))
    await waitFor(() => expect(container.textContent).toContain("replacement code"))
    expect(container.textContent).not.toContain("original code")
})
