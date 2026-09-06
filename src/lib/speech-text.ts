import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { parseRecipeBlock, splitRecipeContent } from "./recipe"

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath)
const CODE_PLACEHOLDER = "You can see this code block in our conversation history."
type Node = { type: string; value?: string; lang?: string | null; children?: Node[] }

function readNode(node: Node): string {
    switch (node.type) {
        case "text":
        case "inlineCode":
        case "inlineMath":
            return node.value ?? ""
        case "code":
            return ["mermaid", "chart", "vega", "vega-lite"].includes(node.lang ?? "")
                ? ""
                : `\n${CODE_PLACEHOLDER}\n`
        case "html":
        case "image":
        case "imageReference":
        case "table":
        case "math":
        case "definition":
        case "footnoteDefinition":
        case "footnoteReference":
            return ""
        case "break":
            return "\n"
        default: {
            const text = node.children?.map(readNode).join("") ?? ""
            return ["paragraph", "heading", "listItem", "blockquote"].includes(node.type)
                ? `${text}\n`
                : text
        }
    }
}

function markdownSpeech(text: string): string {
    return readNode(parser.parse(text) as Node)
}

export function speechTextFromMarkdown(text: string): string {
    // Remove rich HTML payloads as whole units, including content after blank lines.
    const readContent = (content: string) =>
        splitRecipeContent(content)
            .map((segment) => {
                if (segment.type !== "recipe")
                    return markdownSpeech(
                        segment.content.replace(
                            /<(artifact|canvas|chart|network|svg|script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,
                            ""
                        )
                    )
                const recipe = parseRecipeBlock(segment.content, segment.openingAttributes)
                if (!recipe) return ""
                return markdownSpeech(
                    [
                        recipe.title,
                        recipe.description,
                        `Serves ${recipe.servings}.`,
                        "Ingredients.",
                        ...recipe.ingredients.map((item) =>
                            [
                                item.group,
                                item.tokens
                                    .map((token) =>
                                        token.type === "text" ? token.text : token.display
                                    )
                                    .join("")
                            ]
                                .filter(Boolean)
                                .join(": ")
                        ),
                        "Instructions.",
                        ...recipe.steps.map(
                            (step, index) =>
                                `Step ${index + 1}. ${step.tokens
                                    .map((token) =>
                                        token.type === "text" ? token.text : token.display
                                    )
                                    .join("")}`
                        ),
                        recipe.notes
                    ]
                        .filter(Boolean)
                        .join("\n\n")
                )
            })
            .join("\n")

    // Protect fenced and indented code before parsing recipe tags, even in examples.
    const codeBlocks: { start: number; end: number; node: Node }[] = []
    type PositionedNode = Node & {
        position?: { start: { offset?: number }; end: { offset?: number } }
        children?: PositionedNode[]
    }
    const visit = (node: PositionedNode) => {
        if (
            node.type === "code" &&
            node.position?.start.offset !== undefined &&
            node.position.end.offset !== undefined
        ) {
            codeBlocks.push({
                start: node.position.start.offset,
                end: node.position.end.offset,
                node
            })
        } else node.children?.forEach(visit)
    }
    visit(parser.parse(text) as PositionedNode)
    const output: string[] = []
    let cursor = 0
    for (const block of codeBlocks) {
        output.push(readContent(text.slice(cursor, block.start)), readNode(block.node))
        cursor = block.end
    }
    output.push(readContent(text.slice(cursor)))
    return output
        .join("\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n+/g, "\n")
        .trim()
}

export function getMessageSpeechText(parts: readonly { type: string; text?: string }[]): string {
    return speechTextFromMarkdown(
        parts
            .filter((part) => part.type === "text")
            .map((part) => part.text ?? "")
            .join("\n\n")
    )
}

export { splitSpeechText } from "./speech-text-chunks"
