import { createReadStream, statSync } from "node:fs"
import http from "node:http"
import path from "node:path"
import posthog from "@posthog/rollup-plugin"
import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
// vite.config.ts
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { type PluginOption, defineConfig, loadEnv } from "vite"
import analyzer from "vite-bundle-analyzer"
import svgr from "vite-plugin-svgr"
import {
    LOCAL_IMAGE_OPTIMIZER_DEFAULT_PORT,
    LOCAL_IMAGE_OPTIMIZER_ROUTE_PREFIX
} from "./src/lib/local-image-optimizer.ts"

const projectRoot = import.meta.dirname
const sandpackSsrStub = path.resolve(projectRoot, "./src/lib/sandpack-react-ssr-stub.tsx")
const anydocWasmDevRoute = "/vendor/anydoc/anydoc_wasm_bg.wasm"
const anydocWasmPath = path.resolve(
    projectRoot,
    "./node_modules/@firecrawl/anydoc-wasm/anydoc_wasm_bg.wasm"
)

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "")
    const posthogSourceMapPlugin =
        env.POSTHOG_API_KEY?.trim() && env.POSTHOG_PROJECT_ID?.trim()
            ? posthog({
                  personalApiKey: env.POSTHOG_API_KEY.trim(),
                  projectId: env.POSTHOG_PROJECT_ID.trim(),
                  host: env.POSTHOG_HOST?.trim() || "https://us.i.posthog.com",
                  sourcemaps: {
                      enabled: true,
                      releaseName: "silkchat-web",
                      releaseVersion:
                          env.APP_RELEASE?.trim() || env.VERCEL_GIT_COMMIT_SHA?.trim() || "unknown",
                      deleteAfterUpload: true
                  }
              })
            : null
    const convexApiUrl = env.VITE_CONVEX_API_URL?.trim()
    const convexApiTarget = convexApiUrl ? new URL(convexApiUrl) : null
    const convexApiOrigin = convexApiTarget
        ? `${convexApiTarget.protocol}//${convexApiTarget.host}`
        : null
    const convexApiBasePath = convexApiTarget?.pathname.replace(/\/$/, "") || ""
    const localImageOptimizerEnabled =
        (
            process.env.VITE_LOCAL_IMAGE_OPTIMIZER_ENABLED ?? env.VITE_LOCAL_IMAGE_OPTIMIZER_ENABLED
        )?.trim() === "1"
    const localImageOptimizerPort =
        (process.env.LOCAL_IMAGE_OPTIMIZER_PORT || "").trim() ||
        String(LOCAL_IMAGE_OPTIMIZER_DEFAULT_PORT)
    const proxy: Record<
        string,
        {
            target: string
            changeOrigin: boolean
            rewrite?: (requestPath: string) => string
        }
    > = convexApiOrigin
        ? {
              "/convex-http": {
                  target: convexApiOrigin,
                  changeOrigin: true,
                  rewrite: (requestPath: string) =>
                      requestPath.replace(/^\/convex-http/, convexApiBasePath)
              }
          }
        : {}

    // NOTE: the local image optimizer is intentionally NOT registered via
    // `server.proxy`. TanStack Start's dev SSR middleware runs ahead of Vite's
    // proxy middleware for document requests (`Accept: text/html`), so a browser
    // navigation to the local optimizer route gets a slash-collapsing 307 followed by
    // the SPA 404 shell instead of reaching the optimizer. It is served by the
    // `local-image-optimizer-proxy` plugin below, which is `enforce: "pre"` and
    // therefore intercepts before the SSR handler for every `Accept` type.
    const localImageOptimizerPlugin: PluginOption =
        localImageOptimizerEnabled &&
        ({
            name: "local-image-optimizer-proxy",
            enforce: "pre",
            configureServer(server) {
                const routePrefix = `${LOCAL_IMAGE_OPTIMIZER_ROUTE_PREFIX}/`
                server.middlewares.use((req, res, next) => {
                    if (!req.url?.startsWith(routePrefix)) {
                        next()
                        return
                    }

                    const proxyReq = http.request(
                        {
                            host: "127.0.0.1",
                            port: Number(localImageOptimizerPort),
                            method: req.method,
                            path: req.url,
                            headers: req.headers
                        },
                        (proxyRes) => {
                            res.statusCode = proxyRes.statusCode ?? 502
                            for (const [header, value] of Object.entries(proxyRes.headers)) {
                                if (value !== undefined) {
                                    res.setHeader(header, value)
                                }
                            }
                            proxyRes.pipe(res)
                        }
                    )

                    proxyReq.on("error", () => {
                        res.statusCode = 502
                        res.setHeader("content-type", "application/json")
                        res.end(JSON.stringify({ error: "Local image optimizer unavailable" }))
                    })

                    req.pipe(proxyReq)
                })
            }
        } satisfies PluginOption)

    const anydocWasmDevPlugin: PluginOption = {
        name: "anydoc-wasm-dev-asset",
        apply: "serve",
        enforce: "pre",
        configureServer(server) {
            server.middlewares.use(anydocWasmDevRoute, (req, res, next) => {
                if (req.method !== "GET" && req.method !== "HEAD") {
                    next()
                    return
                }

                const { size } = statSync(anydocWasmPath)
                res.statusCode = 200
                res.setHeader("content-type", "application/wasm")
                res.setHeader("content-length", String(size))
                res.setHeader("cache-control", "no-cache")

                if (req.method === "HEAD") {
                    res.end()
                    return
                }

                createReadStream(anydocWasmPath).pipe(res)
            })
        }
    }

    return {
        resolve: {
            alias: {
                "@/convex": path.resolve(projectRoot, "./convex"),
                "@": path.resolve(projectRoot, "./src"),
                "@tanstack/react-start/server": path.resolve(
                    projectRoot,
                    "./src/lib/tanstack-react-start-server-shim.ts"
                ),
                "micromark-extension-math": "micromark-extension-llm-math"
            },
            tsconfigPaths: true
        },
        server: {
            proxy: Object.keys(proxy).length > 0 ? proxy : undefined
        },
        plugins: [
            anydocWasmDevPlugin,
            localImageOptimizerPlugin,
            posthogSourceMapPlugin,
            (process.env.ANALYZE && analyzer()) || null,
            {
                name: "ssr-sandpack-stub",
                enforce: "pre",
                resolveId(id, _importer, options) {
                    if (options?.ssr && id === "@codesandbox/sandpack-react") {
                        return sandpackSsrStub
                    }
                }
            },
            tanstackStart({
                spa: {
                    enabled: true
                }
            }),
            react(),
            babel({ presets: [reactCompilerPreset()] }),
            tailwindcss(),
            svgr({ include: "**/*.svg" }),
            nitro()
        ],
        environments: {
            ssr: {
                build: {
                    rollupOptions: {
                        input: "./src/server.ts"
                    }
                }
            }
        }
    }
})
