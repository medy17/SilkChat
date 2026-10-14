import { readFileSync } from "node:fs"
import path from "node:path"
import { buildSilkAppDocument } from "@/lib/silk-app/host-theme"
import {
    SILK_APP_THEME_COLORS,
    clampFrameHeight,
    parseFrameMessage,
    parseHostMessage
} from "@/lib/silk-app/protocol"
import { compileSilkApp, findSilkAppModules, transpileSilkApp } from "@/silk-app-runtime/evaluate"
import { describeAppError } from "@/silk-app-runtime/errors"
import * as React from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import * as JsxRuntime from "react/jsx-runtime"
import { describe, expect, it } from "vitest"

const modules = { react: React, "react/jsx-runtime": JsxRuntime }

const renderApp = (code: string, extraModules: Record<string, unknown> = {}) =>
    renderToStaticMarkup(createElement(compileSilkApp(code, { ...modules, ...extraModules })))

describe("compileSilkApp", () => {
    it("compiles a TSX module and renders its default export", () => {
        const html = renderApp(`
            import { useState } from "react"
            type Props = { factor?: number }
            export default function Counter({ factor = 21 }: Props) {
                const [count] = useState(2)
                return <p>{count * factor}</p>
            }
        `)

        expect(html).toBe("<p>42</p>")
    })

    it("supplies hooks the model forgot to import and falls back to an App binding", () => {
        const html = renderApp(`
            function App() {
                const [label] = useState("ready")
                const upper = useMemo(() => label.toUpperCase(), [label])
                return <span>{upper}</span>
            }
        `)

        expect(html).toBe("<span>READY</span>")
    })

    it("lets the app declare its own hook bindings", () => {
        const html = renderApp(`
            import React from "react"
            const { useState } = React
            const App = () => {
                const [count] = useState(3)
                return <p>{count}</p>
            }
        `)

        expect(html).toBe("<p>3</p>")
    })

    it("ignores stylesheet imports and resolves shadcn paths to the kit", () => {
        const kit = {
            Badge: ({ children }: { children: React.ReactNode }) =>
                createElement("b", null, children)
        }
        const html = renderApp(
            `
            import "./styles.css"
            import { Badge } from "@/components/ui/badge"
            export default () => <Badge>ok</Badge>
        `,
            { "@silk/ui": kit }
        )

        expect(html).toBe("<b>ok</b>")
    })

    it("names an import the runtime doesn't provide", () => {
        expect(() =>
            renderApp(`
                import chunk from "lodash/chunk"
                export default () => <p>{chunk([1, 2], 1).length}</p>
            `)
        ).toThrow(`"lodash/chunk" isn't available in SilkChat apps.`)
        expect(() =>
            renderApp(`
                import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
                export default () => <p>{String(GLTFLoader)}</p>
            `)
        ).toThrow(`"three/addons/loaders/GLTFLoader.js" isn't available in SilkChat apps.`)
    })

    it("rejects a module without a component", () => {
        expect(() => compileSilkApp("export const answer = 42", modules)).toThrow(
            "The app must default-export a React component."
        )
    })
})

describe("describeAppError", () => {
    it("spells out minified React errors and keeps other messages", () => {
        const minified = new Error(
            "Minified React error #130; visit https://react.dev/errors/130?args[]=object&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings."
        )

        expect(describeAppError(minified)).toBe(
            "A component was expected but got object. Check that every imported component exists, and pass a component where one is expected rather than a rendered element."
        )
        expect(describeAppError(new Error("rate is not defined"))).toBe("rate is not defined")
    })
})

describe("findSilkAppModules", () => {
    it("reports the registry keys an app needs, so lazy modules load first", () => {
        const transpiled = transpileSilkApp(`
            import * as THREE from "three"
            import { OrbitControls } from "three/addons/controls/OrbitControls.js"
            import { Card } from "@/components/ui/card"
            import "./app.css"
            export default function Scene() {
                return <Card>{String(new THREE.Vector3().x)}{String(OrbitControls)}</Card>
            }
        `)

        expect(findSilkAppModules(transpiled)).toEqual(
            new Set(["react/jsx-runtime", "three", "three/addons", "@silk/ui"])
        )
    })
})

describe("buildSilkAppDocument", () => {
    it("loads the runtime from this origin under a policy that keeps the app offline", () => {
        const html = buildSilkAppDocument("https://silk.chat")
        const policy = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1]

        expect(html.indexOf("Content-Security-Policy")).toBeLessThan(html.indexOf("<script"))
        expect(html).toContain('<script src="https://silk.chat/silk-app/dev/runtime.js">')
        expect(policy).toContain("script-src https://silk.chat/silk-app/dev/ 'unsafe-eval'")
        expect(policy).toContain("connect-src 'none'")
        expect(policy).toContain("form-action 'none'")
    })
})

describe("frame stylesheet", () => {
    it("declares a fallback and a Tailwind color for every theme color the host sends", () => {
        const css = readFileSync(
            path.resolve(import.meta.dirname, "../../src/silk-app-runtime/frame.css"),
            "utf8"
        )
        const missing = SILK_APP_THEME_COLORS.filter(
            (name) =>
                !css.includes(`--${name}:`) || !css.includes(`--color-${name}: var(--${name})`)
        )

        expect(missing).toEqual([])
    })
})

describe("frame messages", () => {
    it("accepts well-formed frame messages and clamps reported heights", () => {
        expect(parseFrameMessage({ type: "silk-app:resize", height: 412.2 })).toEqual({
            type: "silk-app:resize",
            height: 413
        })
        expect(parseFrameMessage({ type: "silk-app:rendered", height: -20 })).toEqual({
            type: "silk-app:rendered",
            height: 0
        })
        expect(clampFrameHeight(Number.POSITIVE_INFINITY)).toBe(0)
    })

    it("rejects malformed messages and truncates long errors", () => {
        expect(parseFrameMessage({ type: "silk-app:resize", height: "9999" })).toBeNull()
        expect(parseFrameMessage({ type: "widget-resize", height: 10 })).toBeNull()
        expect(parseFrameMessage(null)).toBeNull()

        const error = parseFrameMessage({
            type: "silk-app:error",
            message: "x".repeat(5000),
            fatal: "yes"
        })
        expect(error).toEqual({ type: "silk-app:error", message: "x".repeat(2000), fatal: false })
    })

    it("only accepts host renders with code, a mode, and a theme", () => {
        const theme = { vars: {}, dark: true, rootFontSize: "16px", fontStylesheets: [] }

        expect(
            parseHostMessage({ type: "silk-app:render", code: "x", mode: "inline", theme })
        ).toEqual({ type: "silk-app:render", code: "x", mode: "inline", theme })
        expect(
            parseHostMessage({ type: "silk-app:render", code: "x", mode: "fullscreen", theme })
        ).toBeNull()
        expect(parseHostMessage({ type: "silk-app:theme", theme: { dark: true } })).toBeNull()
    })
})
