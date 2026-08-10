import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { loadServerEnv } from "@/lib/load-server-env"
import { OG_PREVIEWS, createSharedThreadOgContent, isOgPreview } from "@/lib/og-content"
import { isOgFormat, renderOgImage } from "@/lib/og-image"
import {
    type SharedOgLookupResult,
    renderSharedOgResponse,
    withImmutableOgCache
} from "@/lib/og-response"
import { createFileRoute } from "@tanstack/react-router"
import { ConvexHttpClient } from "convex/browser"

let convexClient: ConvexHttpClient | null = null

function getConvexClient() {
    if (convexClient) return convexClient

    loadServerEnv()
    const convexUrl = process.env.VITE_CONVEX_URL?.trim()
    if (!convexUrl) return null

    convexClient = new ConvexHttpClient(convexUrl)
    return convexClient
}

async function getSharedThreadContent(
    sharedThreadId: string
): Promise<SharedOgLookupResult<ReturnType<typeof createSharedThreadOgContent>>> {
    const client = getConvexClient()
    if (!client) return { status: "unavailable" }

    try {
        const sharedThread = await client.query(api.threads.getSharedThread, {
            sharedThreadId: sharedThreadId as Id<"sharedThreads">
        })
        if (!sharedThread) return { status: "not-found" }

        return {
            status: "ok",
            content: createSharedThreadOgContent({
                id: sharedThreadId,
                shareQuestion: sharedThread.shareQuestion,
                sharerName: sharedThread.sharerName,
                title: sharedThread.title,
                messages: sharedThread.messages
            })
        }
    } catch (error) {
        console.error("[og] Failed to load shared thread content", error)
        return { status: "unavailable" }
    }
}

export const Route = createFileRoute("/api/og")({
    server: {
        handlers: {
            GET: async ({ request }) => {
                const searchParams = new URL(request.url).searchParams
                const requestedFormat = searchParams.get("format")
                const requestedDemo = searchParams.get("demo")
                const hasSharedThreadId = searchParams.has("sharedThreadId")
                const sharedThreadId = searchParams.get("sharedThreadId")?.trim() ?? ""
                const format = isOgFormat(requestedFormat) ? requestedFormat : "wide"
                const assetOrigin = new URL(request.url).origin

                if (hasSharedThreadId) {
                    return renderSharedOgResponse({
                        sharedThreadId,
                        load: getSharedThreadContent,
                        render: (content) =>
                            renderOgImage(format, content ?? undefined, assetOrigin)
                    })
                }

                return withImmutableOgCache(
                    await renderOgImage(
                        format,
                        isOgPreview(requestedDemo) ? OG_PREVIEWS[requestedDemo] : undefined,
                        assetOrigin
                    )
                )
            }
        }
    }
})

export const ServerRoute = Route
