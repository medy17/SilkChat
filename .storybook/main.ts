import path from "node:path"
import type { StorybookConfig } from "@storybook/react-vite"

const config: StorybookConfig = {
    stories: ["../stories/**/*.stories.tsx"],
    addons: ["@storybook/addon-docs"],
    staticDirs: ["../public"],
    framework: {
        name: "@storybook/react-vite",
        options: {
            builder: { viteConfigPath: path.resolve(import.meta.dirname, "vite.config.ts") }
        }
    },
    core: { disableTelemetry: true },
    viteFinal: (config) => {
        const aliases = config.resolve?.alias ?? []
        const existing = Array.isArray(aliases)
            ? aliases
            : Object.entries(aliases).map(([find, replacement]) => ({ find, replacement }))
        config.resolve = {
            ...config.resolve,
            alias: [
                {
                    find: "@/lib/recipe-visuals",
                    replacement: path.resolve(import.meta.dirname, "recipe-visuals.ts")
                },
                {
                    find: "@/lib/browser-env",
                    replacement: path.resolve(import.meta.dirname, "browser-env.ts")
                },
                {
                    find: "convex-helpers/react/cache",
                    replacement: path.resolve(import.meta.dirname, "convex-cache.tsx")
                },
                {
                    find: "@/providers",
                    replacement: path.resolve(import.meta.dirname, "app-providers.tsx")
                },
                {
                    find: "@/lib/auth-client",
                    replacement: path.resolve(import.meta.dirname, "auth-client.ts")
                },
                {
                    find: "@convex-dev/react-query",
                    replacement: path.resolve(import.meta.dirname, "convex-query.ts")
                },
                {
                    find: "@/lib/telemetry/browser",
                    replacement: path.resolve(import.meta.dirname, "telemetry.ts")
                },
                {
                    find: "@/hooks/auth-hooks",
                    replacement: path.resolve(import.meta.dirname, "auth-hooks.ts")
                },
                {
                    find: "@/lib/convex-cached-query",
                    replacement: path.resolve(import.meta.dirname, "cached-query.ts")
                },
                {
                    find: "convex/react",
                    replacement: path.resolve(import.meta.dirname, "convex-react.tsx")
                },
                ...existing
            ]
        }
        return config
    }
}

export default config
