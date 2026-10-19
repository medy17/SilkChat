import {
    continuePromptMarkup,
    diffPromptText,
    getActivePromptFormats,
    getDisabledPromptFormats,
    promptMarkdownLanguage,
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

const toggle = (marked: string, format: PromptFormat) => {
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

    it("leaves the caret where the link URL goes", () => {
        expect(toggle("see «docs» here", "link")).toBe("see [docs](|) here")
        expect(toggle("«https://example.com»", "link")).toBe("[|](https://example.com)")
        expect(toggle("see «[docs](https://x.dev)»", "link")).toBe("see «docs»")
    })

    it("quotes and unquotes every touched line", () => {
        expect(toggle("«one\n\ntwo»", "quote")).toBe("> «one\n>\n> two»")
        expect(toggle("> «one\n> two»", "quote")).toBe("«one\ntwo»")
    })

    it("refuses emphasis inside code, where it would be literal", () => {
        expect(toggle("`a «b» c`", "bold")).toBeNull()
        expect(toggle("```\n«x»\n```", "link")).toBeNull()
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
