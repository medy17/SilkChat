import {
    type GoogleTrendingSearch,
    parseGoogleTrendsRss,
    resolveGoogleTrendsRequestGeo
} from "@/lib/google-trends-rss"
import { createFileRoute } from "@tanstack/react-router"

const CACHE_TTL_MS = 15 * 60 * 1_000
const STALE_TTL_MS = 60 * 60 * 1_000
const memoryCache = new Map<string, { items: GoogleTrendingSearch[]; fetchedAt: number }>()

const responseHeaders = {
    "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "X-Vercel-IP-Country"
}

export const Route = createFileRoute("/api/search-trends")({
    server: {
        handlers: {
            GET: async ({ request }) => {
                const url = new URL(request.url)
                const geo = resolveGoogleTrendsRequestGeo({
                    vercelCountry: request.headers.get("x-vercel-ip-country"),
                    fallbackGeo: url.searchParams.get("fallbackGeo")
                })
                const cached = memoryCache.get(geo)
                if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
                    return Response.json({ items: cached.items, geo }, { headers: responseHeaders })
                }

                try {
                    const response = await fetch(
                        `https://trends.google.com/trending/rss?geo=${geo}`,
                        { headers: { Accept: "application/rss+xml, application/xml;q=0.9" } }
                    )
                    if (!response.ok) {
                        throw new Error(`Google Trends RSS returned ${response.status}`)
                    }

                    const items = parseGoogleTrendsRss(await response.text())
                    if (items.length === 0) {
                        throw new Error("Google Trends RSS returned no usable searches")
                    }

                    memoryCache.set(geo, { items, fetchedAt: Date.now() })
                    return Response.json({ items, geo }, { headers: responseHeaders })
                } catch (error) {
                    console.error("[search-trends] Failed to refresh Google Trends RSS", {
                        geo,
                        error
                    })

                    if (cached && Date.now() - cached.fetchedAt < STALE_TTL_MS) {
                        return Response.json(
                            { items: cached.items, geo, stale: true },
                            { headers: responseHeaders }
                        )
                    }

                    return Response.json(
                        { items: [], geo },
                        { headers: responseHeaders, status: 502 }
                    )
                }
            }
        }
    }
})

export const ServerRoute = Route
