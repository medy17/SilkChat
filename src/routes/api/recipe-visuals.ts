import { api } from "@/convex/_generated/api.js"
import { authServer } from "@/lib/auth-server"
import { searchBraveImages } from "@/lib/brave-image-search"
import { createFileRoute } from "@tanstack/react-router"

const responseHeaders = {
    "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
    "Content-Type": "application/json; charset=utf-8"
}

export const Route = createFileRoute("/api/recipe-visuals")({
    server: {
        handlers: {
            GET: async ({ request }) => {
                const currentUser = await authServer.fetchAuthQuery(api.auth.getCurrentUser)
                if (!currentUser) {
                    return Response.json({ error: "Unauthorized" }, { status: 401 })
                }

                const url = new URL(request.url)
                const cue = url.searchParams.get("q")?.replace(/\s+/g, " ").trim().slice(0, 160)
                const variant = url.searchParams.get("variant") === "step" ? "step" : "gallery"
                const requestedLimit = Number(url.searchParams.get("limit"))
                const limit = Number.isFinite(requestedLimit)
                    ? Math.min(3, Math.max(1, Math.floor(requestedLimit)))
                    : 3
                if (!cue) return Response.json({ error: "Missing visual cue" }, { status: 400 })

                const apiKey = process.env.BRAVE_API_KEY?.trim()
                if (!apiKey) {
                    return Response.json(
                        { error: "Recipe visuals are not configured" },
                        { status: 503 }
                    )
                }

                const quota = await authServer.fetchAuthMutation(
                    api.auth.consumeRecipeVisualSearchQuota
                )
                if (quota.unauthorized) {
                    return Response.json({ error: "Unauthorized" }, { status: 401 })
                }
                if (!quota.allowed) {
                    return Response.json(
                        { error: "Too many recipe visual searches" },
                        {
                            status: 429,
                            headers: { "Retry-After": String(quota.retryAfterSeconds) }
                        }
                    )
                }

                try {
                    const visuals = await searchBraveImages({ cue, limit, variant, apiKey })
                    return Response.json({ visuals }, { headers: responseHeaders })
                } catch (error) {
                    console.error("[recipe-visuals] Brave image search failed", { error })
                    return Response.json({ visuals: [] }, { status: 502 })
                }
            }
        }
    }
})

export const ServerRoute = Route
