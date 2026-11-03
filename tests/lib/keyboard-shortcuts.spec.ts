import { describe, expect, it } from "vitest"

import {
    SHORTCUTS,
    getShortcutDisplayTokens,
    getShortcutHelpSections,
    matchesFocusComposerShortcut,
    matchesDeleteCurrentThreadShortcut,
    matchesInsertPromptNewlineShortcut,
    matchesNewChatShortcut,
    matchesOpenModelPickerShortcut,
    matchesPasteAsTextShortcut,
    matchesSearchChatsShortcut,
    matchesSidebarToggleShortcut,
    matchesSubmitPromptShortcut
} from "@/lib/keyboard-shortcuts"

describe("keyboard-shortcuts", () => {
    it("returns platform-specific shortcut tokens", () => {
        expect(getShortcutDisplayTokens(SHORTCUTS.toggleSidebar, "mac")).toEqual(["⌘", "B"])
        expect(getShortcutDisplayTokens(SHORTCUTS.newChat, "default")).toEqual(["Ctrl", "Alt", "O"])
    })

    it("matches shared navigation shortcuts", () => {
        expect(
            matchesSidebarToggleShortcut({
                key: "b",
                metaKey: false,
                ctrlKey: true,
                shiftKey: false,
                altKey: false
            } as KeyboardEvent)
        ).toBe(true)

        expect(
            matchesSearchChatsShortcut({
                key: "K",
                metaKey: true,
                ctrlKey: false,
                shiftKey: false,
                altKey: false
            } as KeyboardEvent)
        ).toBe(true)

        expect(
            matchesOpenModelPickerShortcut({
                key: "/",
                metaKey: false,
                ctrlKey: true,
                shiftKey: false,
                altKey: false
            } as KeyboardEvent)
        ).toBe(true)
    })

    it("matches platform-specific new chat shortcuts", () => {
        expect(
            matchesNewChatShortcut({
                key: "o",
                metaKey: true,
                ctrlKey: false,
                shiftKey: true,
                altKey: false
            } as KeyboardEvent)
        ).toBe(true)

        expect(
            matchesNewChatShortcut({
                key: "o",
                metaKey: false,
                ctrlKey: true,
                shiftKey: false,
                altKey: true
            } as KeyboardEvent)
        ).toBe(true)

        expect(
            matchesNewChatShortcut({
                key: "o",
                metaKey: false,
                ctrlKey: true,
                shiftKey: true,
                altKey: false
            } as KeyboardEvent)
        ).toBe(false)
    })

    it("matches contextual composer and sidebar shortcuts", () => {
        expect(
            matchesSubmitPromptShortcut({
                key: "Enter",
                shiftKey: false,
                altKey: false,
                ctrlKey: false,
                metaKey: false,
                isComposing: false
            } as KeyboardEvent)
        ).toBe(true)

        expect(
            matchesSubmitPromptShortcut(
                {
                    key: "Enter",
                    shiftKey: false,
                    altKey: false,
                    ctrlKey: true,
                    metaKey: false,
                    isComposing: false
                } as KeyboardEvent,
                true
            )
        ).toBe(true)

        expect(
            matchesInsertPromptNewlineShortcut(
                {
                    key: "Enter",
                    shiftKey: false,
                    altKey: false,
                    ctrlKey: false,
                    metaKey: false,
                    isComposing: false
                } as KeyboardEvent,
                true
            )
        ).toBe(true)

        expect(
            matchesDeleteCurrentThreadShortcut({
                key: "Delete",
                metaKey: false,
                ctrlKey: true,
                shiftKey: true,
                altKey: false
            } as KeyboardEvent)
        ).toBe(true)
    })

    it("focuses the composer on a bare slash, leaving Ctrl + / to the model picker", () => {
        const slash = (modifiers: Partial<KeyboardEvent>) =>
            matchesFocusComposerShortcut({
                key: "/",
                metaKey: false,
                ctrlKey: false,
                shiftKey: false,
                altKey: false,
                ...modifiers
            } as KeyboardEvent)

        expect(slash({})).toBe(true)
        expect(slash({ shiftKey: true })).toBe(true)
        expect(slash({ ctrlKey: true })).toBe(false)
        expect(slash({ metaKey: true })).toBe(false)
    })

    it("matches paste as text on the plain-text paste keys, Safari's included", () => {
        const keys = (modifiers: Partial<KeyboardEvent>) =>
            matchesPasteAsTextShortcut({
                key: "V",
                metaKey: false,
                ctrlKey: false,
                shiftKey: false,
                altKey: false,
                ...modifiers
            } as KeyboardEvent)

        expect(keys({ ctrlKey: true, shiftKey: true })).toBe(true)
        expect(keys({ metaKey: true, shiftKey: true, altKey: true })).toBe(true)
        expect(keys({ ctrlKey: true })).toBe(false)
        expect(
            getShortcutHelpSections()
                .find((section) => section.title === "Composer")
                ?.shortcuts.some((shortcut) => shortcut.id === "paste-as-text")
        ).toBe(true)
    })

    it("swaps composer shortcut labels when enter behavior is inverted", () => {
        const composerSection = getShortcutHelpSections(true).find(
            (section) => section.title === "Composer"
        )

        expect(
            composerSection?.shortcuts.find((shortcut) => shortcut.id === "submit-prompt")
        ).toMatchObject({
            display: {
                mac: ["⌘", "Enter"],
                default: ["Ctrl", "Enter"]
            }
        })

        expect(
            composerSection?.shortcuts.find((shortcut) => shortcut.id === "insert-prompt-newline")
        ).toMatchObject({
            display: {
                mac: ["Enter"],
                default: ["Enter"]
            }
        })
    })
})
