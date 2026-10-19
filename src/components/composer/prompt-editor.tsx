import { FloatingSelectionToolbar } from "@/components/selection-toolbar"
import { type LinkEditorAnchor, LinkEditorPopover } from "./link-editor-popover"
import { Button } from "@/components/ui/button"
import {
    matchesFormatBoldShortcut,
    matchesFormatItalicShortcut,
    matchesSubmitPromptShortcut
} from "@/lib/keyboard-shortcuts"
import {
    PROMPT_FORMATS,
    type PromptFormat,
    type PromptLinkDraft,
    applyPromptLink,
    continuePromptMarkup,
    diffPromptText,
    getActivePromptFormats,
    getDisabledPromptFormats,
    getPromptLinkDraft,
    promptMarkdownLanguage,
    removePromptLink,
    togglePromptFormat
} from "@/lib/prompt-markdown"
import {
    type SelectionToolbarPosition,
    getSelectionToolbarPosition
} from "@/lib/selection-toolbar-position"
import { PROMPT_EDITOR_MIN_HEIGHT_CLASS } from "@/lib/prompt-editor-layout"
import { cn } from "@/lib/utils"
import { history, historyKeymap, insertNewline, standardKeymap } from "@codemirror/commands"
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language"
import {
    Annotation,
    Compartment,
    EditorSelection,
    EditorState,
    type Extension,
    type Text,
    type TransactionSpec,
    Prec,
    type Range
} from "@codemirror/state"
import {
    Decoration,
    type DecorationSet,
    EditorView,
    ViewPlugin,
    type ViewUpdate,
    keymap,
    placeholder as placeholderExtension
} from "@codemirror/view"
import { tags } from "@lezer/highlight"
import { Bold, Code, Italic, Link, type LucideIcon, Strikethrough, TextQuote } from "lucide-react"
import {
    type CSSProperties,
    forwardRef,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState
} from "react"

export type PromptEditorHandle = {
    getValue: () => string
    setValue: (value: string) => void
    clear: () => void
    focus: () => void
    blur: () => void
    getElement: () => HTMLElement | null
}

export type PromptEditorProps = {
    value: string
    onChange: (value: string) => void
    // Changing this starts a fresh document and undo history, e.g. when switching threads.
    resetKey?: string
    placeholder?: string
    disabled?: boolean
    maxHeight?: number | string
    className?: string
    onSubmit?: () => void
    disableKeyboardSubmit?: boolean
    invertSendNewlineBehavior?: boolean
    onKeyDown?: (event: KeyboardEvent) => void
    onPaste?: (event: ClipboardEvent) => void
    onFocus?: () => void
    // Visual lines, wrapping included; reported when the count changes.
    onLineCountChange?: (lines: number) => void
}

const FORMAT_CONTROLS: Record<PromptFormat, { label: string; icon: LucideIcon }> = {
    bold: { label: "Bold", icon: Bold },
    italic: { label: "Italic", icon: Italic },
    strikethrough: { label: "Strikethrough", icon: Strikethrough },
    code: { label: "Code", icon: Code },
    link: { label: "Link", icon: Link },
    quote: { label: "Quote", icon: TextQuote }
}

// Matches the toolbar markup below: 26px buttons, 2px gaps, 2px padding, 1px border.
const FORMAT_TOOLBAR_WIDTH_PX = PROMPT_FORMATS.length * 26 + (PROMPT_FORMATS.length - 1) * 2 + 6

type FormatToolbarState = SelectionToolbarPosition & {
    selection: LinkEditorAnchor
    active: Set<PromptFormat>
    disabled: Set<PromptFormat>
}

type LinkEditorState = {
    draft: PromptLinkDraft
    // The document the draft's positions belong to.
    doc: Text
    anchor: LinkEditorAnchor
    side: "top" | "bottom"
}

const externalChange = Annotation.define<boolean>()

const promptHighlightStyle = HighlightStyle.define([
    { tag: tags.strong, fontWeight: "600" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strikethrough, textDecoration: "line-through" },
    {
        tag: [
            tags.heading1,
            tags.heading2,
            tags.heading3,
            tags.heading4,
            tags.heading5,
            tags.heading6
        ],
        fontWeight: "600"
    },
    { tag: tags.monospace, fontFamily: "var(--font-mono)", fontSize: "0.9em" },
    { tag: tags.link, textDecoration: "underline", textUnderlineOffset: "2px" },
    {
        tag: [
            tags.processingInstruction,
            tags.url,
            tags.labelName,
            tags.contentSeparator,
            tags.atom,
            tags.quote
        ],
        color: "var(--muted-foreground)"
    }
])

const promptEditorTheme = EditorView.theme({
    "&": {
        color: "inherit",
        backgroundColor: "transparent",
        fontSize: "inherit",
        height: "var(--prompt-editor-height, auto)",
        maxHeight: "var(--prompt-editor-max-height)"
    },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
        fontFamily: "inherit",
        lineHeight: "inherit",
        overflowY: "auto"
    },
    ".cm-content": {
        minHeight: "var(--prompt-editor-min-height, auto)",
        padding: "var(--prompt-editor-padding, 0.5rem 0.75rem)",
        caretColor: "currentColor"
    },
    ".cm-line": { padding: "0" },
    ".cm-placeholder": { color: "var(--muted-foreground)" },
    ".cm-md-inline-code": {
        backgroundColor: "var(--muted)",
        borderRadius: "var(--radius-sm)",
        padding: "0.1em 0.25em"
    },
    ".cm-md-code-line": {
        backgroundColor: "var(--muted)",
        fontFamily: "var(--font-mono)",
        fontSize: "0.9em",
        padding: "0 0.5rem"
    },
    ".cm-md-code-first": {
        borderTopLeftRadius: "var(--radius-sm)",
        borderTopRightRadius: "var(--radius-sm)"
    },
    ".cm-md-code-last": {
        borderBottomLeftRadius: "var(--radius-sm)",
        borderBottomRightRadius: "var(--radius-sm)"
    },
    ".cm-md-quote-line": {
        boxShadow: "inset 2px 0 0 var(--border)",
        paddingLeft: "0.75rem"
    }
})

const inlineCodeMark = Decoration.mark({ class: "cm-md-inline-code" })
const quoteLine = Decoration.line({ class: "cm-md-quote-line" })

// Block and inline-code backgrounds the highlighter can't draw, for visible lines only.
const buildBlockDecorations = (view: EditorView): DecorationSet => {
    const ranges: Range<Decoration>[] = []
    const { doc } = view.state
    for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            from,
            to,
            enter: (node) => {
                if (node.name === "InlineCode") {
                    ranges.push(inlineCodeMark.range(node.from, node.to))
                    return false
                }
                if (node.name === "FencedCode" || node.name === "CodeBlock") {
                    const first = doc.lineAt(node.from).number
                    const last = doc.lineAt(node.to).number
                    for (let n = first; n <= last; n++) {
                        const classes = ["cm-md-code-line"]
                        if (n === first) classes.push("cm-md-code-first")
                        if (n === last) classes.push("cm-md-code-last")
                        ranges.push(
                            Decoration.line({ class: classes.join(" ") }).range(doc.line(n).from)
                        )
                    }
                    return false
                }
                if (node.name === "Blockquote") {
                    const last = doc.lineAt(node.to).number
                    for (let n = doc.lineAt(node.from).number; n <= last; n++) {
                        ranges.push(quoteLine.range(doc.line(n).from))
                    }
                }
            }
        })
    }
    return Decoration.set(ranges, true)
}

const blockDecorations = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet
        constructor(view: EditorView) {
            this.decorations = buildBlockDecorations(view)
        }
        update(update: ViewUpdate) {
            if (
                update.docChanged ||
                update.viewportChanged ||
                syntaxTree(update.startState) !== syntaxTree(update.state)
            )
                this.decorations = buildBlockDecorations(update.view)
        }
    },
    { decorations: (plugin) => plugin.decorations }
)

const readToolbarState = (view: EditorView): FormatToolbarState | null => {
    const range = view.state.selection.main
    if (!view.hasFocus || range.empty || view.state.readOnly) return null
    const start = view.coordsAtPos(range.from, 1)
    const end = view.coordsAtPos(range.to, -1)
    if (!start || !end) return null
    const scroller = view.scrollDOM.getBoundingClientRect()
    const top = Math.max(start.top, scroller.top)
    const bottom = Math.min(end.bottom, scroller.bottom)
    if (bottom < scroller.top || top > scroller.bottom) return null
    const singleLine =
        view.state.doc.lineAt(range.from).number === view.state.doc.lineAt(range.to).number
    const content = view.contentDOM.getBoundingClientRect()
    const left = singleLine ? start.left : content.left
    const right = singleLine ? end.right : content.right
    return {
        ...getSelectionToolbarPosition(
            { top, bottom, left, width: right - left },
            FORMAT_TOOLBAR_WIDTH_PX,
            { width: window.innerWidth, height: window.innerHeight }
        ),
        selection: { top, left, width: right - left, height: bottom - top },
        active: getActivePromptFormats(view.state),
        disabled: getDisabledPromptFormats(view.state)
    }
}

const requestToolbarMeasure = (
    view: EditorView,
    write: (toolbar: FormatToolbarState | null) => void
) => view.requestMeasure({ key: "prompt-format-toolbar", read: readToolbarState, write })

const applyFormat = (view: EditorView, format: Exclude<PromptFormat, "link">) => {
    if (view.state.readOnly) return
    const spec = togglePromptFormat(view.state, format)
    if (spec) view.dispatch(spec)
    view.focus()
}

const placeholderConfig = (text?: string) =>
    text
        ? [placeholderExtension(text), EditorView.contentAttributes.of({ "aria-label": text })]
        : []

const editableConfig = (disabled?: boolean) => [
    EditorView.editable.of(!disabled),
    EditorState.readOnly.of(Boolean(disabled))
]

export const PromptEditor = forwardRef<PromptEditorHandle, PromptEditorProps>(
    function PromptEditor(props, ref) {
        const { value, resetKey, placeholder, disabled, maxHeight = 240, className } = props
        const hostRef = useRef<HTMLDivElement>(null)
        const viewRef = useRef<EditorView | null>(null)
        const latestProps = useRef(props)
        latestProps.current = props
        const resetDocumentRef = useRef<((doc: string) => void) | null>(null)
        const resetKeyRef = useRef(resetKey)
        const [placeholderCompartment] = useState(() => new Compartment())
        const [editableCompartment] = useState(() => new Compartment())
        const [toolbar, setToolbar] = useState<FormatToolbarState | null>(null)
        const [linkEditor, setLinkEditor] = useState<LinkEditorState | null>(null)
        const closeLinkEditor = (refocus: boolean) => {
            setLinkEditor(null)
            if (refocus) viewRef.current?.focus()
        }
        // Applies a link edit only to the document it was opened on.
        const commitLink = (spec: () => TransactionSpec) => {
            const view = viewRef.current
            if (view && linkEditor && view.state.doc === linkEditor.doc && !view.state.readOnly)
                view.dispatch(spec())
            closeLinkEditor(true)
        }

        useLayoutEffect(() => {
            const host = hostRef.current
            if (!host) return

            const measureToolbar = (view: EditorView) => requestToolbarMeasure(view, setToolbar)

            let lineCount = -1
            const measureLineCount = (view: EditorView) =>
                view.requestMeasure({
                    key: "prompt-line-count",
                    read: (view) =>
                        Math.round(
                            view.lineBlockAt(view.state.doc.length).bottom / view.defaultLineHeight
                        ),
                    write: (lines) => {
                        if (lines === lineCount) return
                        lineCount = lines
                        latestProps.current.onLineCountChange?.(lines)
                    }
                })

            const handleKeyDown = (event: KeyboardEvent, view: EditorView) => {
                const current = latestProps.current
                current.onKeyDown?.(event)
                if (event.defaultPrevented) return true
                if (event.isComposing || view.composing || view.state.readOnly) return false

                if (!view.state.selection.main.empty) {
                    const format = matchesFormatBoldShortcut(event)
                        ? "bold"
                        : matchesFormatItalicShortcut(event)
                          ? "italic"
                          : null
                    if (format) {
                        // Keeps ⌘B from also toggling the sidebar while text is selected.
                        event.stopPropagation()
                        applyFormat(view, format)
                        return true
                    }
                }

                if (
                    current.onSubmit &&
                    !current.disableKeyboardSubmit &&
                    matchesSubmitPromptShortcut(event, current.invertSendNewlineBehavior)
                ) {
                    current.onSubmit()
                    return true
                }

                if (event.key === "Enter" && !event.ctrlKey && !event.metaKey && !event.altKey) {
                    const spec = continuePromptMarkup(view.state)
                    if (spec) view.dispatch(spec)
                    else insertNewline(view)
                    return true
                }
                return false
            }

            const extensions: Extension[] = [
                Prec.highest(keymap.of([{ any: (view, event) => handleKeyDown(event, view) }])),
                history(),
                keymap.of([...historyKeymap, ...standardKeymap]),
                promptMarkdownLanguage,
                syntaxHighlighting(promptHighlightStyle),
                blockDecorations,
                promptEditorTheme,
                EditorView.lineWrapping,
                EditorView.contentAttributes.of({
                    spellcheck: "true",
                    autocorrect: "on",
                    autocapitalize: "sentences"
                }),
                EditorView.domEventHandlers({
                    paste: (event) => {
                        latestProps.current.onPaste?.(event)
                        return event.defaultPrevented
                    },
                    // Files belong to the composer's drop target, not to the text.
                    drop: (event) => Boolean(event.dataTransfer?.files.length),
                    focus: () => {
                        latestProps.current.onFocus?.()
                    }
                }),
                EditorView.updateListener.of((update) => {
                    if (
                        update.docChanged &&
                        !update.transactions.some((tr) => tr.annotation(externalChange))
                    )
                        latestProps.current.onChange(update.state.doc.toString())
                    if (update.docChanged || update.geometryChanged) measureLineCount(update.view)
                    if (
                        update.selectionSet ||
                        update.docChanged ||
                        update.focusChanged ||
                        update.geometryChanged
                    )
                        measureToolbar(update.view)
                })
            ]

            const createState = (doc: string) => {
                const current = latestProps.current
                return EditorState.create({
                    doc,
                    selection: EditorSelection.cursor(doc.length),
                    extensions: [
                        ...extensions,
                        placeholderCompartment.of(placeholderConfig(current.placeholder)),
                        editableCompartment.of(editableConfig(current.disabled))
                    ]
                })
            }

            const view = new EditorView({
                parent: host,
                state: createState(latestProps.current.value)
            })
            viewRef.current = view
            measureLineCount(view)

            // A fresh state with its own undo history. setState bypasses update listeners,
            // so the line count and toolbar are refreshed here.
            resetDocumentRef.current = (doc) => {
                view.setState(createState(doc))
                setToolbar(null)
                measureLineCount(view)
            }
            return () => {
                resetDocumentRef.current = null
                view.destroy()
                viewRef.current = null
                setToolbar(null)
            }
        }, [placeholderCompartment, editableCompartment])

        useEffect(() => {
            const view = viewRef.current
            if (!view) return
            if (resetKey !== resetKeyRef.current) {
                resetKeyRef.current = resetKey
                resetDocumentRef.current?.(value)
                return
            }
            const current = view.state.doc.toString()
            if (current === value) return
            view.dispatch({
                changes: diffPromptText(current, value),
                annotations: externalChange.of(true),
                ...(view.hasFocus ? {} : { selection: EditorSelection.cursor(value.length) })
            })
        }, [resetKey, value])

        // Page scrolls and resizes only move a toolbar that is showing.
        const toolbarVisible = toolbar !== null
        useEffect(() => {
            const view = viewRef.current
            if (!toolbarVisible || !view) return
            const remeasure = () => requestToolbarMeasure(view, setToolbar)
            window.addEventListener("resize", remeasure)
            window.addEventListener("scroll", remeasure, { capture: true, passive: true })
            return () => {
                window.removeEventListener("resize", remeasure)
                window.removeEventListener("scroll", remeasure, { capture: true })
            }
        }, [toolbarVisible])

        useEffect(() => {
            viewRef.current?.dispatch({
                effects: placeholderCompartment.reconfigure(placeholderConfig(placeholder))
            })
        }, [placeholder, placeholderCompartment])

        useEffect(() => {
            viewRef.current?.dispatch({
                effects: editableCompartment.reconfigure(editableConfig(disabled))
            })
        }, [disabled, editableCompartment])

        useImperativeHandle(ref, () => {
            // Like assigning a textarea's value: no change event, caret at the end.
            const setValue = (next: string) => {
                const view = viewRef.current
                if (!view) return
                const current = view.state.doc.toString()
                view.dispatch({
                    changes: diffPromptText(current, next),
                    selection: EditorSelection.cursor(next.length),
                    annotations: externalChange.of(true),
                    scrollIntoView: true
                })
            }
            return {
                getValue: () => viewRef.current?.state.doc.toString() ?? "",
                setValue,
                // After a send, undo shouldn't bring the sent prompt back.
                clear: () => resetDocumentRef.current?.(""),
                focus: () => viewRef.current?.focus(),
                blur: () => viewRef.current?.contentDOM.blur(),
                getElement: () => viewRef.current?.contentDOM ?? null
            }
        }, [])

        return (
            <>
                <div
                    ref={hostRef}
                    data-slot="prompt-editor"
                    className={cn(
                        "w-full min-w-0 text-base text-foreground md:text-sm",
                        PROMPT_EDITOR_MIN_HEIGHT_CLASS,
                        disabled && "cursor-not-allowed opacity-50",
                        className
                    )}
                    style={
                        {
                            "--prompt-editor-max-height":
                                typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight
                        } as CSSProperties
                    }
                />
                {toolbar && !linkEditor && (
                    <FloatingSelectionToolbar position={toolbar}>
                        <div
                            role="toolbar"
                            aria-label="Formatting"
                            className="glass-surface pointer-events-auto flex h-8 items-center gap-0.5 rounded-[var(--radius-md)] border p-0.5 text-foreground"
                        >
                            {PROMPT_FORMATS.map((format) => {
                                const { label, icon: Icon } = FORMAT_CONTROLS[format]
                                return (
                                    <Button
                                        key={format}
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        aria-label={label}
                                        aria-pressed={toolbar.active.has(format)}
                                        title={label}
                                        disabled={toolbar.disabled.has(format)}
                                        className="size-6.5 rounded-[var(--radius-sm)] hover:bg-accent aria-pressed:bg-accent"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => {
                                            const view = viewRef.current
                                            if (!view) return
                                            if (format !== "link") {
                                                applyFormat(view, format)
                                                return
                                            }
                                            const draft = getPromptLinkDraft(view.state)
                                            if (draft)
                                                setLinkEditor({
                                                    draft,
                                                    doc: view.state.doc,
                                                    anchor: toolbar.selection,
                                                    side:
                                                        toolbar.placement === "above"
                                                            ? "top"
                                                            : "bottom"
                                                })
                                        }}
                                    >
                                        <Icon className="size-4" />
                                    </Button>
                                )
                            })}
                        </div>
                    </FloatingSelectionToolbar>
                )}
                {linkEditor && (
                    <LinkEditorPopover
                        anchor={linkEditor.anchor}
                        side={linkEditor.side}
                        draft={linkEditor.draft}
                        onSave={(link) => commitLink(() => applyPromptLink(linkEditor.draft, link))}
                        onRemove={() => commitLink(() => removePromptLink(linkEditor.draft))}
                        onDismiss={closeLinkEditor}
                    />
                )}
            </>
        )
    }
)
