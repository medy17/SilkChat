import path from "node:path"
import { loadServerEnv } from "../src/lib/load-server-env"
import {
    LOCAL_IMAGE_OPTIMIZER_CACHE_DIR,
    LOCAL_IMAGE_OPTIMIZER_DEFAULT_PORT,
    LOCAL_IMAGE_OPTIMIZER_PURGE_PATH,
    formatLocalImageOptimizerRequestLog
} from "../src/lib/local-image-optimizer"
import { createLocalImageOptimizerHandler } from "../src/lib/local-image-optimizer-server"

loadServerEnv()

const parsePort = (value: string | undefined) => {
    if (!value) {
        return LOCAL_IMAGE_OPTIMIZER_DEFAULT_PORT
    }

    const parsed = Number.parseInt(value, 10)
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
        throw new Error(`Invalid LOCAL_IMAGE_OPTIMIZER_PORT: ${value}`)
    }

    return parsed
}

const convexApiUrl = process.env.VITE_CONVEX_API_URL?.trim()
if (!convexApiUrl) {
    throw new Error("Missing VITE_CONVEX_API_URL for local image optimizer")
}

const publicAssetBaseUrl = process.env.VITE_R2_PUBLIC_BASE_URL?.trim()
if (!publicAssetBaseUrl) {
    throw new Error("Missing VITE_R2_PUBLIC_BASE_URL for local image optimizer")
}

const port = parsePort(process.env.LOCAL_IMAGE_OPTIMIZER_PORT)
const cacheDir = path.resolve(process.cwd(), LOCAL_IMAGE_OPTIMIZER_CACHE_DIR)
const handleRequest = createLocalImageOptimizerHandler({
    cacheDir,
    convexApiUrl,
    publicAssetBaseUrl
})

const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    async fetch(request) {
        const startedAt = performance.now()
        const requestUrl = new URL(request.url)

        try {
            const response = await handleRequest(request)
            const body = response.body ? new Uint8Array(await response.arrayBuffer()) : undefined
            let removed: number | undefined

            if (requestUrl.pathname === LOCAL_IMAGE_OPTIMIZER_PURGE_PATH && response.ok && body) {
                try {
                    const result = JSON.parse(new TextDecoder().decode(body)) as {
                        removed?: unknown
                    }
                    if (typeof result.removed === "number") removed = result.removed
                } catch {
                    // The response remains authoritative if its logging metadata is malformed.
                }
            }

            console.log(
                formatLocalImageOptimizerRequestLog({
                    method: request.method,
                    pathname: requestUrl.pathname,
                    status: response.status,
                    cacheStatus: response.headers.get("x-silkchat-local-image-optimizer"),
                    contentType: response.headers.get("content-type"),
                    bytes: body?.byteLength ?? 0,
                    durationMs: performance.now() - startedAt,
                    removed
                })
            )
            return new Response(body, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            })
        } catch (error) {
            console.error("[local-image-optimizer] Unhandled request failure", error)
            return Response.json({ error: "Internal server error" }, { status: 500 })
        }
    }
})

console.log(`[local-image-optimizer] listening on ${server.url} with cache ${cacheDir}`)

const shutdown = () => {
    server.stop()
    process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
