"use client"

import { ArrowRight } from "lucide-react"
import { useState } from "react"

import { galleryImages } from "@/components/landing-page/content"
import { LibraryLightbox } from "@/components/landing-page/library-lightbox"
import { SectionHead, SignInButton } from "@/components/landing-page/shared"
import { LibraryLogo } from "@/components/logo"
import { Masonry } from "@/components/react-bits/masonry"

export function ImageGallerySection() {
    const [activeIndex, setActiveIndex] = useState<number | null>(null)

    return (
        <section id="gallery" className="border-t py-24 [border-color:var(--landing-border)]">
            <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
                <SectionHead title={<LibraryLogo className="h-10 w-auto md:h-12" />}>
                    Envision your ideas with GPT Image 2, Seedream V4.5, Nano Banana Pro, FLUX.2
                    [flex], and more in a First-Class library UI made for concurrent generation,
                    detailed parameters, and intuitive library management.
                </SectionHead>

                <Masonry
                    items={galleryImages}
                    animateFrom="bottom"
                    blurToFocus
                    scaleOnHover
                    hoverScale={1.01}
                    duration={0.6}
                    stagger={0.06}
                    onItemClick={(item) => {
                        const nextIndex = galleryImages.findIndex((image) => image.id === item.id)
                        if (nextIndex >= 0) {
                            setActiveIndex(nextIndex)
                        }
                    }}
                />

                <div className="mt-12 flex justify-center">
                    <SignInButton className="gap-2">
                        Start generating
                        <ArrowRight className="size-4" />
                    </SignInButton>
                </div>
            </div>

            <LibraryLightbox
                images={galleryImages}
                index={activeIndex}
                onClose={() => setActiveIndex(null)}
                onNavigate={setActiveIndex}
            />
        </section>
    )
}
