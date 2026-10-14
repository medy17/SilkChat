import { SILK_APP_LANGUAGE } from "./protocol"

export type SilkAppContentSegment =
    | { type: "markdown"; content: string }
    | { type: "silk-app"; code: string; complete: boolean }

// A backtick fence's info string can't hold a backtick; "```js``` is…" is inline code.
const FENCE_OPEN = /^( {0,3})(?:(`{3,})(?!.*`)|(~{3,}))[ \t]*([^\s`]*)/

/**
 * Lifts top-level `silk-app` fences out of a message so they render outside Streamdown.
 * Streamdown builds a different tree for streaming and static mode, so anything inside
 * it remounts when a reply finishes or stops; a running app would restart. Fences nested
 * in another fence stay code.
 */
export const splitSilkAppContent = (content: string): SilkAppContentSegment[] => {
    if (!content.includes(SILK_APP_LANGUAGE)) return [{ type: "markdown", content }]

    const segments: SilkAppContentSegment[] = []
    let markdown: string[] = []
    let fence: { marker: string; app: boolean; body: string[] } | null = null

    const flushMarkdown = () => {
        const text = markdown.join("\n")
        if (text.trim()) segments.push({ type: "markdown", content: text })
        markdown = []
    }

    for (const line of content.split("\n")) {
        if (!fence) {
            const open = FENCE_OPEN.exec(line)
            if (!open) {
                markdown.push(line)
                continue
            }
            // An indented fence belongs to a list item; lifting it out would break the
            // list, so it stays in the Markdown and renders there.
            const app = open[1] === "" && open[4] === SILK_APP_LANGUAGE
            fence = { marker: open[2] ?? open[3], app, body: [] }
            if (app) flushMarkdown()
            else markdown.push(line)
            continue
        }

        // A closing fence repeats the opening character at least as many times.
        const trimmed = line.trim()
        const closes =
            line.length - line.trimStart().length <= 3 &&
            trimmed.length >= fence.marker.length &&
            [...trimmed].every((char) => char === fence?.marker[0])

        if (closes) {
            if (fence.app) {
                segments.push({ type: "silk-app", code: fence.body.join("\n"), complete: true })
            } else {
                markdown.push(line)
            }
            fence = null
            continue
        }

        if (fence.app) fence.body.push(line)
        else markdown.push(line)
    }

    flushMarkdown()
    if (fence?.app) {
        segments.push({ type: "silk-app", code: fence.body.join("\n"), complete: false })
    }
    return segments
}

/** A fence that can hold `code`, longer than any backtick run inside it. */
export const fenceCode = (code: string, language: string) => {
    const longestRun = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length))
    const marker = "`".repeat(Math.max(3, longestRun + 1))
    return `${marker}${language}\n${code}\n${marker}`
}
