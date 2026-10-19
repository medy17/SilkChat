import { normalizeMarkdownMathDelimiters } from "@/lib/markdown-math"
import { describe, expect, it } from "vitest"

describe("normalizeMarkdownMathDelimiters", () => {
    it("normalizes likely single-dollar math without touching currency", () => {
        expect(normalizeMarkdownMathDelimiters("Where $L_{0}$ and $k$ matter.")).toBe(
            "Where $$L_{0}$$ and $$k$$ matter."
        )
        expect(normalizeMarkdownMathDelimiters("Use $(a,b)$ as the interval.")).toBe(
            "Use $$(a,b)$$ as the interval."
        )
        expect(normalizeMarkdownMathDelimiters("Use $3$ as the exponent.")).toBe(
            "Use $$3$$ as the exponent."
        )
        expect(normalizeMarkdownMathDelimiters("It costs $3 and then $30.")).toBe(
            "It costs $3 and then $30."
        )
        expect(normalizeMarkdownMathDelimiters("It costs $20 and then $30.")).toBe(
            "It costs $20 and then $30."
        )
    })

    it("keeps prices and tickers as text", () => {
        for (const prose of [
            "Compare $AAPL and $TSLA today.",
            "Hold $AAPL ($TSLA) or $AAPL/$TSLA.",
            "Price: $XXXX/$XXXX per seat, or $XX,$XXX.",
            "Budget $100-$200 or $1,000–$2,000.",
            "$5/month or $50/year",
            "Costs $5 for x_1 and $"
        ]) {
            expect(normalizeMarkdownMathDelimiters(prose)).toBe(prose)
        }
        expect(normalizeMarkdownMathDelimiters("Spend $5 and $x$ more.")).toBe(
            "Spend $5 and $$x$$ more."
        )
    })

    it("reads tight or TeX-padded single-dollar pairs as math", () => {
        expect(normalizeMarkdownMathDelimiters("$1$, $-1$, $2^n$th, $AB$ and $AB = CD$")).toBe(
            "$$1$$, $$-1$$, $$2^n$$th, $$AB$$ and $$AB = CD$$"
        )
        expect(normalizeMarkdownMathDelimiters("Pad $ x^2 $ and $ \\alpha $ but not $ x $.")).toBe(
            "Pad $$x^2$$ and $$\\alpha$$ but not $ x $."
        )
        expect(normalizeMarkdownMathDelimiters("$\\text{a $b}$")).toBe("$$\\text{a $b}$$")
    })

    it("waits for the character after a closer that ends a streaming reply", () => {
        expect(normalizeMarkdownMathDelimiters("Budget $100-$", { streaming: true })).toBe(
            "Budget $100-$"
        )
        expect(normalizeMarkdownMathDelimiters("Where $x$", { streaming: true })).toBe("Where $x$")
        expect(normalizeMarkdownMathDelimiters("Where $x$")).toBe("Where $$x$$")
    })

    it("normalizes single-dollar display math fences", () => {
        expect(normalizeMarkdownMathDelimiters("Before\n$\nL(t)=L_{0}e^{-kt}\n$\nAfter")).toBe(
            "Before\n$$\nL(t)=L_{0}e^{-kt}\n$$\nAfter"
        )
    })

    it("normalizes standalone double-dollar equations into display fences", () => {
        expect(
            normalizeMarkdownMathDelimiters(
                "Before\n\n$$ \\frac{x^{2}}{y^{3}} + \\sqrt{2} $$\n\nAfter"
            )
        ).toBe("Before\n\n$$\n\\frac{x^{2}}{y^{3}} + \\sqrt{2}\n$$\n\nAfter")
        expect(normalizeMarkdownMathDelimiters("Keep $$x^2$$ inline here.")).toBe(
            "Keep $$x^2$$ inline here."
        )
    })

    it("leaves incomplete single-dollar math delimiters untouched while streaming", () => {
        expect(normalizeMarkdownMathDelimiters("Where $L_{0} is still streaming")).toBe(
            "Where $L_{0} is still streaming"
        )
        expect(normalizeMarkdownMathDelimiters("Before\n$\nL(t)=L_{0}e^{-kt}\nAfter")).toBe(
            "Before\n$\nL(t)=L_{0}e^{-kt}\nAfter"
        )
    })

    it("never treats dollar signs in code as math", () => {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: markdown containing a JS template literal
        const code = "```tsx\nconst range = `${min} to ${max}`\n```"
        expect(normalizeMarkdownMathDelimiters(`Try it:\n\n${code}\n\nThen $x^2$.`)).toBe(
            `Try it:\n\n${code}\n\nThen $$x^2$$.`
        )

        // biome-ignore lint/suspicious/noTemplateCurlyInString: a fence still streaming
        const streaming = "```silk-app\nconst label = `${dose} mL ($${cost})`"
        expect(normalizeMarkdownMathDelimiters(streaming)).toBe(streaming)

        expect(normalizeMarkdownMathDelimiters("Run `echo $HOME $PATH` where $y_1$ is set.")).toBe(
            "Run `echo $HOME $PATH` where $$y_1$$ is set."
        )
        expect(normalizeMarkdownMathDelimiters("```js``` is inline.\n\nThen $x^2$.")).toBe(
            "```js``` is inline.\n\nThen $$x^2$$."
        )
    })

    it("fences display math whose lines would otherwise read as Markdown", () => {
        expect(normalizeMarkdownMathDelimiters("Intro:\n\n\\[\nx =\n+ y\n\\]")).toBe(
            "Intro:\n\n$$\nx =\n+ y\n$$"
        )
        expect(normalizeMarkdownMathDelimiters("\\[x =\n+ y\\].")).toBe("$$\nx =\n+ y.\n$$")
        expect(normalizeMarkdownMathDelimiters("$$x =\n- y$$")).toBe("$$\nx =\n- y\n$$")
        expect(
            normalizeMarkdownMathDelimiters(
                "\\begin{aligned}\na &= b \\\\\n+ c &= d\n\\end{aligned}"
            )
        ).toBe("$$\n\\begin{aligned}\na &= b \\\\\n+ c &= d\n\\end{aligned}\n$$")
    })

    it("moves display math out of the sentence around it", () => {
        expect(
            normalizeMarkdownMathDelimiters(
                "Let \\(x\\) be \\[\nx\n\\] and $y_1$ where x is fixed."
            )
        ).toBe("Let \\(x\\) be\n$$\nx\n$$\nand $$y_1$$ where x is fixed.")
    })

    it("keeps fenced display math inside its list item or blockquote", () => {
        expect(normalizeMarkdownMathDelimiters("1. Step:\n   \\[\n   x\n- y\n   \\]")).toBe(
            "1. Step:\n   $$\n   x\n   - y\n   $$"
        )
        expect(normalizeMarkdownMathDelimiters("> \\[\n> x\n>\n> + y\n> \\]")).toBe(
            "> $$\n> x\n> + y\n> $$"
        )
    })

    it("joins inline math that spans lines", () => {
        expect(normalizeMarkdownMathDelimiters("We have \\(a\n+ b\\) here.")).toBe(
            "We have \\(a + b\\) here."
        )
    })

    it("doesn't mistake a TeX row break for a delimiter", () => {
        expect(
            normalizeMarkdownMathDelimiters(
                "\\[\n\\begin{aligned}\na &= b \\\\[4pt]\n\nc &= d\n\\end{aligned}\n\\]"
            )
        ).toBe("$$\n\\begin{aligned}\na &= b \\\\[4pt]\nc &= d\n\\end{aligned}\n$$")
    })

    it("leaves inline math and dollar pairs that aren't math as written", () => {
        expect(
            normalizeMarkdownMathDelimiters("See \\[1\\] and I paid $$ and $$ again, then $x^2$.")
        ).toBe("See \\[1\\] and I paid $$ and $$ again, then $$x^2$$.")
    })

    it("closes display math that is still streaming", () => {
        expect(normalizeMarkdownMathDelimiters("Intro:\n\n\\[\nx = 1\n+ y\n\\")).toBe(
            "Intro:\n\n$$\nx = 1\n+ y\n$$"
        )
        expect(normalizeMarkdownMathDelimiters("Intro:\n\n$$\nx = 1\n$")).toBe(
            "Intro:\n\n$$\nx = 1\n$$"
        )
    })
})
