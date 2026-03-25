import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./vitest.setup.ts"],
        include: ["__tests__/**/*.{test,spec}.{ts,tsx}"],
        alias: {
            "@/convex": path.resolve(__dirname, "./convex"),
            "@": path.resolve(__dirname, "./src")
        }
    }
})
