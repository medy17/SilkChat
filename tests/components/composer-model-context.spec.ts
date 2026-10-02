// @vitest-environment jsdom
import { expect, it } from "vitest"
import {
    createEditModelStore,
    createMessageEditModelStore,
    hasEditSettingsChanges
} from "@/components/composer/model-context"
import type { SharedModel } from "@/convex/lib/models"
import { useModelStore } from "@/lib/model-store"
import type { AbilityId } from "@/lib/tool-abilities"
it("editing a checkpoint does not change the active composer or persisted preferences", () => {
    const original = useModelStore.getState()
    const storage = JSON.stringify(localStorage)
    const edit = createEditModelStore({
        selectedModel: "historical",
        reasoningEffort: "high",
        enabledTools: ["web_search"],
        autoSelectTools: false
    })
    edit.getState().setSelectedModel("different")
    edit.getState().setEnabledTools(["code_execution"])
    edit.getState().setReasoningEffort("low")
    edit.getState().setAutoSelectTools(true)
    edit.getState().setToolCallLimitPerTurn?.(5)
    expect(edit.getState()).toMatchObject({
        selectedModel: "different",
        enabledTools: ["code_execution"],
        reasoningEffort: "low",
        autoSelectTools: true,
        toolCallLimitPerTurn: 5
    })
    expect(useModelStore.getState()).toBe(original)
    expect(JSON.stringify(localStorage)).toBe(storage)
})

it("automatic availability adjustments do not mark a newly opened editor dirty", () => {
    const edit = createEditModelStore({
        selectedModel: "historic",
        reasoningEffort: "high",
        enabledTools: ["web_search"]
    })
    edit.getState().normalizeReasoningEffort?.("off")
    edit.getState().setConversationTools([])
    edit.getState().normalizeSelectedModel?.("replacement")
    expect(hasEditSettingsChanges(edit.getState())).toBe(false)
    edit.getState().setReasoningEffort("low")
    expect(hasEditSettingsChanges(edit.getState())).toBe(true)
    edit.getState().normalizeReasoningEffort?.("medium")
    expect(hasEditSettingsChanges(edit.getState())).toBe(true)
    edit.getState().setReasoningEffort("off")
    expect(hasEditSettingsChanges(edit.getState())).toBe(false)
})

it("initializes from historical configuration and uses current defaults only for missing fields", () => {
    useModelStore.setState({
        selectedModel: "current",
        reasoningEffort: "off",
        enabledTools: ["code_execution"],
        autoSelectTools: true
    })
    const models = [
        {
            id: "historical",
            name: "Historical",
            adapters: [],
            abilities: ["reasoning", "effort_control"],
            reasoningEfforts: ["low", "high"]
        }
    ] as SharedModel[]
    const args = {
        models,
        availableModels: [{ id: "historical" }, { id: "current" }],
        toolCallLimitPerTurn: 3
    }
    const historical = {
        modelId: "historical",
        reasoningEffort: "high" as const,
        enabledTools: ["web_search" as const],
        autoSelectTools: false,
        toolCallLimitPerTurn: 7
    }
    expect(
        createMessageEditModelStore({
            ...args,
            config: { ...historical, generationConfig: historical }
        }).getState()
    ).toMatchObject({
        selectedModel: "historical",
        reasoningEffort: "high",
        enabledTools: ["web_search"],
        autoSelectTools: false,
        toolCallLimitPerTurn: 7
    })
    expect(
        createMessageEditModelStore({
            ...args,
            config: { modelId: "historical", reasoningEffort: "low", generationConfig: undefined }
        }).getState()
    ).toMatchObject({
        selectedModel: "historical",
        reasoningEffort: "low",
        enabledTools: ["code_execution"],
        autoSelectTools: true,
        toolCallLimitPerTurn: 3
    })
    expect(createMessageEditModelStore(args).getState()).toMatchObject({
        selectedModel: "current",
        reasoningEffort: "off"
    })
})

it.each<{
    name: string
    autoSelectTools: boolean
    enabledTools: AbilityId[]
    resolvedTools?: AbilityId[]
    expected: AbilityId[]
}>([
    {
        name: "preserves automatically selected tools",
        autoSelectTools: true,
        enabledTools: [],
        resolvedTools: ["web_search"],
        expected: ["web_search"]
    },
    {
        name: "preserves an explicitly empty automatic selection",
        autoSelectTools: true,
        enabledTools: ["web_search"],
        resolvedTools: [],
        expected: []
    },
    {
        name: "falls back to requested tools for older automatic checkpoints",
        autoSelectTools: true,
        enabledTools: ["web_search"],
        expected: ["web_search"]
    },
    {
        name: "retains requested tools for manual checkpoints",
        autoSelectTools: false,
        enabledTools: ["web_search"],
        resolvedTools: [],
        expected: ["web_search"]
    }
])("an editor $name", ({ autoSelectTools, enabledTools, resolvedTools, expected }) => {
    const original = useModelStore.getState()
    const generationConfig = {
        modelId: "historical",
        reasoningEffort: "off" as const,
        autoSelectTools,
        enabledTools,
        resolvedTools
    }
    const edit = createMessageEditModelStore({
        config: { ...generationConfig, generationConfig },
        models: [],
        availableModels: [{ id: "historical" }]
    })

    expect(edit.getState().enabledTools).toEqual(expected)
    expect(hasEditSettingsChanges(edit.getState())).toBe(false)
    expect(useModelStore.getState()).toBe(original)
})
