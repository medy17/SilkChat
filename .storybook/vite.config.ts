import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import svgr from "vite-plugin-svgr"

// The component workshop does not need the app's server or deployment plugins.
export default defineConfig({
    plugins: [tailwindcss(), svgr({ include: "**/*.svg" })],
    envDir: false,
    define: {
        "import.meta.env.VITE_CONVEX_URL": JSON.stringify("https://storybook.invalid"),
        "import.meta.env.VITE_CONVEX_API_URL": JSON.stringify("https://storybook.invalid"),
        "import.meta.env.VITE_R2_PUBLIC_BASE_URL": JSON.stringify("http://localhost:6006")
    },
    resolve: {
        alias: {
            "@/lib/recipe-visuals": path.resolve(import.meta.dirname, "recipe-visuals.ts"),
            "@/lib/browser-env": path.resolve(import.meta.dirname, "browser-env.ts"),
            "convex-helpers/react/cache": path.resolve(import.meta.dirname, "convex-cache.tsx"),
            "@/providers": path.resolve(import.meta.dirname, "app-providers.tsx"),
            "@/lib/auth-client": path.resolve(import.meta.dirname, "auth-client.ts"),
            "@convex-dev/react-query": path.resolve(import.meta.dirname, "convex-query.ts"),
            "@/lib/telemetry/browser": path.resolve(import.meta.dirname, "telemetry.ts"),
            "@/hooks/auth-hooks": path.resolve(import.meta.dirname, "auth-hooks.ts"),
            "@/lib/convex-cached-query": path.resolve(import.meta.dirname, "cached-query.ts"),
            "convex/react": path.resolve(import.meta.dirname, "convex-react.tsx"),
            "@/convex": path.resolve(import.meta.dirname, "../convex"),
            "@": path.resolve(import.meta.dirname, "../src")
        }
    }
})
