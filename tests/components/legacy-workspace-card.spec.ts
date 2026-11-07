import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { LegacyWorkspaceCard } from "../../src/components/renderers/legacy-workspace-card"

type Invocation = Parameters<typeof LegacyWorkspaceCard>[0]["toolInvocation"]

const render = (toolInvocation: Record<string, unknown>) =>
    renderToStaticMarkup(
        createElement(LegacyWorkspaceCard, {
            toolInvocation: toolInvocation as unknown as Invocation
        })
    )

describe("LegacyWorkspaceCard", () => {
    it("shows the title an old workspace request was saved with", () => {
        const markup = render({
            state: "output-available",
            output: {
                kind: "persistent_sandbox_request",
                status: "expired",
                title: "Crop yield model"
            }
        })
        expect(markup).toContain("Crop yield model")
    })

    it("still renders a request that was cut off before it had any output", () => {
        expect(render({ state: "input-available" })).toContain("Workspace")
    })

    it("offers nothing to act on", () => {
        const markup = render({ state: "output-available", output: { status: "active" } })
        expect(markup).not.toContain("<button")
    })
})
