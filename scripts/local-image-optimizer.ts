import { type IncomingHttpHeaders, createServer } from "node:http"
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

const toHeaderEntries = (headers: IncomingHttpHeaders): [string, string][] =>
    Object.entries(headers).flatMap(([key, value]) =>
        value === undefined
            ? []
            : Array.isArray(value)
              ? ([[key, value.join(", ")]] as [string, string][])
              : ([[key, value]] as [string, string][])
    )

const server = createServer(async (req, res) => {
    const startedAt = performance.now()

    try {
        const origin = `http://${req.headers.host ?? `127.0.0.1:${port}`}`
        const requestUrl = new URL(req.url ?? "/", origin)
        const request = new Request(requestUrl, {
            method: req.method ?? "GET",
            headers: new Headers(toHeaderEntries(req.headers))
        })

        const response = await handleRequest(request)

        res.statusCode = response.status
        response.headers.forEach((value, key) => {
            res.setHeader(key, value)
        })

        const body = response.body ? Buffer.from(await response.arrayBuffer()) : Buffer.alloc(0)
        let removed: number | undefined

        if (requestUrl.pathname === LOCAL_IMAGE_OPTIMIZER_PURGE_PATH && response.ok) {
            try {
                const result = JSON.parse(body.toString()) as { removed?: unknown }
                if (typeof result.removed === "number") {
                    removed = result.removed
                }
            } catch {
                // The response itself remains authoritative if its logging metadata is malformed.
            }
        }

        res.end(body)
        console.log(
            formatLocalImageOptimizerRequestLog({
                method: request.method,
                pathname: requestUrl.pathname,
                status: response.status,
                cacheStatus: response.headers.get("x-silkchat-local-image-optimizer"),
                contentType: response.headers.get("content-type"),
                bytes: body.byteLength,
                durationMs: performance.now() - startedAt,
                removed
            })
        )
    } catch (error) {
        console.error("[local-image-optimizer] Unhandled request failure", error)
        res.statusCode = 500
        res.setHeader("content-type", "application/json")
        res.end(JSON.stringify({ error: "Internal server error" }))
    }
})

server.listen(port, "127.0.0.1", () => {
    console.log(
        `[local-image-optimizer] listening on http://127.0.0.1:${port} with cache ${cacheDir}`
    )
})

const shutdown = () => {
    server.close(() => process.exit(0))
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
