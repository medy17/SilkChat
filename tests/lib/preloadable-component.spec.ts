// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react"
import { Suspense, createElement } from "react"
import { describe, expect, it } from "vitest"
import { createPreloadableComponent, useIsPreloadableLoaded } from "@/lib/preloadable-component"

const deferred = <T>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((res) => {
        resolve = res
    })
    return { promise, resolve }
}

const Greeting = ({ name }: { name: string }) => createElement("p", null, `Hello ${name}`)

describe("createPreloadableComponent", () => {
    it("tells waiting screens when the chunk lands, wherever the load was started", async () => {
        const chunk = deferred<typeof Greeting>()
        const view = createPreloadableComponent(() => chunk.promise)
        const Status = () =>
            createElement("p", null, useIsPreloadableLoaded(view) ? "ready" : "waiting")

        render(createElement(Status))
        expect(screen.getByText("waiting")).toBeTruthy()

        view.preload()
        await act(async () => chunk.resolve(Greeting))

        expect(screen.getByText("ready")).toBeTruthy()
    })

    it("renders a loaded view straight away, without passing through its fallback", async () => {
        const view = createPreloadableComponent(async () => Greeting)
        await view.preload()

        render(
            createElement(
                Suspense,
                { fallback: createElement("p", null, "fallback") },
                createElement(view.Component, { name: "Medy" })
            )
        )

        expect(screen.getByText("Hello Medy")).toBeTruthy()
        expect(screen.queryByText("fallback")).toBeNull()
    })

    it("tries the chunk again after a failed load", async () => {
        let attempts = 0
        const view = createPreloadableComponent(async () => {
            attempts += 1
            if (attempts === 1) throw new Error("chunk failed")
            return Greeting
        })

        await expect(view.preload()).rejects.toThrow("chunk failed")
        await view.preload()

        expect(attempts).toBe(2)
        expect(view.isLoaded()).toBe(true)
    })
})
