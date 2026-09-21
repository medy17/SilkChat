// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"

import { useModelStore } from "@/lib/model-store"

describe("model-store", () => {
    beforeEach(() => {
        useModelStore.setState({
            selectedModel: null,
            enabledTools: [],
            manualTools: [],
            toolThreadId: null,
            conversationTools: {},
            manuallyEditedThreads: {},
            toolRevision: 0,
            toolDraftGeneration: 0,
            draftToolOverride: null,
            autoSelectTools: true,
            selectedImageSize: "1:1",
            selectedImageResolution: "1K",
            reasoningEffort: "off"
        })
    })

    it("persists auto-selection independently of manual tool choices", async () => {
        useModelStore.getState().setEnabledTools(["web_search"])
        useModelStore.getState().setAutoSelectTools(false)
        expect(useModelStore.getState().enabledTools).toEqual(["web_search"])
        const saved = JSON.parse(localStorage.getItem("model-storage")!)
        expect(saved.state.autoSelectTools).toBe(false)
        await useModelStore.persist.rehydrate()
        expect(useModelStore.getState().autoSelectTools).toBe(false)
    })

    it("starts Magic chats clean without losing manual preferences or prior conversation tools", () => {
        const store = () => useModelStore.getState()
        store().setEnabledTools(["supermemory"])
        store().activateToolThread("first")
        store().restoreConversationTools("first", ["web_search", "code_execution"])
        expect(store().manualTools).toEqual(["supermemory"])
        store().setSelectedModel("changed-model")
        store().startNewToolSelection()
        expect(store().enabledTools).toEqual([])
        store().setAutoSelectTools(false)
        expect(store().enabledTools).toEqual(["supermemory"])
        store().activateToolThread("first")
        expect(store().enabledTools).toEqual(["web_search", "code_execution"])
        store().setAutoSelectTools(true)
        expect(store().enabledTools).toEqual(["web_search", "code_execution"])
        store().startNewToolSelection()
        expect(store().enabledTools).toEqual([])
    })

    it("keeps manual edits separate from Magic's other selections and ignores stale restores", () => {
        const store = () => useModelStore.getState()
        store().activateToolThread("first")
        store().restoreConversationTools("first", ["web_search"])
        store().setEnabledTools(["web_search", "code_execution"])
        expect(store().manualTools).toEqual(["code_execution"])
        store().setEnabledTools(["code_execution"])
        store().restoreConversationTools("first", ["web_search"])
        expect(store().enabledTools).toEqual(["code_execution"])
        store().startNewToolSelection()
        store().restoreConversationTools("first", ["web_search"])
        expect(store().enabledTools).toEqual([])
    })

    it("restores conversation choices on reload without carrying them into the next Magic draft", async () => {
        const store = () => useModelStore.getState()
        store().activateToolThread("first")
        store().restoreConversationTools("first", ["web_search"])
        store().setEnabledTools(["web_search", "code_execution"])
        await useModelStore.persist.rehydrate()
        expect(store().enabledTools).toEqual([])
        expect(store().manualTools).toEqual(["code_execution"])
        store().activateToolThread("first")
        expect(store().enabledTools).toEqual(["web_search", "code_execution"])
    })

    it("preserves manual draft changes made while Magic is selecting", () => {
        const store = () => useModelStore.getState()
        const revision = store().toolRevision
        const generation = store().toolDraftGeneration
        store().setEnabledTools(["code_execution"])
        // The subscription may hydrate the saved automatic choice before the stream event.
        store().activateToolThread("first", ["web_search"])
        store().restoreConversationTools("first", ["web_search"], revision, generation)
        expect(store().enabledTools).toEqual(["code_execution"])
    })

    it("does not apply an old draft's result to a newer draft", () => {
        const store = () => useModelStore.getState()
        const revision = store().toolRevision
        const generation = store().toolDraftGeneration
        store().startNewToolSelection()
        store().setEnabledTools(["code_execution"])
        store().restoreConversationTools("old-thread", ["web_search"], revision, generation)
        expect(store().enabledTools).toEqual(["code_execution"])
        expect(store().conversationTools["old-thread"]).toEqual(["web_search"])
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
