import { OgCaptureGallery } from "@/components/og-capture-gallery"
import ogDemoCss from "@/styles/og-demo.css?url"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/og-backgrounds")({
    head: () => ({
        meta: [{ title: "OG background studio | SilkChat" }],
        links: [{ rel: "stylesheet", href: ogDemoCss }]
    }),
    component: OgBackgroundsPage
})

function OgBackgroundsPage() {
    return (
        <OgCaptureGallery
            showLogo={false}
            heading="Textless OG canvases"
            description="The approved silk composition, ready for clean background capture."
            filenameLabel="background"
        />
    )
}
