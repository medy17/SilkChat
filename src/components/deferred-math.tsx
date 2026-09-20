import { Children, lazy, Suspense } from "react"
import type { Components } from "streamdown"
import { Codeblock } from "./codeblock"

const MathRenderer = lazy(() => import("./math-renderer"))

// remark-math marks actual math nodes. Currency and ordinary code never reach KaTeX.
export const MarkdownCode: NonNullable<Components["inlineCode"]> = ({
    node: _node,
    children,
    className,
    ...props
}) => {
    const classes = className?.split(/\s+/) ?? []
    if (
        classes.includes("language-math") ||
        classes.includes("math-inline") ||
        classes.includes("math-display")
    ) {
        const displayMode = "data-block" in props || classes.includes("math-display")
        const source = Children.toArray(children).join("")
        return (
            <Suspense
                fallback={
                    <span
                        role="status"
                        className={
                            displayMode
                                ? "my-4 block text-muted-foreground"
                                : "text-muted-foreground"
                        }
                    >
                        Loading equation…
                    </span>
                }
            >
                <MathRenderer source={source} displayMode={displayMode} />
            </Suspense>
        )
    }

    return (
        <Codeblock className={className} {...props}>
            {children}
        </Codeblock>
    )
}
