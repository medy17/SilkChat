import { staticOgImageUrl } from "@/lib/og-metadata"
import { createFileRoute } from "@tanstack/react-router"

const SITE_URL = "https://silkchat.dev"

export const Route = createFileRoute("/personas")({
    head: () => ({
        meta: [
            { title: "Personas · SilkChat" },
            { property: "og:title", content: "Who would you like to meet today?" },
            { property: "og:image", content: staticOgImageUrl(SITE_URL, "personas") },
            { name: "twitter:title", content: "Who would you like to meet today?" },
            {
                name: "twitter:image",
                content: staticOgImageUrl(SITE_URL, "personas", "landscape")
            }
        ],
        links: [{ rel: "canonical", href: `${SITE_URL}/personas` }]
    })
})
