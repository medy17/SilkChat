import { describe, expect, it } from "vitest"

import {
    SHORTCUTS,
    SHORTCUT_HELP_SECTIONS,
    getShortcutDisplayTokens,
    matchesDeleteCurrentThreadShortcut,
    matchesNewChatShortcut,
    matchesOpenModelPickerShortcut,
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
                shiftKey: false
            } as KeyboardEvent)
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

    it("groups help items into sidebar sections", () => {
        expect(SHORTCUT_HELP_SECTIONS.map((section) => section.title)).toEqual([
            "Navigation",
            "Composer",
            "Sidebar",
            "Library"
        ])
        expect(SHORTCUT_HELP_SECTIONS[2].shortcuts).toContain(SHORTCUTS.previewSidebarSelection)
    })
})
