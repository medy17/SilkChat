// Models write math every way LaTeX allows: $$…$$, \[…\], \(…\), $…$, and bare
// \begin{aligned} blocks. The renderer parses each Markdown block on its own, and a math line
// that looks like Markdown ("+ 2x", "- y", "=", "---") would otherwise start a list, heading,
// or rule mid-equation. Display math is rewritten as a $$ fence on its own lines, which the
// block splitter keeps whole, and inline math that spans lines is joined onto one.

const SINGLE_DOLLAR_BLOCK_PATTERN = /(^|\n)([ \t]*)\$[ \t]*\n([\s\S]*?)\n[ \t]*\$([ \t]*(?=\n|$))/g

const looksLikeMath = (value: string) => {
    const expression = value.trim()

    if (!expression) return false

    return (
        /^\d+(?:[.,]\d+)?$/.test(expression) ||
        /\\[A-Za-z]+/.test(expression) ||
        /[_^{}]/.test(expression) ||
        /[=<>±≤≥≈≠∞∑∏√∫]/.test(expression) ||
        /^\([A-Za-z0-9_,\s+\-*/^{}\\]+\)$/.test(expression) ||
        /[A-Za-z0-9)]\s*[+\-*/]\s*[A-Za-z0-9(\\]/.test(expression) ||
        /^[A-Za-z](?:\s*[+\-*/=]\s*[A-Za-z0-9\\{(]|[_^])?/.test(expression)
    )
}

// Fenced blocks, closed or still streaming, and single-line inline code spans. A backtick
// fence's info string can't hold a backtick, so "```js``` is…" stays inline code.
const FENCED_CODE_PATTERN =
    /(^|\n)( {0,3})(`{3,}|~{3,})(?:(?<=`)[^`\n]*|(?<=~)[^\n]*)(?:\n[\s\S]*?)?(?:\n {0,3}\3[`~]*[ \t]*(?=\n|$)|$)/g
const INLINE_CODE_PATTERN = /(`+)[^`\n](?:[^\n]*?[^`\n])?\1(?!`)/g

// Held text is swapped for a private-use placeholder so later passes can't rewrite it.
const createHolder = (open: string, close: string) => {
    const held: string[] = []
    const pattern = new RegExp(`${open}(\\d+)${close}`, "g")
    return {
        hold: (value: string) => `${open}${held.push(value) - 1}${close}`,
        restore: (value: string) =>
            value.replace(pattern, (_match, index: string) => held[Number(index)])
    }
}

// Dollar signs in code are code: a template literal such as `${a} to ${b}` would
// otherwise read as inline math and come out as `$${a} to $${b}`.
const protectCode = (content: string) => {
    const { hold, restore } = createHolder("", "")
    const text = content
        .replace(
            FENCED_CODE_PATTERN,
            (match, prefix: string) => `${prefix}${hold(match.slice(prefix.length))}`
        )
        .replace(INLINE_CODE_PATTERN, (match) => hold(match))
    return { text, restore }
}

const MATH_ENVIRONMENTS =
    "equation|align|alignat|aligned|alignedat|gather|gathered|multline|split|eqnarray|cases|rcases|array|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|smallmatrix|CD"
const BARE_ENVIRONMENT_PATTERN = new RegExp(`\\\\begin\\{(${MATH_ENVIRONMENTS})(\\*?)\\}`, "y")
// Blockquote markers, indentation, and an optional list marker ahead of a line's content.
const LINE_PREFIX_PATTERN = /^((?:[ \t]*>)*[ \t]*)((?:[-*+]|\d{1,9}[.)])[ \t]+)?/
const TRAILING_PUNCTUATION_PATTERN = /^[.,;:!?]+$/

type Delimiter = { open: string; close: string; display: boolean }

const DELIMITERS: Delimiter[] = [
    { open: "$$", close: "$$", display: true },
    { open: "\\[", close: "\\]", display: true },
    { open: "\\(", close: "\\)", display: false }
]

// A delimiter only counts when its leading backslash or dollar isn't itself escaped, so the
// TeX row break `\\[4pt]` never opens display math.
const isEscaped = (text: string, index: number) => {
    let backslashes = 0
    for (let at = index - 1; at >= 0 && text[at] === "\\"; at -= 1) backslashes += 1
    return backslashes % 2 === 1
}

const matchesAt = (text: string, index: number, token: string) => {
    if (!text.startsWith(token, index)) return false
    if (token === "$$") {
        return text[index - 1] !== "$" && text[index + 2] !== "$" && !isEscaped(text, index)
    }
    return !isEscaped(text, index)
}

const findClose = (text: string, from: number, token: string) => {
    for (let index = text.indexOf(token, from); index !== -1; ) {
        if (matchesAt(text, index, token)) return index
        index = text.indexOf(token, index + 1)
    }
    return -1
}

const lineStartOf = (text: string, index: number) => text.lastIndexOf("\n", index - 1) + 1

const lineEndOf = (text: string, index: number) => {
    const end = text.indexOf("\n", index)
    return end === -1 ? text.length : end
}

// The prefix a fence line needs to stay inside the same blockquote or list item.
const containerOf = (line: string) => {
    const [, quoteAndIndent = "", listMarker = ""] = LINE_PREFIX_PATTERN.exec(line) ?? []
    return {
        prefix: quoteAndIndent + listMarker,
        continuation: quoteAndIndent + " ".repeat(listMarker.length)
    }
}

// Rewrites display math as a $$ fence. Each line is re-prefixed so the fence stays inside
// its blockquote or list item; `first` is the prefix for the opening line.
const fenceDisplayMath = (
    body: string,
    container: { prefix: string; continuation: string },
    first = container.prefix
) => {
    const quoteDepth = (container.continuation.match(/>/g) ?? []).length
    const lines = body
        .split("\n")
        .map((line) => {
            let content = line.trimStart()
            for (let depth = 0; depth < quoteDepth && content.startsWith(">"); depth += 1) {
                content = content.slice(1).trimStart()
            }
            return content.trimEnd()
        })
        // TeX ignores blank lines in math, but Markdown ends a blockquote or list item there.
        .filter(Boolean)
    return [
        `${first}$$`,
        ...lines.map((line) => `${container.continuation}${line}`),
        `${container.continuation}$$`
    ].join("\n")
}

// `math` marks text the later single-dollar pass must leave alone.
type MathRegion = { start: number; end: number; replacement: string; math: boolean }

const BLANK_LINE_PATTERN = /\n[ \t>]*\n/

// Reads the math opening at `index`, if any, and the Markdown that should replace it.
const readMathRegion = (text: string, index: number): MathRegion | null => {
    const lineStart = lineStartOf(text, index)
    const leading = text.slice(lineStart, index)
    const container = containerOf(leading)
    const atLineStart = container.prefix.length === leading.length
    const keep = (end: number, math: boolean) => ({
        start: index,
        end,
        replacement: text.slice(index, end),
        math
    })

    BARE_ENVIRONMENT_PATTERN.lastIndex = index
    const environment = atLineStart ? BARE_ENVIRONMENT_PATTERN.exec(text) : null
    if (environment) {
        const endToken = `\\end{${environment[1]}${environment[2]}}`
        const close = text.indexOf(endToken, index + environment[0].length)
        if (close === -1) return null
        const end = close + endToken.length
        const lineEnd = lineEndOf(text, end)
        const after = text.slice(end, lineEnd).trim()
        if (after && !TRAILING_PUNCTUATION_PATTERN.test(after)) return null
        return {
            start: lineStart,
            end: lineEnd,
            replacement: fenceDisplayMath(text.slice(index, end) + after, container),
            math: true
        }
    }

    const delimiter = DELIMITERS.find(({ open }) => matchesAt(text, index, open))
    if (!delimiter) return null

    const bodyStart = index + delimiter.open.length
    const close = findClose(text, bodyStart, delimiter.close)

    if (close === -1) {
        // Still streaming: fence a display opener that starts its line now, so the lines
        // arriving inside it can't turn into Markdown before the closer does. The fence is
        // closed here rather than left to the incomplete-Markdown repair, which pads a
        // trailing "=" line with a zero-width space that KaTeX would then render.
        if (!delimiter.display || !atLineStart) return null
        // Drops the first half of a closer that hasn't fully arrived.
        const body = text.slice(bodyStart).replace(delimiter.open === "$$" ? /\$$/ : /\\$/, "")
        if (delimiter.open === "$$" && body.trim() && !looksLikeMath(body)) return null
        return {
            start: lineStart,
            end: text.length,
            replacement: fenceDisplayMath(body, container),
            math: true
        }
    }

    const body = text.slice(bodyStart, close)
    const end = close + delimiter.close.length
    const multiline = body.includes("\n")

    if (!delimiter.display) {
        if (!multiline) return keep(end, true)
        if (BLANK_LINE_PATTERN.test(body)) return keep(end, false)
        // Joined onto one line so a continuation line can't start a list.
        return {
            start: index,
            end,
            replacement: `${delimiter.open}${body.replace(/[ \t]*\n[ \t>]*/g, " ")}${delimiter.close}`,
            math: true
        }
    }

    const lineEnd = lineEndOf(text, end)
    const after = text.slice(end, lineEnd).trim()
    const closerEndsLine = !after || TRAILING_PUNCTUATION_PATTERN.test(after)
    const openerEndsLine = !text.slice(bodyStart, lineEndOf(text, bodyStart)).trim()

    if (!multiline && !(atLineStart && closerEndsLine)) return keep(end, true)
    if (delimiter.open === "$$" && !looksLikeMath(body)) return keep(end, false)
    // A blank line only belongs inside math the model set apart from the text around it.
    if (BLANK_LINE_PATTERN.test(body) && !atLineStart && !openerEndsLine) return keep(end, false)

    // Trailing punctuation joins the equation; trailing text moves to a line after the fence.
    const fence = fenceDisplayMath(
        closerEndsLine ? body.trimEnd() + after : body,
        container,
        atLineStart ? container.prefix : `\n${container.continuation}`
    )
    return {
        start: atLineStart ? lineStart : index,
        end: closerEndsLine ? lineEnd : lineEnd - text.slice(end, lineEnd).trimStart().length,
        replacement: closerEndsLine ? fence : `${fence}\n${container.continuation}`,
        math: true
    }
}

const normalizeMathRegions = (text: string, hold: (value: string) => string) => {
    let output = ""
    let cursor = 0

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index]
        if (char !== "$" && char !== "\\") continue

        const region = readMathRegion(text, index)
        if (!region) continue

        // Math moved below its sentence leaves no trailing space on the sentence's line.
        const before = text.slice(cursor, region.start)
        output += region.replacement.startsWith("\n") ? before.replace(/[ \t]+$/, "") : before
        output += region.math ? hold(region.replacement) : region.replacement
        cursor = region.end
        index = region.end - 1
    }

    return output + text.slice(cursor)
}

// TeX that can't be prose: a command, sub/superscript, or group.
const TEX_SIGNAL_PATTERN = /\\[A-Za-z]+|[\^_{}]/
// Math never ends in a separator or open bracket, but "$AAPL/$TSLA", "$XX,$XXX", and
// "$XXXX ($XXX off)" pair across one.
const SEPARATOR_ENDING_PATTERN = /[/,([]$/

// Pandoc's rule for single-dollar math, also used by Jupyter, GitLab, and LibreChat: the
// opener is followed by a non-space, the closer is preceded by one and isn't followed by a
// digit, and the closer is the next unescaped dollar on the line outside braces. So
// "$20 and $30" and "$100-$200" stay prices. Models also pad math on both sides as
// `$ x^2 $`, which counts when it carries TeX.
const isSingleDollarMath = (expression: string, next: string | undefined) => {
    if (/\d/.test(next ?? "")) return false
    if (SEPARATOR_ENDING_PATTERN.test(expression.trimEnd())) return false
    if (!/^\s|\s$/.test(expression)) return true
    return /^\s.*\S.*\s$/.test(expression) && TEX_SIGNAL_PATTERN.test(expression)
}

const findSingleDollarClose = (text: string, from: number) => {
    let depth = 0
    for (let index = from; index < text.length; index += 1) {
        const char = text[index]
        if (char === "\n") return -1
        if (char === "\\") index += 1
        else if (char === "{") depth += 1
        else if (char === "}") depth = Math.max(0, depth - 1)
        else if (char === "$" && depth === 0) return index
    }
    return -1
}

// Rewrites single-dollar math as $$…$$, the only inline form the renderer parses. Lone
// dollars render as written. A rejected pair's closer can still open the next one. While
// streaming, a closer that ends the text waits for the next character, which may be the
// digit that makes "$100-$200" a price.
const normalizeSingleDollarMath = (text: string, streaming: boolean) => {
    let output = ""
    let cursor = 0

    for (let index = text.indexOf("$"); index !== -1; index = text.indexOf("$", index + 1)) {
        if (index < cursor || isEscaped(text, index)) continue
        if (text[index - 1] === "$" || text[index + 1] === "$") continue
        const close = findSingleDollarClose(text, index + 1)
        if (close === -1 || text[close + 1] === "$") continue
        if (streaming && close === text.length - 1) break
        const expression = text.slice(index + 1, close)
        if (!isSingleDollarMath(expression, text[close + 1])) continue
        output += `${text.slice(cursor, index)}$$${expression.trim()}$$`
        cursor = close + 1
        index = close
    }

    return output + text.slice(cursor)
}

export const normalizeMarkdownMathDelimiters = (content: string, { streaming = false } = {}) => {
    const code = protectCode(content)
    const math = createHolder("", "")
    const text = normalizeSingleDollarMath(
        normalizeMathRegions(
            code.text.replace(
                SINGLE_DOLLAR_BLOCK_PATTERN,
                (_match, prefix: string, indent: string, expression: string, suffix: string) =>
                    `${prefix}${indent}$$\n${expression}\n${indent}$$${suffix}`
            ),
            math.hold
        ),
        streaming
    )
    return code.restore(math.restore(text))
}
