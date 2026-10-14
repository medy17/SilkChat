import type { ComponentType } from "react"
import { transform } from "sucrase"

export type SilkAppModules = Record<string, unknown>

// Models often call hooks without importing them, so each is in scope around the module.
// The module body runs in its own function, so its own declarations (an import, or
// `const { useState } = React`) shadow these instead of colliding with them.
const IMPLICIT_REACT_BINDINGS = [
    "useState",
    "useEffect",
    "useLayoutEffect",
    "useMemo",
    "useCallback",
    "useRef",
    "useReducer",
    "useId",
    "useTransition",
    "useDeferredValue",
    "Fragment"
] as const

const MODULE_ALIASES: Record<string, string> = {
    "framer-motion": "motion/react",
    motion: "motion/react",
    "react-dom/client": "react-dom",
    "react/jsx-dev-runtime": "react/jsx-runtime"
}

/** Maps an import specifier to a registry key, or null when the import is a no-op. */
export const resolveSilkAppModule = (specifier: string): string | null => {
    if (/\.(css|scss|sass|less)$/.test(specifier)) return null
    // Models fluent in shadcn import primitives from the project alias; the kit
    // re-exports them under the same names.
    if (specifier.startsWith("@/components/ui/") || specifier === "@/lib/utils") {
        return "@silk/ui"
    }
    // The runtime bundles OrbitControls, under either path three.js documents. Other
    // addons resolve to themselves and fail as unavailable.
    if (/^three\/(addons|examples\/jsm)\/controls\/OrbitControls(\.js)?$/.test(specifier)) {
        return "three/addons"
    }
    if (specifier.startsWith("d3-")) return "d3"
    return MODULE_ALIASES[specifier] ?? specifier
}

export const transpileSilkApp = (code: string) =>
    transform(code, {
        transforms: ["jsx", "typescript", "imports"],
        jsxRuntime: "automatic",
        production: true,
        filePath: "App.tsx"
    }).code

/** Registry keys a transpiled module requires, so lazy modules can load first. */
export const findSilkAppModules = (transpiled: string) => {
    const keys = new Set<string>()
    for (const match of transpiled.matchAll(/\brequire\(\s*(['"])([^'"]+)\1\s*\)/g)) {
        const key = resolveSilkAppModule(match[2])
        if (key !== null) keys.add(key)
    }
    return keys
}

const isComponent = (value: unknown): value is ComponentType =>
    typeof value === "function" ||
    (typeof value === "object" && value !== null && "$$typeof" in value)

/** Evaluates a transpiled module and returns its default-exported component. */
export const evaluateSilkApp = (transpiled: string, modules: SilkAppModules): ComponentType => {
    const React = modules.react as Record<string, unknown> | undefined
    if (!React) throw new Error("The app runtime is missing React.")

    const source = `${transpiled}
;if (!exports.default && typeof App !== "undefined") exports.default = App;`

    const requireModule = (specifier: string) => {
        const key = resolveSilkAppModule(specifier)
        if (key === null) return {}
        if (!(key in modules)) {
            throw new Error(`"${specifier}" isn't available in SilkChat apps.`)
        }
        return modules[key]
    }

    const module: { exports: Record<string, unknown> } = { exports: {} }
    const scope = new Function(
        "React",
        ...IMPLICIT_REACT_BINDINGS,
        `return function (require, module, exports) {\n${source}\n}`
    )
    scope(React, ...IMPLICIT_REACT_BINDINGS.map((name) => React[name]))(
        requireModule,
        module,
        module.exports
    )

    const exported = module.exports.default ?? module.exports
    if (!isComponent(exported)) {
        throw new Error("The app must default-export a React component.")
    }
    return exported
}

export const compileSilkApp = (code: string, modules: SilkAppModules) =>
    evaluateSilkApp(transpileSilkApp(code), modules)
