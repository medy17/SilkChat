import { staticOgImageUrl } from "@/lib/og-metadata"
import { createFileRoute } from "@tanstack/react-router"

const SITE_URL = "https://silkchat.dev"

export const Route = createFileRoute("/about")({
    head: () => ({
        meta: [
            { title: "About · SilkChat" },
            { property: "og:title", content: "Come see what we’re building." },
            { property: "og:image", content: staticOgImageUrl(SITE_URL, "about") },
            { name: "twitter:title", content: "Come see what we’re building." },
            {
                name: "twitter:image",
                content: staticOgImageUrl(SITE_URL, "about", "landscape")
            }
        ],
        links: [{ rel: "canonical", href: `${SITE_URL}/about` }]
    })
})
