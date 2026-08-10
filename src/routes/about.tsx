import { createFileRoute } from "@tanstack/react-router"

const SITE_URL = "https://silkchat.dev"

export const Route = createFileRoute("/about")({
    head: () => ({
        meta: [
            { title: "About · SilkChat" },
            { property: "og:title", content: "Come see what we’re building." },
            { property: "og:image", content: `${SITE_URL}/api/og?demo=about` },
            { name: "twitter:title", content: "Come see what we’re building." },
            {
                name: "twitter:image",
                content: `${SITE_URL}/api/og?demo=about&format=landscape`
            }
        ],
        links: [{ rel: "canonical", href: `${SITE_URL}/about` }]
    })
})
