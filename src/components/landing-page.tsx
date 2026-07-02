"use client"

import { useRef } from "react"

import { ArtifactsSection } from "./landing-page/artifacts-section"
import { CtaSection } from "./landing-page/cta-section"
import { FeaturesSection } from "./landing-page/features-section"
import { FooterSection } from "./landing-page/footer-section"
import { HeroSection } from "./landing-page/hero-section"
import { ImageGallerySection } from "./landing-page/image-gallery-section"
import { ModelSelectorSection } from "./landing-page/model-selector-section"
import { PricingSection } from "./landing-page/pricing-section"
import { ProvidersSection } from "./landing-page/providers-section"
import { SecuritySection } from "./landing-page/security-section"
import { SilkBackdrop } from "./landing-page/shared"
import { SocialProofSection } from "./landing-page/social-proof-section"
import { StickyNav } from "./landing-page/sticky-nav"
import { UseCasesSection } from "./landing-page/use-cases-section"

export function LandingPage() {
    const containerRef = useRef<HTMLDivElement>(null)

    return (
        <>
            <style>
                {`
                    .landing-page-root {
                        --landing-bg: var(--background);
                        --landing-fg: var(--foreground);
                        --landing-muted: color-mix(in oklab, var(--foreground) 68%, transparent);
                        --landing-muted-soft: color-mix(in oklab, var(--foreground) 54%, transparent);
                        --landing-muted-faint: color-mix(in oklab, var(--foreground) 40%, transparent);
                        --landing-border: color-mix(in oklab, var(--foreground) 12%, transparent);
                        --landing-border-strong: color-mix(in oklab, var(--foreground) 18%, transparent);
                        --landing-surface: color-mix(in oklab, var(--foreground) 2%, var(--background));
                        --landing-surface-strong: color-mix(in oklab, var(--foreground) 4%, var(--background));
                        --landing-surface-stronger: color-mix(in oklab, var(--foreground) 7%, var(--background));
                        --landing-surface-contrast: color-mix(in oklab, var(--foreground) 10%, var(--background));
                    }

                    .landing-page-scroll-root {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                        scrollbar-color: transparent transparent;
                    }

                    .landing-page-scroll-root::-webkit-scrollbar {
                        width: 0 !important;
                        height: 0 !important;
                        display: none !important;
                        background: transparent !important;
                    }

                    .landing-page-scroll-root::-webkit-scrollbar-thumb,
                    .landing-page-scroll-root::-webkit-scrollbar-track,
                    .landing-page-scroll-root::-webkit-scrollbar-corner,
                    .landing-page-scroll-root::-webkit-resizer {
                        background: transparent !important;
                        border: 0 !important;
                        box-shadow: none !important;
                    }
                `}
            </style>
            <div
                ref={containerRef}
                className="landing-page-root landing-page-scroll-root scrollbar-hide h-screen overflow-y-auto overflow-x-hidden bg-background text-foreground [-ms-overflow-style:none] [scrollbar-color:transparent_transparent] [scrollbar-width:none] selection:bg-primary selection:text-primary-foreground [&::-webkit-resizer]:hidden [&::-webkit-scrollbar-corner]:hidden [&::-webkit-scrollbar-thumb]:bg-transparent [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:hidden"
            >
                <div
                    aria-hidden="true"
                    className="pointer-events-none fixed inset-0 z-50 opacity-[0.035]"
                    style={{
                        backgroundImage: "url(/noise.png)",
                        backgroundRepeat: "repeat",
                        backgroundSize: "auto"
                    }}
                />

                <StickyNav containerRef={containerRef} />

                <main>
                    <HeroSection />
                    <ProvidersSection />
                    <ModelSelectorSection />
                    <FeaturesSection />
                    <ArtifactsSection />
                    <ImageGallerySection />
                    <UseCasesSection />
                    <SocialProofSection />
                    <PricingSection />
                    <SecuritySection />
                </main>

                <div className="relative overflow-hidden">
                    <SilkBackdrop silkClassName="opacity-45 dark:opacity-35" />
                    <CtaSection />
                    <FooterSection />
                </div>
            </div>
        </>
    )
}
