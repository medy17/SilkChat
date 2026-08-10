import { OG_DEMOS } from "@/lib/og-content"
import { createFileRoute } from "@tanstack/react-router"

const SITE_URL = "https://silkchat.dev"

export const Route = createFileRoute("/about")({
    head: () => ({
        meta: [
            { title: "About · SilkChat" },
            { property: "og:title", content: OG_DEMOS.about.title },
            { property: "og:description", content: OG_DEMOS.about.supportingText },
            { property: "og:image", content: `${SITE_URL}/api/og?demo=about` },
            { name: "twitter:title", content: OG_DEMOS.about.title },
            { name: "twitter:description", content: OG_DEMOS.about.supportingText },
            {
                name: "twitter:image",
                content: `${SITE_URL}/api/og?demo=about&format=landscape`
            }
        ],
        links: [{ rel: "canonical", href: `${SITE_URL}/about` }]
    })
})
