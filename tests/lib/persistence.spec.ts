import { beforeEach, describe, expect, it, vi } from "vitest"

import {
    LUNA_DEFAULT_MODEL_MIGRATION_KEY,
    loadAIConfig,
    loadUserInput,
    saveAIConfig,
    saveUserInput,
    setDefaultModelToLunaOnce
} from "@/lib/persistence"

type StorageState = Record<string, string>

const createStorageMock = (initialState: StorageState = {}) => {
    const state: StorageState = { ...initialState }

    return {
        getItem: vi.fn((key: string) => state[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
            state[key] = value
        }),
        removeItem: vi.fn((key: string) => {
            delete state[key]
        }),
        snapshot: () => ({ ...state })
    }
}

describe("persistence", () => {
    beforeEach(() => {
        vi.unstubAllGlobals()
    })

    it("returns SSR-safe defaults when window is unavailable", () => {
        expect(loadAIConfig()).toEqual({
            selectedModel: null,
            enabledTools: [],
            selectedImageSize: "1:1",
            selectedImageResolution: "1K",
            reasoningEffort: "off"
        })
        expect(loadUserInput()).toBe("")
    })

    it("recovers from corrupted ai-config storage by clearing the key", () => {
        const storage = createStorageMock({
            "ai-config": "{not-json"
        })

        vi.stubGlobal("window", {})
        vi.stubGlobal("localStorage", storage)

        expect(loadAIConfig()).toEqual({
            selectedModel: null,
            enabledTools: [],
            selectedImageSize: "1:1",
            selectedImageResolution: "1K",
            reasoningEffort: "off"
        })
        expect(storage.removeItem).toHaveBeenCalledWith("ai-config")
    })

    it("normalizes invalid enabled tools to the default tool set", () => {
        const storage = createStorageMock({
            "ai-config": JSON.stringify({
                selectedModel: "gpt-5.4",
                enabledTools: ["invalid-tool"],
                selectedImageSize: "16:9",
                selectedImageResolution: "2K",
                reasoningEffort: "medium"
            })
        })

        vi.stubGlobal("window", {})
        vi.stubGlobal("localStorage", storage)

        expect(loadAIConfig()).toEqual({
            selectedModel: "gpt-5.4",
            enabledTools: [],
            selectedImageSize: "16:9",
            selectedImageResolution: "2K",
            reasoningEffort: "medium"
        })
    })

    it("migrates the old web-search-on default while preserving customized configs", () => {
        const defaultStorage = createStorageMock({
            "ai-config": JSON.stringify({
                selectedModel: null,
                enabledTools: ["web_search"],
                selectedImageSize: "1:1",
                selectedImageResolution: "1K",
                reasoningEffort: "off"
            })
        })

        vi.stubGlobal("window", {})
        vi.stubGlobal("localStorage", defaultStorage)

        expect(loadAIConfig()).toEqual({
            selectedModel: null,
            enabledTools: [],
            selectedImageSize: "1:1",
            selectedImageResolution: "1K",
            reasoningEffort: "off"
        })

        const customizedStorage = createStorageMock({
            "ai-config": JSON.stringify({
                selectedModel: "gpt-5.4",
                enabledTools: ["web_search"],
                selectedImageSize: "1:1",
                selectedImageResolution: "1K",
                reasoningEffort: "off"
            })
        })

        vi.stubGlobal("localStorage", customizedStorage)

        expect(loadAIConfig()).toMatchObject({
            selectedModel: "gpt-5.4",
            enabledTools: ["web_search"]
        })
    })

    it("persists validated config and trims/removes saved user input", () => {
        const storage = createStorageMock()

        vi.stubGlobal("window", {})
        vi.stubGlobal("localStorage", storage)

        saveAIConfig({
            selectedModel: "gemini-3-flash-preview",
            enabledTools: ["web_search", "mcp"],
            selectedImageSize: "1:1",
            selectedImageResolution: "1K",
            reasoningEffort: "low"
        })
        saveUserInput("  hello world  ")

        expect(storage.snapshot()).toMatchObject({
            "ai-config": JSON.stringify({
                selectedModel: "gemini-3-flash-preview",
                enabledTools: ["web_search", "mcp"],
                selectedImageSize: "1:1",
                selectedImageResolution: "1K",
                reasoningEffort: "low"
            }),
            "user-input": "  hello world  "
        })
        expect(loadUserInput()).toBe("hello world")

        saveUserInput("   ")
        expect(storage.removeItem).toHaveBeenCalledWith("user-input")
    })

    it("sets both persisted model selections to Luna exactly once", () => {
        const storage = createStorageMock({
            "ai-config": JSON.stringify({
                selectedModel: "gemini-3-flash-preview",
                enabledTools: ["web_search"],
                selectedImageSize: "16:9",
                selectedImageResolution: "2K",
                reasoningEffort: "low"
            }),
            "model-storage": JSON.stringify({
                state: {
                    selectedModel: "gemini-3-flash-preview",
                    enabledTools: ["web_search"]
                },
                version: 0
            })
        })

        setDefaultModelToLunaOnce(storage as unknown as Storage)

        const migrated = storage.snapshot()
        expect(JSON.parse(migrated["ai-config"])).toMatchObject({
            selectedModel: "gpt-5.6-luna",
            enabledTools: ["web_search"],
            selectedImageSize: "16:9"
        })
        expect(JSON.parse(migrated["model-storage"])).toMatchObject({
            state: {
                selectedModel: "gpt-5.6-luna",
                enabledTools: ["web_search"]
            },
            version: 0
        })
        expect(migrated[LUNA_DEFAULT_MODEL_MIGRATION_KEY]).toBe("true")

        storage.setItem(
            "model-storage",
            JSON.stringify({ state: { selectedModel: "gpt-5.6-sol" }, version: 0 })
        )
        setDefaultModelToLunaOnce(storage as unknown as Storage)

        expect(JSON.parse(storage.snapshot()["model-storage"]).state.selectedModel).toBe(
            "gpt-5.6-sol"
        )
    })

    it("leaves new-user model storage untouched", () => {
        const storage = createStorageMock()

        setDefaultModelToLunaOnce(storage as unknown as Storage)

        expect(storage.snapshot()).toEqual({
            [LUNA_DEFAULT_MODEL_MIGRATION_KEY]: "true"
        })
    })
})
