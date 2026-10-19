import {
    applyPromptLink,
    continuePromptMarkup,
    diffPromptText,
    getActivePromptFormats,
    getDisabledPromptFormats,
    getPromptLinkDraft,
    normalizePromptLinkUrl,
    promptMarkdownLanguage,
    removePromptLink,
    togglePromptFormat,
    type PromptFormat
} from "@/lib/prompt-markdown"
import { EditorSelection, EditorState } from "@codemirror/state"
import { describe, expect, it } from "vitest"

// `«` and `»` mark the selection; a lone `|` marks the caret.
const stateOf = (marked: string) => {
    const caret = marked.indexOf("|")
    const doc = marked.replace(/[«»|]/g, "")
    const selection =
        caret >= 0
            ? EditorSelection.cursor(caret)
            : EditorSelection.range(marked.indexOf("«"), marked.indexOf("»") - 1)
    return EditorState.create({ doc, selection, extensions: [promptMarkdownLanguage] })
}

const show = (state: EditorState) => {
    const { from, to } = state.selection.main
    const doc = state.doc.toString()
    if (from === to) return `${doc.slice(0, from)}|${doc.slice(from)}`
    return `${doc.slice(0, from)}«${doc.slice(from, to)}»${doc.slice(to)}`
}

const toggle = (marked: string, format: Exclude<PromptFormat, "link">) => {
    const state = stateOf(marked)
    const spec = togglePromptFormat(state, format)
    return spec ? show(state.update(spec).state) : null
}

describe("togglePromptFormat", () => {
    it("wraps a selection and unwraps it again", () => {
        expect(toggle("make «this» bold", "bold")).toBe("make **«this»** bold")
        expect(toggle("make **«this»** bold", "bold")).toBe("make «this» bold")
        expect(toggle("make «**this**» bold", "bold")).toBe("make «this» bold")
    })

    it("keeps whitespace and line markup outside the markers", () => {
        expect(toggle("«- item one »", "bold")).toBe("- **«item one»** ")
        expect(toggle("«> quoted\n> more»", "italic")).toBe("> *«quoted*\n> *more»*")
    })

    it("tells italic and bold apart when nested", () => {
        expect(toggle("***«both»***", "italic")).toBe("**«both»**")
        expect(toggle("***«both»***", "bold")).toBe("*«both»*")
    })

    it("does nothing without a selection", () => {
        expect(toggle("say |", "strikethrough")).toBeNull()
        expect(toggle("say «  »", "bold")).toBeNull()
    })

    it("uses inline code for one line and a fence for several", () => {
        expect(toggle("call «run()» now", "code")).toBe("call `«run()»` now")
        expect(toggle("«a = 1\nb = 2»", "code")).toBe("```\n«a = 1\nb = 2»\n```")
        expect(toggle("```\n«a = 1»\n```", "code")).toBe("«a = 1»")
    })

    it("quotes and unquotes every touched line", () => {
        expect(toggle("«one\n\ntwo»", "quote")).toBe("> «one\n>\n> two»")
        expect(toggle("> «one\n> two»", "quote")).toBe("«one\ntwo»")
    })

    it("refuses emphasis inside code, where it would be literal", () => {
        expect(toggle("`a «b» c`", "bold")).toBeNull()
        expect(getPromptLinkDraft(stateOf("```\n«x»\n```"))).toBeNull()
    })
})

describe("link editing", () => {
    const link = (marked: string, fields: { text: string; url: string }) => {
        const state = stateOf(marked)
        const draft = getPromptLinkDraft(state)
        return draft ? show(state.update(applyPromptLink(draft, fields)).state) : null
    }

    it("opens with the selected text, or a selected URL in the URL field", () => {
        expect(getPromptLinkDraft(stateOf("see «docs» here"))).toMatchObject({
            text: "docs",
            url: "",
            existing: false
        })
        expect(getPromptLinkDraft(stateOf("«https://x.dev/a»"))).toMatchObject({
            text: "",
            url: "https://x.dev/a"
        })
    })

    it("opens an existing link for editing from anywhere inside it", () => {
        expect(getPromptLinkDraft(stateOf("see [do«c»s](https://x.dev) here"))).toMatchObject({
            from: 4,
            to: 25,
            text: "docs",
            url: "https://x.dev",
            existing: true
        })
    })

    it("writes the link and leaves the caret after it", () => {
        expect(link("see «docs» here", { text: "docs", url: "x.dev" })).toBe(
            "see [docs](https://x.dev)| here"
        )
        expect(link("see [«docs»](https://old.dev)", { text: "new", url: "https://new.dev" })).toBe(
            "see [new](https://new.dev)|"
        )
    })

    it("keeps the markdown intact for awkward text and URLs", () => {
        expect(link("«a»", { text: "[draft]", url: "https://x.dev/a b" })).toBe(
            "[\\[draft\\]](<https://x.dev/a b>)|"
        )
        expect(link("«https://x.dev»", { text: "", url: "https://x.dev" })).toBe(
            "[https://x.dev](https://x.dev)|"
        )
    })

    it("removes a link, keeping its text", () => {
        const state = stateOf("see [«docs»](https://x.dev) here")
        const draft = getPromptLinkDraft(state)
        expect(draft && show(state.update(removePromptLink(draft)).state)).toBe("see docs| here")
    })

    it("can't link across lines", () => {
        expect(getDisabledPromptFormats(stateOf("«one\ntwo»")).has("link")).toBe(true)
    })
})

describe("normalizePromptLinkUrl", () => {
    it("adds a scheme only where one is missing", () => {
        expect(normalizePromptLinkUrl(" example.com/a ")).toBe("https://example.com/a")
        expect(normalizePromptLinkUrl("localhost:3000")).toBe("https://localhost:3000")
        expect(normalizePromptLinkUrl("me@example.com")).toBe("mailto:me@example.com")
        expect(normalizePromptLinkUrl("http://x.dev")).toBe("http://x.dev")
        expect(normalizePromptLinkUrl("/docs#intro")).toBe("/docs#intro")
    })
})

describe("active and disabled formats", () => {
    it("reports formats enclosing the selection", () => {
        const active = getActivePromptFormats(stateOf("> **_«x»_**"))
        expect([...active].sort()).toEqual(["bold", "italic", "quote"])
    })

    it("disables emphasis and links inside code only", () => {
        expect([...getDisabledPromptFormats(stateOf("`«x»`"))].sort()).toEqual([
            "bold",
            "italic",
            "link",
            "strikethrough"
        ])
        expect(getDisabledPromptFormats(stateOf("«x»")).size).toBe(0)
    })
})

describe("continuePromptMarkup", () => {
    const enter = (marked: string) => {
        const state = stateOf(marked)
        const spec = continuePromptMarkup(state)
        return spec ? show(state.update(spec).state) : null
    }

    it("carries list, task, and quote markup to the next line", () => {
        expect(enter("- one|")).toBe("- one\n- |")
        expect(enter("9) nine|")).toBe("9) nine\n10) |")
        expect(enter("- [x] done|")).toBe("- [x] done\n- [ ] |")
        expect(enter("> quote|")).toBe("> quote\n> |")
    })

    it("ends the list on a line holding only markup", () => {
        expect(enter("- one\n- |")).toBe("- one\n|")
    })

    it("leaves plain lines and code blocks to a normal newline", () => {
        expect(enter("plain|")).toBeNull()
        expect(enter("```\n- not a list|\n```")).toBeNull()
    })
})

describe("diffPromptText", () => {
    it("replaces only the changed middle", () => {
        expect(diffPromptText("hello world", "hello brave world")).toEqual({
            from: 6,
            to: 6,
            insert: "brave "
        })
        expect(diffPromptText("aaa", "a")).toEqual({ from: 1, to: 3, insert: "" })
        expect(diffPromptText("", "new")).toEqual({ from: 0, to: 0, insert: "new" })
    })
})
