import { defineConfig, mergeConfig } from "vitest/config"
import workshop from "./vite.config.ts"

export default mergeConfig(
    workshop,
    defineConfig({
        test: {
            environment: "jsdom",
            include: [".storybook/*.spec.tsx"],
            setupFiles: ["./.storybook/test-setup.ts"]
        }
    })
)
