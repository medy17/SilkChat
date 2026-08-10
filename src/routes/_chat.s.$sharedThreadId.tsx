import { createFileRoute } from "@tanstack/react-router"

const SITE_URL = "https://silkchat.dev"

export const Route = createFileRoute("/_chat/s/$sharedThreadId")({
    head: ({ params }) => {
        const sharedUrl = `${SITE_URL}/s/${encodeURIComponent(params.sharedThreadId)}`
        const imageUrl = `${SITE_URL}/api/og?sharedThreadId=${encodeURIComponent(params.sharedThreadId)}`
        const twitterImageUrl = `${imageUrl}&format=landscape`

        return {
            meta: [
                { title: "A conversation shared with you · SilkChat" },
                { property: "og:title", content: "A conversation shared with you" },
                { property: "og:image", content: imageUrl },
                { property: "og:image:alt", content: "A SilkChat conversation shared with you" },
                { property: "og:url", content: sharedUrl },
                { name: "twitter:title", content: "A conversation shared with you" },
                { name: "twitter:image", content: twitterImageUrl },
                {
                    name: "twitter:image:alt",
                    content: "A SilkChat conversation shared with you"
                }
            ],
            links: [{ rel: "canonical", href: sharedUrl }]
        }
    }
})
