// @vitest-environment jsdom
import { MemoizedMarkdown } from "@/components/memoized-markdown"
import {
    RoleplayPersonaProvider,
    RoleplayPortraitsProvider
} from "@/components/roleplay-persona-context"
import { cleanup, render, screen } from "@testing-library/react"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

// Image loading itself belongs to the avatar primitive; expose its src so this
// suite exercises the scene's live identity and portrait selection.
vi.mock("@/components/ui/avatar", () => ({
    Avatar: ({ children }: { children: React.ReactNode }) =>
        React.createElement("span", null, children),
    AvatarImage: ({ src }: { src: string }) => React.createElement("img", { src, alt: "" }),
    AvatarFallback: ({ children }: { children: React.ReactNode }) =>
        React.createElement("span", null, children)
}))

afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
})

describe("embedded roleplay rendering", () => {
    it("updates every earlier character group when a portrait changes, including read-only views", () => {
        vi.stubEnv("VITE_R2_PUBLIC_BASE_URL", "https://images.example.com")
        const message = React.createElement(MemoizedMarkdown, {
            content:
                '<roleplay><character id="kael" name="Kael"><dialogue>Hello.</dialogue></character><character id="rook" name="Rook"><dialogue>Hi.</dialogue></character><character id="kael" name="Kael"><dialogue>Again.</dialogue></character></roleplay>'
        })
        const view = (storageKey?: string) =>
            React.createElement(
                RoleplayPortraitsProvider,
                {
                    value: { portraits: storageKey ? [{ characterId: "kael", storageKey }] : [] }
                },
                message
            )
        const { container, rerender } = render(view())
        expect(container.querySelectorAll("img")).toHaveLength(0)
        rerender(view("generations/user-1/kael.png"))
        const original = [...container.querySelectorAll("img")].map((img) => img.src)
        expect(original).toHaveLength(2)
        expect(original[0]).toBe(original[1])
        rerender(view("roleplay-portraits/user-1/cropped.webp"))
        expect([...container.querySelectorAll("img")].map((img) => img.src)).not.toEqual(original)
        expect(screen.getByRole("group", { name: "Rook" }).querySelector("img")).toBeNull()
        rerender(view())
        expect(container.querySelectorAll("img")).toHaveLength(0)
    })
    it("updates already-rendered character groups when the saved Persona arrives, without relabeling supporting characters", () => {
        const message = React.createElement(MemoizedMarkdown, {
            content:
                '<roleplay><character id="persona" name="aria"><dialogue>Hello.</dialogue></character><character id="aria-stranger" name="aria"><thought>Go.</thought></character></roleplay>'
        })
        const { rerender } = render(
            React.createElement(RoleplayPersonaProvider, { value: undefined }, message)
        )
        expect(screen.getAllByRole("group", { name: "aria" })).toHaveLength(2)
        rerender(
            React.createElement(
                RoleplayPersonaProvider,
                { value: { name: "Aria the Archivist" } },
                message
            )
        )
        expect(screen.getByRole("group", { name: "Aria the Archivist" })).toBeTruthy()
        expect(screen.getByRole("group", { name: "aria" })).toBeTruthy()
        rerender(React.createElement(RoleplayPersonaProvider, { value: undefined }, message))
        expect(screen.queryByRole("group", { name: "Aria the Archivist" })).toBeNull()
        expect(screen.getAllByRole("group", { name: "aria" })).toHaveLength(2)
    })
    it("separates a scene from its preamble and trailing answer, without doubling speech quotes", () => {
        const { container } = render(
            React.createElement(MemoizedMarkdown, {
                content:
                    'Before the scene.\n<roleplay><character name="Adelle"><action>She walks.</action><dialogue>“Hello.”</dialogue></character></roleplay>\nAfter the scene.'
            })
        )
        const scene = screen.getByRole("group", { name: "Roleplay scene" })
        expect(scene.textContent).toContain("Adelle")
        expect(scene.textContent).not.toContain("Before the scene")
        expect(screen.getByText("Before the scene.")).toBeTruthy()
        expect(screen.getByText("After the scene.")).toBeTruthy()
        expect(container.querySelector(".rp-dialogue .markdown-content")?.textContent).toBe(
            "Hello."
        )
        expect(container.querySelector(".rp-dialogue svg")).toBeNull()
        // Screen readers hear which beats are speech.
        expect(scene.textContent).toContain("Says: Hello.")
    })

    it("holds tag fragments and updates the same scene while streaming", () => {
        const { container, rerender } = render(
            React.createElement(MemoizedMarkdown, { content: "Before. <role", isAnimating: true })
        )
        expect(container.textContent?.trim()).toBe("Before.")
        rerender(
            React.createElement(MemoizedMarkdown, {
                content: 'Before. <roleplay><character name="Adelle"><thought>Go</thou',
                isAnimating: true
            })
        )
        const scene = container.querySelector("[data-roleplay-scene]")
        expect(scene?.querySelector(".rp-thought .markdown-content")?.textContent).toBe("Go")
        rerender(
            React.createElement(MemoizedMarkdown, {
                content:
                    'Before. <roleplay><character name="Adelle"><thought>Go now.</thought></character></roleplay> After.'
            })
        )
        expect(container.querySelector("[data-roleplay-scene]")).toBe(scene)
        expect(container.textContent).toContain("Go now.")
        expect(container.textContent).not.toContain("</thou")
    })

    it("renders say lines as compact exchanges that appear only once a line has text", () => {
        const { container, rerender } = render(
            React.createElement(MemoizedMarkdown, {
                content: '<roleplay><say id="rook" name="Rook">',
                isAnimating: true
            })
        )
        expect(container.querySelector(".rp-exchange")).toBeNull()
        rerender(
            React.createElement(MemoizedMarkdown, {
                content:
                    '<roleplay><say id="rook" name="Rook">Queue forms</say><say id="rook">on the left.',
                isAnimating: true
            })
        )
        const exchange = screen.getByRole("group", { name: "Rook" })
        expect(exchange.classList.contains("rp-exchange")).toBe(true)
        expect(
            [...exchange.querySelectorAll(".rp-dialogue .markdown-content")].map(
                (line) => line.textContent
            )
        ).toEqual(["Queue forms", "on the left."])
        expect(container.querySelector(".rp-character-header")).toBeNull()
    })

    it("keeps model HTML inert and never fetches an avatar supplied by markup", () => {
        const { container } = render(
            React.createElement(MemoizedMarkdown, {
                content:
                    '<roleplay><character name="A" avatar="https://example.com/tracker"><action>&lt;img src=x onerror=alert(1)&gt;</action><dialogue>&lt;script&gt;alert(1)&lt;/script&gt;</dialogue></character></roleplay>'
            })
        )
        expect(container.querySelector("img,script")).toBeNull()
        expect(container.textContent).toContain("<img src=x onerror=alert(1)>")
        expect(container.textContent).toContain("<script>alert(1)</script>")
    })

    it("shows angle brackets in beat code verbatim while prose tags stay text", () => {
        const { container } = render(
            React.createElement(MemoizedMarkdown, {
                content:
                    '<roleplay><character name="A"><action>She types `x &lt; 2` and `a > b`.</action><dialogue>Try &lt;b&gt;this&lt;/b&gt;.</dialogue></character></roleplay>'
            })
        )
        expect(
            [...container.querySelectorAll(".rp-action code")].map((code) => code.textContent)
        ).toEqual(["x < 2", "a > b"])
        expect(container.querySelector(".rp-dialogue b")).toBeNull()
        expect(container.querySelector(".rp-dialogue")?.textContent).toContain("<b>this</b>")
    })

    it("renders code examples as code rather than native scenes", () => {
        const { container } = render(
            React.createElement(MemoizedMarkdown, {
                content: "`<roleplay><dialogue>Hello.</dialogue></roleplay>`"
            })
        )
        expect(container.querySelector("[data-roleplay-scene]")).toBeNull()
        expect(container.textContent).toContain("<roleplay>")
    })
})
