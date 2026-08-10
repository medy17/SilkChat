import { OgCaptureGallery } from "@/components/og-capture-gallery"
import { OG_DEMOS, OG_SQUARE_STRESS_DEMOS } from "@/lib/og-content"
import ogDemoCss from "@/styles/og-demo.css?url"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/og-demo")({
    head: () => ({
        meta: [{ title: "OG canvas studio | SilkChat" }],
        links: [
            {
                rel: "stylesheet",
                href: "https://fonts.googleapis.com/css2?family=Geist:wght@500;700&display=swap"
            },
            { rel: "stylesheet", href: ogDemoCss }
        ]
    }),
    component: OgDemoPage
})

function OgDemoPage() {
    return (
        <OgCaptureGallery
            heading="Open Graph route demos"
            description="Four friendly directions using a strict title-first hierarchy."
            examples={[OG_DEMOS.home, OG_DEMOS.about, OG_DEMOS.personas, OG_DEMOS.shared]}
            squareStressExamples={OG_SQUARE_STRESS_DEMOS}
        />
    )
}
