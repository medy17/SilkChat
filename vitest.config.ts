import path from "node:path"
import { defineConfig } from "vitest/config"

const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true"
const reporters = isCI
    ? ["default"]
    : [path.resolve(__dirname, "./tests/reporters/pretty-reporter.ts")]

export default defineConfig({
    resolve: {
        alias: {
            "@/convex": path.resolve(__dirname, "./convex"),
            "@": path.resolve(__dirname, "./src"),
            // Matches vite.config.ts so math renders as it does in the app.
            "micromark-extension-math": "micromark-extension-llm-math"
        }
    },
    test: {
        environment: "node",
        include: ["tests/**/*.spec.ts"],
        setupFiles: ["./tests/setup.ts"],
        reporters,
        server: { deps: { inline: ["remark-math", "@streamdown/math"] } },
        restoreMocks: true,
        clearMocks: true
    }
})
