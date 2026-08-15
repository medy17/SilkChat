import { beforeEach, describe, expect, it } from "vitest"

import { useModelStore } from "@/lib/model-store"

describe("model-store", () => {
    beforeEach(() => {
        useModelStore.setState({
            selectedModel: null,
            enabledTools: [],
            selectedImageSize: "1:1",
            selectedImageResolution: "1K",
            reasoningEffort: "off"
        })
    })

    it("updates selected model, tools, image settings, and reasoning effort", () => {
        useModelStore.getState().setSelectedModel("gpt-5.4")
        useModelStore.getState().setEnabledTools(["web_search", "supermemory"])
        useModelStore.getState().setSelectedImageSize("16:9")
        useModelStore.getState().setSelectedImageResolution("2K")
        useModelStore.getState().setReasoningEffort("high")

        expect(useModelStore.getState()).toMatchObject({
            selectedModel: "gpt-5.4",
            enabledTools: ["web_search", "supermemory"],
            selectedImageSize: "16:9",
            selectedImageResolution: "2K",
            reasoningEffort: "high"
        })
    })
})
