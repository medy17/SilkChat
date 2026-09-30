// Blanks out fenced code blocks while preserving offsets and line breaks, so tag scanners
// can search the masked text and slice the original without matching examples in code.
export const maskMarkdownFences = (content: string) => {
    let activeFence: { marker: "`" | "~"; length: number } | undefined

    return content
        .split(/(?<=\n)/)
        .map((line) => {
            const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line)
            const wasInsideFence = Boolean(activeFence)

            if (!activeFence && opening?.[1]) {
                activeFence = {
                    marker: opening[1][0] as "`" | "~",
                    length: opening[1].length
                }
            } else if (activeFence) {
                const trimmed = line.trimStart()
                const markerRun = trimmed.match(/^[`~]+/)?.[0]
                if (
                    markerRun?.[0] === activeFence.marker &&
                    markerRun.length >= activeFence.length &&
                    trimmed.slice(markerRun.length).trim() === ""
                ) {
                    activeFence = undefined
                }
            }

            return wasInsideFence || opening ? line.replace(/[^\r\n]/g, " ") : line
        })
        .join("")
}

// Footnote definitions ([^1]:) are excluded: appending them would render a footnote list.
const LINK_DEFINITION_PATTERN = /^ {0,3}\[(?!\^)[^\]\n]+\]:[ \t]*\S.*$/gm

// Link reference definitions ([label]: url) are document-wide in Markdown, but messages render
// as several Markdown documents around recipes and galleries. Returns the definitions outside
// code so each segment can carry them; definitions themselves render nothing.
export const collectLinkDefinitions = (content: string) =>
    [...maskMarkdownFences(content).matchAll(LINK_DEFINITION_PATTERN)].map((match) => match[0])
