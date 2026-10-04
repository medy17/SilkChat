import { parseRoleplay, splitRoleplayContent, type RoleplaySegment } from "@/lib/roleplay"
import { RoleplayScene } from "./roleplay-scene"
import "katex/dist/katex.min.css"
import "streamdown/styles.css"
import { useDevRawMarkdown } from "@/lib/dev-overrides"
import { collectLinkDefinitions } from "@/lib/markdown-scan"
import { parseRecipeBlock, splitRecipeContent, type RecipeContentSegment } from "@/lib/recipe"
import {
    MAX_VISUAL_SEARCHES,
    splitVisualContent,
    type VisualContentSegment
} from "@/lib/visual-references"
import { memo } from "react"
import { Streamdown } from "streamdown"
import { RecipeCard } from "./recipe-card"
import { VisualReferences } from "./visual-references"
import { streamdownComponents, streamdownPlugins } from "./streamdown-config"

const SINGLE_DOLLAR_BLOCK_PATTERN = /(^|\n)([ \t]*)\$[ \t]*\n([\s\S]*?)\n[ \t]*\$([ \t]*(?=\n|$))/g
const SINGLE_DOLLAR_INLINE_PATTERN = /(^|[^$\\])\$([^$\n]+?)\$(?!\$)/g
const STANDALONE_DOUBLE_DOLLAR_PATTERN =
    /(^|\n)([ \t]*)\$\$[ \t]*([^\n]*?\S)[ \t]*\$\$[ \t]*(?=\n|$)/g

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

export const normalizeMarkdownMathDelimiters = (content: string) =>
    content
        .replace(
            STANDALONE_DOUBLE_DOLLAR_PATTERN,
            (_match, prefix: string, indent: string, expression: string) =>
                `${prefix}${indent}$$\n${expression}\n${indent}$$`
        )
        .replace(
            SINGLE_DOLLAR_BLOCK_PATTERN,
            (_match, prefix: string, indent: string, expression: string, suffix: string) =>
                `${prefix}${indent}$$\n${expression}\n${indent}$$${suffix}`
        )
        .replace(SINGLE_DOLLAR_INLINE_PATTERN, (_match, prefix: string, expression: string) =>
            looksLikeMath(expression) ? `${prefix}$$${expression}$$` : `${prefix}$${expression}$`
        )

// Memoized so settled roleplay beats skip re-parsing while a later beat streams.
const MarkdownBody = memo(({ content, isAnimating }: { content: string; isAnimating: boolean }) => (
    <Streamdown
        animated={false}
        className="markdown-content not-prose"
        components={streamdownComponents}
        controls={false}
        isAnimating={isAnimating}
        linkSafety={{ enabled: false }}
        mode={isAnimating ? "streaming" : "static"}
        plugins={streamdownPlugins}
    >
        {normalizeMarkdownMathDelimiters(content)}
    </Streamdown>
))

export const MemoizedMarkdown = memo(
    ({
        content,
        isAnimating = false,
        roleplayAvatars
    }: {
        content: string
        isAnimating?: boolean
        roleplayAvatars?: Readonly<Record<string, string>>
    }) => {
        const rawMarkdown = useDevRawMarkdown()

        if (rawMarkdown) {
            return (
                <pre
                    data-dev-audit-ignore
                    className="markdown-content overflow-x-auto whitespace-pre-wrap rounded-[var(--radius-md)] bg-muted/40 p-3 font-mono text-xs"
                >
                    {content}
                </pre>
            )
        }

        let visualCount = 0
        const segments = splitRoleplayContent(content, isAnimating)
            .flatMap<RoleplaySegment | RecipeContentSegment>((segment) =>
                segment.type === "roleplay" ? [segment] : splitRecipeContent(segment.content)
            )
            .flatMap<RoleplaySegment | RecipeContentSegment | VisualContentSegment>((segment) =>
                segment.type === "markdown"
                    ? splitVisualContent(segment.content, isAnimating)
                    : [segment]
            )
            .filter((segment) => segment.type !== "visual" || ++visualCount <= MAX_VISUAL_SEARCHES)

        // Each segment is its own Markdown document, so carry the message's link definitions
        // into the segments that lack them; a [ref] then resolves across a split.
        const linkDefinitions = segments.length > 1 ? collectLinkDefinitions(content) : []
        const withLinkDefinitions = (text: string) => {
            const missing = linkDefinitions.filter((definition) => !text.includes(definition))
            return missing.length > 0 ? `${text}\n\n${missing.join("\n")}` : text
        }

        return (
            <>
                {segments.map((segment, index) => {
                    if (segment.type === "roleplay") {
                        return (
                            <RoleplayScene
                                key={`roleplay-${index}`}
                                nodes={parseRoleplay(segment.content, segment.streaming)}
                                streaming={segment.streaming}
                                avatars={roleplayAvatars}
                                renderMarkdown={(text, animating) => (
                                    <MarkdownBody content={text} isAnimating={animating} />
                                )}
                            />
                        )
                    }
                    if (segment.type === "visual") {
                        return (
                            <div key={`visual-${index}`} className="my-4">
                                <VisualReferences
                                    cue={segment.cue}
                                    refs={segment.refs}
                                    itemTitles={segment.itemTitles}
                                    title={segment.title}
                                    limit={3}
                                    variant="gallery"
                                    framed
                                />
                            </div>
                        )
                    }
                    if (segment.type === "markdown") {
                        return (
                            <MarkdownBody
                                key={`markdown-${index}`}
                                content={withLinkDefinitions(segment.content)}
                                isAnimating={isAnimating}
                            />
                        )
                    }

                    const recipe = parseRecipeBlock(segment.content, segment.openingAttributes)
                    if (recipe) return <RecipeCard key={`recipe-${index}`} recipe={recipe} />

                    return (
                        <MarkdownBody
                            key={`recipe-fallback-${index}`}
                            content={withLinkDefinitions(segment.content)}
                            isAnimating={isAnimating}
                        />
                    )
                })}
            </>
        )
    }
)
MemoizedMarkdown.displayName = "MemoizedMarkdown"
