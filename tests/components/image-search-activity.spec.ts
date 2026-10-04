// @vitest-environment jsdom

import { render, screen, fireEvent } from "@testing-library/react"
import { createElement } from "react"
import { expect, it } from "vitest"
import { WebSearchGroupRenderer } from "@/components/renderers/web-search-ui"
import { getMessageImageSearches } from "@/lib/message-web-searches"

it("does not render temporary candidate images when image-search activity is expanded", () => {
    const searches = getMessageImageSearches({
        role: "assistant",
        parts: [
            {
                type: "tool-image_search",
                toolCallId: "one",
                state: "output-available",
                input: { query: "Beelzebufo fossil" },
                output: {
                    success: true,
                    results: [
                        {
                            title: "Fossil specimen",
                            source: "Museum",
                            sourceUrl: "https://museum.example/specimen",
                            thumbnailUrl: "https://temporary.example/expired.webp"
                        }
                    ]
                }
            }
        ]
    })
    const { container } = render(createElement(WebSearchGroupRenderer, { searches, kind: "image" }))
    fireEvent.click(screen.getByRole("button", { name: /Image Search/ }))
    fireEvent.click(screen.getByRole("button", { name: /Beelzebufo fossil/ }))
    expect(screen.getByRole("link", { name: /Fossil specimen/ })).toBeTruthy()
    expect(container.querySelectorAll("img")).toHaveLength(0)
})
