import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { LibraryLightbox } from "@/components/landing-page/library-lightbox"
import { galleryImages } from "@/components/landing-page/content"
import { Button } from "@/components/ui/button"
function Example() {
    const [index, setIndex] = useState<number | null>(0)
    return (
        <>
            <Button onClick={() => setIndex(0)}>Open gallery</Button>
            <LibraryLightbox
                images={galleryImages}
                index={index}
                onClose={() => setIndex(null)}
                onNavigate={setIndex}
            />
        </>
    )
}
const meta = {
    title: "Landing/Library lightbox",
    render: () => <Example />,
    parameters: {
        docs: {
            description: {
                component:
                    "The image-gallery-section.tsx lightbox with its actual gallery images, navigation and close/reopen behavior."
            }
        }
    }
} satisfies Meta
export default meta
export const Gallery: StoryObj<typeof meta> = {}
