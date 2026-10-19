import {
    EditorSelection,
    type EditorState,
    type SelectionRange,
    type TransactionSpec
} from "@codemirror/state"
import { Language, defineLanguageFacet, syntaxTree } from "@codemirror/language"
import type { SyntaxNode } from "@lezer/common"
import { GFM, parser as commonMarkParser } from "@lezer/markdown"

// The composer edits markdown source, so the language only parses for styling; the text
// itself is never rewritten. Built from @lezer/markdown directly because
// @codemirror/lang-markdown eagerly bundles the HTML, CSS, and JavaScript languages.
export const promptMarkdownLanguage = new Language(
    defineLanguageFacet(),
    commonMarkParser.configure(GFM),
    [],
    "markdown"
)

export type PromptFormat = "bold" | "italic" | "strikethrough" | "code" | "link" | "quote"

export const PROMPT_FORMATS: readonly PromptFormat[] = [
    "bold",
    "italic",
    "strikethrough",
    "code",
    "link",
    "quote"
]

type InlineFormat = "bold" | "italic" | "strikethrough" | "code"

const INLINE_FORMATS: Record<InlineFormat, { node: string; mark: string; marker: string }> = {
    bold: { node: "StrongEmphasis", mark: "EmphasisMark", marker: "**" },
    italic: { node: "Emphasis", mark: "EmphasisMark", marker: "*" },
    strikethrough: { node: "Strikethrough", mark: "StrikethroughMark", marker: "~~" },
    code: { node: "InlineCode", mark: "CodeMark", marker: "`" }
}

const CODE_NODES = new Set(["InlineCode", "FencedCode", "CodeBlock"])

// Quote, list, task, and heading markup that formatting should step over, so bolding a
// whole list item yields `- **item**` rather than `**- item**`.
const LINE_PREFIX_PATTERN =
    /^[ \t]*(?:>[ \t]?)*[ \t]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?|#{1,6}[ \t]+)?/
const QUOTED_LINE_PATTERN = /^[ \t]{0,3}>/

const enclosing = (state: EditorState, from: number, to: number, name: string) => {
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(from, 1)
    for (; node; node = node.parent) {
        if (node.name === name && node.from <= from && node.to >= to) return node
    }
    return null
}

const insideCode = (state: EditorState, from: number, to: number) =>
    [...CODE_NODES].some((name) => enclosing(state, from, to, name))

type Segment = { from: number; to: number }

// One trimmed, non-empty span per selected line, with line markup excluded.
const selectedSegments = (state: EditorState, from: number, to: number): Segment[] => {
    const segments: Segment[] = []
    for (let pos = from; pos <= to; ) {
        const line = state.doc.lineAt(pos)
        const prefix = LINE_PREFIX_PATTERN.exec(line.text)?.[0].length ?? 0
        let start = Math.max(from, line.from + prefix)
        let end = Math.min(to, line.to)
        while (start < end && /\s/.test(state.sliceDoc(start, start + 1))) start++
        while (end > start && /\s/.test(state.sliceDoc(end - 1, end))) end--
        if (start < end) segments.push({ from: start, to: end })
        pos = line.to + 1
    }
    return segments
}

const spansLines = (state: EditorState, from: number, to: number) =>
    state.doc.lineAt(from).number !== state.doc.lineAt(to).number

const touchedLines = (state: EditorState, from: number, to: number) => {
    const lines = []
    for (let n = state.doc.lineAt(from).number; n <= state.doc.lineAt(to).number; n++) {
        lines.push(state.doc.line(n))
    }
    return lines
}

const isQuoted = (state: EditorState, from: number, to: number) => {
    const lines = touchedLines(state, from, to).filter((line) => line.text.trim())
    return lines.length > 0 && lines.every((line) => QUOTED_LINE_PATTERN.test(line.text))
}

const inlineEnclosures = (state: EditorState, format: InlineFormat, from: number, to: number) => {
    const { node } = INLINE_FORMATS[format]
    const segments = selectedSegments(state, from, to)
    const nodes = segments.map((segment) => enclosing(state, segment.from, segment.to, node))
    return { segments, nodes }
}

export const getActivePromptFormats = (state: EditorState): Set<PromptFormat> => {
    const { from, to } = state.selection.main
    const active = new Set<PromptFormat>()
    for (const format of ["bold", "italic", "strikethrough"] as const) {
        const { segments, nodes } = inlineEnclosures(state, format, from, to)
        if (segments.length && nodes.every(Boolean)) active.add(format)
    }
    if (insideCode(state, from, to)) active.add("code")
    if (enclosing(state, from, to, "Link")) active.add("link")
    if (isQuoted(state, from, to)) active.add("quote")
    return active
}

// Emphasis and links inside code would be literal characters, so they are unavailable there.
export const getDisabledPromptFormats = (state: EditorState): Set<PromptFormat> => {
    const { from, to } = state.selection.main
    return insideCode(state, from, to)
        ? new Set<PromptFormat>(["bold", "italic", "strikethrough", "link"])
        : new Set<PromptFormat>()
}

type Change = { from: number; to?: number; insert?: string }

const finish = (
    state: EditorState,
    changes: Change[],
    selection?: (map: (pos: number, assoc?: number) => number) => SelectionRange
): TransactionSpec => {
    const changeSet = state.changes(changes)
    return {
        changes: changeSet,
        selection: selection
            ? EditorSelection.create([selection((pos, assoc) => changeSet.mapPos(pos, assoc))])
            : state.selection.map(changeSet),
        userEvent: "input.format",
        scrollIntoView: true
    }
}

const unwrapNodes = (state: EditorState, nodes: SyntaxNode[], mark: string) => {
    const seen = new Set<number>()
    const changes: Change[] = []
    for (const node of nodes) {
        if (seen.has(node.from)) continue
        seen.add(node.from)
        const marks = node.getChildren(mark)
        const open = marks[0]
        const close = marks.length > 1 ? marks[marks.length - 1] : undefined
        if (open) changes.push({ from: open.from, to: open.to })
        if (close) changes.push({ from: close.from, to: close.to })
    }
    return finish(state, changes)
}

const toggleInline = (state: EditorState, format: InlineFormat): TransactionSpec | null => {
    const { from, to } = state.selection.main
    const { mark, marker } = INLINE_FORMATS[format]
    const { segments, nodes } = inlineEnclosures(state, format, from, to)
    const enclosed = nodes.filter((node): node is SyntaxNode => node !== null)

    if (!segments.length) return null
    if (enclosed.length === segments.length) return unwrapNodes(state, enclosed, mark)

    const changes = segments
        .filter((_, index) => !nodes[index])
        .flatMap((segment) => [
            { from: segment.from, insert: marker },
            { from: segment.to, insert: marker }
        ])
    const first = segments[0]
    const last = segments[segments.length - 1]
    return finish(state, changes, (map) =>
        EditorSelection.range(map(first.from, 1), map(last.to, -1))
    )
}

const toggleCodeBlock = (state: EditorState): TransactionSpec | null => {
    const { from, to } = state.selection.main
    const fence = enclosing(state, from, to, "FencedCode")
    if (fence) {
        const open = state.doc.lineAt(fence.from)
        const close = state.doc.lineAt(fence.to)
        const changes: Change[] = [{ from: open.from, to: Math.min(open.to + 1, state.doc.length) }]
        if (close.number !== open.number && /^\s*(`{3,}|~{3,})\s*$/.test(close.text)) {
            changes.push({ from: Math.max(close.from - 1, 0), to: close.to })
        }
        return finish(state, changes)
    }
    const first = state.doc.lineAt(from)
    const last = state.doc.lineAt(to)
    return finish(state, [
        { from: first.from, insert: "```\n" },
        { from: last.to, insert: "\n```" }
    ])
}

const toggleLink = (state: EditorState): TransactionSpec | null => {
    const { from, to } = state.selection.main
    const link = enclosing(state, from, to, "Link")
    if (link) {
        const marks = link.getChildren("LinkMark")
        const open = marks[0]
        const close = marks[1]
        if (!open || !close) return null
        return finish(state, [
            { from: link.from, to: open.to },
            { from: close.from, to: link.to }
        ])
    }
    const [segment] = selectedSegments(state, from, to)
    if (!segment) return null
    const text = state.sliceDoc(segment.from, segment.to)
    if (/^https?:\/\/\S+$/.test(text)) {
        return finish(
            state,
            [
                { from: segment.from, insert: "[](" },
                { from: segment.to, insert: ")" }
            ],
            () => EditorSelection.cursor(segment.from + 1)
        )
    }
    return finish(
        state,
        [
            { from: segment.from, insert: "[" },
            { from: segment.to, insert: "]()" }
        ],
        (map) => EditorSelection.cursor(map(segment.to, 1) - 1)
    )
}

const toggleQuote = (state: EditorState): TransactionSpec => {
    const { from, to } = state.selection.main
    const lines = touchedLines(state, from, to)
    if (isQuoted(state, from, to)) {
        return finish(
            state,
            lines.flatMap((line) => {
                const match = /^([ \t]{0,3})>[ \t]?/.exec(line.text)
                return match
                    ? [{ from: line.from + match[1].length, to: line.from + match[0].length }]
                    : []
            })
        )
    }
    return finish(
        state,
        lines.map((line) => ({ from: line.from, insert: line.text.trim() ? "> " : ">" })),
        (map) => EditorSelection.range(map(from, 1), map(to, 1))
    )
}

export const togglePromptFormat = (
    state: EditorState,
    format: PromptFormat
): TransactionSpec | null => {
    // Formatting applies to selected text; the toolbar and shortcuts need a selection.
    if (state.selection.main.empty || getDisabledPromptFormats(state).has(format)) return null
    const { from, to } = state.selection.main
    switch (format) {
        case "quote":
            return toggleQuote(state)
        case "link":
            return toggleLink(state)
        case "code":
            return enclosing(state, from, to, "FencedCode") || spansLines(state, from, to)
                ? toggleCodeBlock(state)
                : toggleInline(state, "code")
        default:
            return toggleInline(state, format)
    }
}

const LIST_PREFIX_PATTERN =
    /^([ \t]*(?:>[ \t]?)*[ \t]*)(?:([-*+])|(\d{1,9})([.)]))([ \t]+)(\[[ xX]\][ \t]+)?/
const QUOTE_PREFIX_PATTERN = /^[ \t]*(?:>[ \t]?)+/

// A new line inside a list or quote carries its markup forward; on a line holding only
// markup it ends the list or quote instead. Returns null when a plain newline is right.
export const continuePromptMarkup = (state: EditorState): TransactionSpec | null => {
    const range = state.selection.main
    if (!range.empty || insideCode(state, range.head, range.head)) return null
    const line = state.doc.lineAt(range.head)
    const list = LIST_PREFIX_PATTERN.exec(line.text)
    const prefix = list?.[0] ?? QUOTE_PREFIX_PATTERN.exec(line.text)?.[0]
    if (!prefix || range.head < line.from + prefix.length) return null

    if (!line.text.slice(prefix.length).trim()) {
        return {
            changes: { from: line.from, to: line.to },
            selection: EditorSelection.cursor(line.from),
            userEvent: "delete"
        }
    }

    let next = prefix
    if (list) {
        const [, lead, bullet, number, delimiter, space, task] = list
        const marker = bullet ?? `${Number(number) + 1}${delimiter}`
        next = `${lead}${marker}${space}${task ? "[ ] " : ""}`
    }
    const insert = `\n${next}`
    return {
        changes: { from: range.head, insert },
        selection: EditorSelection.cursor(range.head + insert.length),
        userEvent: "input",
        scrollIntoView: true
    }
}

// The smallest single replacement turning `current` into `next`, so outside updates keep
// the caret and undo history anchored to the text that did not change.
export const diffPromptText = (current: string, next: string) => {
    const limit = Math.min(current.length, next.length)
    let start = 0
    while (start < limit && current.charCodeAt(start) === next.charCodeAt(start)) start++
    let end = 0
    while (
        end < limit - start &&
        current.charCodeAt(current.length - 1 - end) === next.charCodeAt(next.length - 1 - end)
    )
        end++
    return {
        from: start,
        to: current.length - end,
        insert: next.slice(start, next.length - end)
    }
}
