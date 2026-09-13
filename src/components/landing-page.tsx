"use client"

import { useRef } from "react"

import { ArtifactsSection } from "./landing-page/artifacts-section"
import { CtaSection } from "./landing-page/cta-section"
import { FooterSection } from "./landing-page/footer-section"
import { HeroSection } from "./landing-page/hero-section"
import { ImageGallerySection } from "./landing-page/image-gallery-section"
import { LandingStory } from "./landing-page/landing-story"
import { PricingSection } from "./landing-page/pricing-section"
import { ProvidersSection } from "./landing-page/providers-section"
import { SecuritySection } from "./landing-page/security-section"
import { SocialProofSection } from "./landing-page/social-proof-section"
import { StickyNav } from "./landing-page/sticky-nav"
import { UseCasesSection } from "./landing-page/use-cases-section"
import "./landing-page/landing-page.css"

export function LandingPage() {
    const containerRef = useRef<HTMLDivElement>(null)

    return (
        <div ref={containerRef} className="landing-page-root landing-redesign">
            <a className="landing-skip" href="#landing-content">
                Skip to content
            </a>
            <StickyNav containerRef={containerRef} />
            <main id="landing-content" tabIndex={-1}>
                <HeroSection containerRef={containerRef} />
                <LandingStory>
                    <ProvidersSection containerRef={containerRef} />
                    <UseCasesSection containerRef={containerRef} />
                    <ArtifactsSection containerRef={containerRef} />
                    <ImageGallerySection containerRef={containerRef} />
                    <SocialProofSection containerRef={containerRef} />
                    <SecuritySection containerRef={containerRef} />
                </LandingStory>
                <PricingSection />
                <CtaSection />
            </main>
            <FooterSection />
        </div>
    )
}
