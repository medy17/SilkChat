import { code } from "@streamdown/code"
import { memo } from "react"
import { type Components, Streamdown } from "streamdown"
import { Codeblock } from "./codeblock"

const highlightedCodeComponents: Components = {
    code: Codeblock as Components["code"],
    inlineCode: Codeblock as Components["inlineCode"]
}

export const createCodeFence = (source: string, language: string) => {
    const longestBacktickRun = Math.max(
        2,
        ...(source.match(/`+/g)?.map((sequence) => sequence.length) ?? [])
    )
    const fence = "`".repeat(longestBacktickRun + 1)
    const safeLanguage = language.replace(/[^a-zA-Z0-9_+-]/g, "") || "plaintext"

    return `${fence}${safeLanguage}\n${source}${source.endsWith("\n") ? "" : "\n"}${fence}`
}

export const HighlightedCodeblock = memo(
    ({ source, language }: { source: string; language: string }) => (
        <Streamdown
            className="not-prose"
            components={highlightedCodeComponents}
            controls={false}
            mode="static"
            plugins={{ code }}
        >
            {createCodeFence(source, language)}
        </Streamdown>
    )
)

HighlightedCodeblock.displayName = "HighlightedCodeblock"
