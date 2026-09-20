import "katex/dist/katex.min.css"
import katex from "katex"
import { memo, useMemo } from "react"

// Preserve rehype-katex's rendering and error recovery in the deferred chunk.
const renderMath = (source: string, displayMode: boolean) => {
    const options = {
        displayMode,
        errorColor: "var(--color-muted-foreground)",
        trust: false
    }
    try {
        return { html: katex.renderToString(source, { ...options, throwOnError: true }) }
    } catch (error) {
        try {
            return {
                html: katex.renderToString(source, {
                    ...options,
                    strict: "ignore",
                    throwOnError: false
                })
            }
        } catch {
            return { error: String(error) }
        }
    }
}

const MathRenderer = memo(({ source, displayMode }: { source: string; displayMode: boolean }) => {
    const result = useMemo(() => renderMath(source, displayMode), [source, displayMode])
    if (result.html === undefined) {
        return (
            <span className="katex-error text-muted-foreground" title={result.error}>
                {source}
            </span>
        )
    }
    return (
        <span
            // KaTeX generates escaped HTML with trust disabled.
            dangerouslySetInnerHTML={{ __html: result.html }}
        />
    )
})

export default MathRenderer
