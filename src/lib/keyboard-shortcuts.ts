export const OPEN_MODEL_PICKER_SHORTCUT_EVENT = "silkchat:open-model-picker"

export type ShortcutPlatform = "mac" | "default"
export type ShortcutCategory = "Navigation" | "Sidebar" | "Composer" | "Library"

type ShortcutDisplay = {
    mac: readonly string[]
    default: readonly string[]
}

export type ShortcutDefinition = {
    id: string
    title: string
    category: ShortcutCategory
    context?: string
    description?: string
    display: ShortcutDisplay
}

type ShortcutKeyEvent = Pick<
    KeyboardEvent,
    "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
> & {
    isComposing?: boolean
}

const defineShortcut = <T extends ShortcutDefinition>(shortcut: T) => shortcut

const getSubmitPromptShortcutDisplay = (invertSendNewlineBehavior: boolean): ShortcutDisplay =>
    invertSendNewlineBehavior
        ? {
              mac: ["⌘", "Enter"],
              default: ["Ctrl", "Enter"]
          }
        : {
              mac: ["Enter"],
              default: ["Enter"]
          }

const getInsertPromptNewlineShortcutDisplay = (
    invertSendNewlineBehavior: boolean
): ShortcutDisplay =>
    invertSendNewlineBehavior
        ? {
              mac: ["Enter"],
              default: ["Enter"]
          }
        : {
              mac: ["Shift", "Enter"],
              default: ["Shift", "Enter"]
          }

export const isShortcutModifierPressed = (event: Pick<KeyboardEvent, "metaKey" | "ctrlKey">) =>
    event.metaKey || event.ctrlKey

export const isEditableShortcutTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
        return false
    }

    return (
        target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.closest("[contenteditable='true']") !== null
    )
}

export const isMacLikePlatform = () => {
    if (typeof navigator === "undefined") {
        return false
    }

    return /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform)
}

export const getShortcutPlatform = (isMacLike = isMacLikePlatform()): ShortcutPlatform =>
    isMacLike ? "mac" : "default"

export const SHORTCUTS = {
    toggleSidebar: defineShortcut({
        id: "toggle-sidebar",
        title: "Toggle sidebar",
        category: "Navigation",
        context: "Anywhere",
        display: {
            mac: ["⌘", "B"],
            default: ["Ctrl", "B"]
        }
    }),
    searchChats: defineShortcut({
        id: "search-chats",
        title: "Search chats",
        category: "Navigation",
        context: "Anywhere",
        display: {
            mac: ["⌘", "K"],
            default: ["Ctrl", "K"]
        }
    }),
    newChat: defineShortcut({
        id: "new-chat",
        title: "Start a new chat",
        category: "Navigation",
        context: "Chat sidebar",
        display: {
            mac: ["⌘", "Shift", "O"],
            default: ["Ctrl", "Alt", "O"]
        }
    }),
    openModelPicker: defineShortcut({
        id: "open-model-picker",
        title: "Open model picker",
        category: "Composer",
        context: "Chat view",
        display: {
            mac: ["⌘", "/"],
            default: ["Ctrl", "/"]
        }
    }),
    submitPrompt: defineShortcut({
        id: "submit-prompt",
        title: "Send message",
        category: "Composer",
        context: "Composer",
        display: getSubmitPromptShortcutDisplay(false)
    }),
    insertPromptNewline: defineShortcut({
        id: "insert-prompt-newline",
        title: "New line",
        category: "Composer",
        context: "Composer",
        display: getInsertPromptNewlineShortcutDisplay(false)
    }),
    saveMessageEdit: defineShortcut({
        id: "save-message-edit",
        title: "Save edited message",
        category: "Composer",
        context: "Message editor",
        display: {
            mac: ["⌘", "Enter"],
            default: ["Ctrl", "Enter"]
        }
    }),
    cancelMessageEdit: defineShortcut({
        id: "cancel-message-edit",
        title: "Cancel editing",
        category: "Composer",
        context: "Message editor",
        display: {
            mac: ["Esc"],
            default: ["Esc"]
        }
    }),
    previewSidebarSelection: defineShortcut({
        id: "preview-sidebar-selection",
        title: "Preview selection mode",
        category: "Sidebar",
        context: "Chat sidebar",
        description: "Hold while the pointer is over the sidebar",
        display: {
            mac: ["Alt", "Hover sidebar"],
            default: ["Alt", "Hover sidebar"]
        }
    }),
    deleteCurrentThread: defineShortcut({
        id: "delete-current-thread",
        title: "Delete current thread",
        category: "Sidebar",
        context: "Chat sidebar",
        display: {
            mac: ["⌘", "Shift", "⌫"],
            default: ["Ctrl", "Shift", "Backspace"]
        }
    }),
    previousImage: defineShortcut({
        id: "previous-image",
        title: "Previous image",
        category: "Library",
        context: "Image details",
        display: {
            mac: ["←"],
            default: ["←"]
        }
    }),
    nextImage: defineShortcut({
        id: "next-image",
        title: "Next image",
        category: "Library",
        context: "Image details",
        display: {
            mac: ["→"],
            default: ["→"]
        }
    })
} as const

export const getSubmitPromptShortcut = (invertSendNewlineBehavior = false) =>
    defineShortcut({
        ...SHORTCUTS.submitPrompt,
        display: getSubmitPromptShortcutDisplay(invertSendNewlineBehavior)
    })

export const getInsertPromptNewlineShortcut = (invertSendNewlineBehavior = false) =>
    defineShortcut({
        ...SHORTCUTS.insertPromptNewline,
        display: getInsertPromptNewlineShortcutDisplay(invertSendNewlineBehavior)
    })

export const getShortcutHelpSections = (invertSendNewlineBehavior = false) =>
    [
        {
            title: "Navigation",
            shortcuts: [SHORTCUTS.toggleSidebar, SHORTCUTS.searchChats, SHORTCUTS.newChat]
        },
        {
            title: "Composer",
            shortcuts: [
                SHORTCUTS.openModelPicker,
                getSubmitPromptShortcut(invertSendNewlineBehavior),
                getInsertPromptNewlineShortcut(invertSendNewlineBehavior),
                SHORTCUTS.saveMessageEdit,
                SHORTCUTS.cancelMessageEdit
            ]
        },
        {
            title: "Sidebar",
            shortcuts: [SHORTCUTS.previewSidebarSelection, SHORTCUTS.deleteCurrentThread]
        },
        {
            title: "Library",
            shortcuts: [SHORTCUTS.previousImage, SHORTCUTS.nextImage]
        }
    ] as const

export const SHORTCUT_HELP_SECTIONS = getShortcutHelpSections()

export const getShortcutDisplayTokens = (
    shortcut: ShortcutDefinition,
    platform = getShortcutPlatform()
) => shortcut.display[platform]

export const getShortcutDisplayLabel = (
    shortcut: ShortcutDefinition,
    platform = getShortcutPlatform()
) => getShortcutDisplayTokens(shortcut, platform).join(" + ")

const hasPrimaryModifier = (
    event: Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "shiftKey" | "altKey">,
    {
        allowAlt = false,
        allowShift = false
    }: {
        allowAlt?: boolean
        allowShift?: boolean
    } = {}
) =>
    isShortcutModifierPressed(event) &&
    (allowAlt || !event.altKey) &&
    (allowShift || !event.shiftKey)

export const matchesSidebarToggleShortcut = (event: ShortcutKeyEvent) =>
    event.key.toLowerCase() === "b" && isShortcutModifierPressed(event)

export const matchesSearchChatsShortcut = (event: ShortcutKeyEvent) =>
    event.key.toLowerCase() === "k" && isShortcutModifierPressed(event)

export const matchesOpenModelPickerShortcut = (event: ShortcutKeyEvent) =>
    event.key === "/" && hasPrimaryModifier(event)

export const matchesNewChatShortcut = (event: ShortcutKeyEvent) => {
    if (event.key.toLowerCase() !== "o") {
        return false
    }

    if (event.metaKey) {
        return event.shiftKey && !event.altKey
    }

    return event.ctrlKey && event.altKey && !event.shiftKey
}

export const matchesDeleteCurrentThreadShortcut = (event: ShortcutKeyEvent) =>
    (event.key === "Backspace" || event.key === "Delete") &&
    isShortcutModifierPressed(event) &&
    event.shiftKey

export const matchesSubmitPromptShortcut = (
    event: ShortcutKeyEvent,
    invertSendNewlineBehavior = false
) => {
    if (event.isComposing || event.key !== "Enter") {
        return false
    }

    if (invertSendNewlineBehavior) {
        return hasPrimaryModifier(event)
    }

    return !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey
}

export const matchesInsertPromptNewlineShortcut = (
    event: ShortcutKeyEvent,
    invertSendNewlineBehavior = false
) => {
    if (event.isComposing || event.key !== "Enter") {
        return false
    }

    if (invertSendNewlineBehavior) {
        return !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey
    }

    return event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey
}

export const matchesSaveMessageEditShortcut = (event: ShortcutKeyEvent) =>
    event.key === "Enter" && hasPrimaryModifier(event)

export const matchesCancelMessageEditShortcut = (event: Pick<KeyboardEvent, "key">) =>
    event.key === "Escape"

export const matchesPreviousImageShortcut = (
    event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey">
) => event.key === "ArrowLeft" && !event.altKey && !event.ctrlKey && !event.metaKey

export const matchesNextImageShortcut = (
    event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey">
) => event.key === "ArrowRight" && !event.altKey && !event.ctrlKey && !event.metaKey
