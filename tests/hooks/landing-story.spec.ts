// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createElement, useRef, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
    LandingScene,
    LandingSceneGroup,
    LandingStory
} from "@/components/landing-page/landing-story"

describe("shared landing stage", () => {
    let scrollTop = 0
    let mobile = false

    beforeEach(() => {
        scrollTop = 0
        mobile = false
        vi.stubGlobal("matchMedia", (query: string) => ({
            matches: query.includes("max-width") && mobile,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {}
        }))
        vi.stubGlobal(
            "ResizeObserver",
            class {
                observe() {}
                disconnect() {}
            }
        )
        vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(900)
        vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600)
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
            this: HTMLElement
        ) {
            const top =
                this.id === "first" ? -scrollTop : this.id === "second" ? 600 - scrollTop : 0
            return new DOMRect(0, top, 500, 600)
        })
    })

    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    function Demo({ name }: { name: string }) {
        const [count, setCount] = useState(0)
        return createElement(
            "button",
            { type: "button", onClick: () => setCount(count + 1) },
            `${name} ${count}`
        )
    }

    function Page({ groupSide }: { groupSide?: "left" | "right" }) {
        const containerRef = useRef<HTMLDivElement>(null)
        return createElement(
            "div",
            { ref: containerRef, "data-testid": "scroll-root" },
            createElement(LandingStory, {
                children: createElement(LandingSceneGroup, {
                    propSide: groupSide ?? "left",
                    children: [
                        createElement(LandingScene, {
                            key: "first",
                            id: "first",
                            containerRef,
                            visual: createElement(Demo, { name: "First" }),
                            children: createElement("p", null, "First scene")
                        }),
                        createElement(LandingScene, {
                            key: "second",
                            id: "second",
                            propSide: groupSide ? undefined : "right",
                            containerRef,
                            visual: createElement(Demo, { name: "Second" }),
                            children: createElement("p", null, "Second scene")
                        })
                    ]
                })
            })
        )
    }

    it("makes only the current prop interactive and preserves its state across handoffs", async () => {
        const { container } = render(createElement(Page))
        await waitFor(() =>
            expect(
                container.querySelectorAll(".landing-story-stage .landing-story-visual")
            ).toHaveLength(2)
        )
        fireEvent.click(screen.getByRole("button", { name: "First 0" }))
        expect(screen.queryByRole("button", { name: "Second 0" })).toBeNull()
        expect(container.querySelectorAll(".landing-story-composition[inert]")).toHaveLength(1)
        expect(container.querySelector("#first")?.getAttribute("data-prop-side")).toBe("left")
        expect(container.querySelector("#second")?.getAttribute("data-prop-side")).toBe("right")

        scrollTop = 600
        fireEvent.scroll(screen.getByTestId("scroll-root"))
        await waitFor(() => expect(screen.getByRole("button", { name: "Second 0" })).toBeTruthy())
        expect(screen.queryByRole("button", { name: "First 1" })).toBeNull()

        scrollTop = 0
        fireEvent.scroll(screen.getByTestId("scroll-root"))
        await waitFor(() => expect(screen.getByRole("button", { name: "First 1" })).toBeTruthy())
    })

    it("keeps the same prop anchor for every part of a section group", async () => {
        const { container } = render(createElement(Page, { groupSide: "right" }))
        await waitFor(() =>
            expect(container.querySelectorAll(".landing-story-visual")).toHaveLength(2)
        )
        for (const element of container.querySelectorAll(
            ".landing-story-scene, .landing-story-visual"
        )) {
            expect(element.getAttribute("data-prop-side")).toBe("right")
        }
    })

    it("keeps copy and its demo in one stage and hides the whole outgoing composition", async () => {
        const { container } = render(createElement(Page))
        scrollTop = 380
        fireEvent.scroll(screen.getByTestId("scroll-root"))
        await waitFor(() => {
            const outgoing = container.querySelector<HTMLElement>('[data-scene="first"]')!
            const incoming = container.querySelector<HTMLElement>('[data-scene="second"]')!
            expect(Number(outgoing.style.opacity)).toBe(0)
            expect(Number(incoming.style.opacity)).toBeGreaterThan(0)
            expect(incoming.querySelector(".landing-story-copy")?.textContent).toBe("Second scene")
            expect(incoming.querySelector("button")?.textContent).toBe("Second 0")
            expect(screen.queryByText("First scene", { selector: ":not([inert] *)" })).toBeNull()
        })
    })

    it("keeps every demo in the reading flow on narrow screens", async () => {
        mobile = true
        const { container } = render(createElement(Page))
        await waitFor(() =>
            expect(container.querySelector(".landing-story")?.getAttribute("data-inline")).toBe(
                "true"
            )
        )
        expect(
            container.querySelectorAll(".landing-story-stage .landing-story-visual")
        ).toHaveLength(0)
        expect(screen.getByRole("button", { name: "First 0" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Second 0" })).toBeTruthy()
    })
})
