import { parseRoleplay, splitRoleplayContent, type RoleplaySegment } from "@/lib/roleplay"
import { RoleplayScene } from "./roleplay-scene"
import "katex/dist/katex.min.css"
import "streamdown/styles.css"
import { useDevRawMarkdown } from "@/lib/dev-overrides"
import { normalizeMarkdownMathDelimiters } from "@/lib/markdown-math"
import { collectLinkDefinitions } from "@/lib/markdown-scan"
import { parseRecipeBlock, splitRecipeContent, type RecipeContentSegment } from "@/lib/recipe"
import { fenceCode, type SilkAppContentSegment, splitSilkAppContent } from "@/lib/silk-app/segments"
import {
    MAX_VISUAL_SEARCHES,
    splitVisualContent,
    type VisualContentSegment
} from "@/lib/visual-references"
import { memo } from "react"
import { parseMarkdownIntoBlocks, Streamdown } from "streamdown"
import { CodePreviewContext } from "./codeblock"
import { RecipeCard } from "./recipe-card"
import { SilkAppBlock, type SilkAppSourceProps } from "./silk-app/silk-app-block"
import { VisualReferences } from "./visual-references"
import { streamdownComponents, streamdownPlugins } from "./streamdown-config"

const MAYBE_LINK_DEFINITION_PATTERN = /^ {0,3}\[(?!\^)[^\]\n]+\]:/m
const CODE_FENCE_BLOCK_PATTERN = /^ {0,3}(`{3,}|~{3,})/

// Streaming mode renders each block as its own Markdown document, so a [ref] would not
// resolve against a definition in another block. Carry the definitions into every
// non-code block; definitions render nothing.
const parseBlocksWithLinkDefinitions = (markdown: string) => {
    const blocks = parseMarkdownIntoBlocks(markdown)
    if (blocks.length < 2 || !MAYBE_LINK_DEFINITION_PATTERN.test(markdown)) return blocks

    const definitions = collectLinkDefinitions(markdown)
    if (definitions.length === 0) return blocks

    return blocks.map((block) => {
        if (CODE_FENCE_BLOCK_PATTERN.test(block)) return block
        const missing = definitions.filter((definition) => !block.includes(definition))
        return missing.length > 0 ? `${block}\n\n${missing.join("\n")}` : block
    })
}

// Always streaming mode: Streamdown renders static mode as a different tree, so switching
// when a reply settles remounts the whole message (code re-highlights, Mermaid re-renders,
// code block state resets). With isAnimating off, settling only re-renders an unfinished
// last block. Memoized so settled roleplay beats skip re-parsing while a later beat streams.
const MarkdownBody = memo(({ content, isAnimating }: { content: string; isAnimating: boolean }) => (
    <Streamdown
        animated={false}
        className="markdown-content not-prose"
        components={streamdownComponents}
        controls={false}
        isAnimating={isAnimating}
        linkSafety={{ enabled: false }}
        mode="streaming"
        parseIncompleteMarkdown={isAnimating}
        parseMarkdownIntoBlocksFn={parseBlocksWithLinkDefinitions}
        plugins={streamdownPlugins}
    >
        {normalizeMarkdownMathDelimiters(content, { streaming: isAnimating })}
    </Streamdown>
))

const SilkAppSource = memo(({ code, isStreaming }: SilkAppSourceProps) => (
    <CodePreviewContext value={false}>
        <MarkdownBody content={fenceCode(code, "tsx")} isAnimating={isStreaming} />
    </CodePreviewContext>
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
            .flatMap<RoleplaySegment | RecipeContentSegment | SilkAppContentSegment>((segment) =>
                segment.type === "markdown" ? splitSilkAppContent(segment.content) : [segment]
            )
            .flatMap<
                | RoleplaySegment
                | RecipeContentSegment
                | SilkAppContentSegment
                | VisualContentSegment
            >((segment) =>
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

        // Apps are keyed by their order among the message's apps, which holds when a
        // reply finishes or stops, so a running app is never remounted.
        let appCount = 0

        return (
            <>
                {segments.map((segment, index) => {
                    if (segment.type === "silk-app") {
                        return (
                            <SilkAppBlock
                                key={`silk-app-${appCount++}`}
                                code={segment.code}
                                isStreaming={!segment.complete && isAnimating}
                                cutOff={!segment.complete && !isAnimating}
                                source={SilkAppSource}
                            />
                        )
                    }
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
