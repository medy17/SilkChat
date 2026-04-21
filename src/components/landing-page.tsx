"use client"

import { useRef } from "react"
import { ArtifactsSection } from "./landing-page/artifacts-section"
import { ComparisonSection } from "./landing-page/comparison-section"
import { CtaSection } from "./landing-page/cta-section"
import { FaqSection } from "./landing-page/faq-section"
import { FeaturesSection } from "./landing-page/features-section"
import { FooterSection } from "./landing-page/footer-section"
import { HeroSection } from "./landing-page/hero-section"
import { PricingSection } from "./landing-page/pricing-section"
import { ProvidersSection } from "./landing-page/providers-section"
import { SecuritySection } from "./landing-page/security-section"
import { ShowcaseSection } from "./landing-page/showcase-section"
import { SocialProofSection } from "./landing-page/social-proof-section"
import { StickyNav } from "./landing-page/sticky-nav"
import { UseCasesSection } from "./landing-page/use-cases-section"

export function LandingPage() {
    const containerRef = useRef<HTMLDivElement>(null)

    return (
        <div
            ref={containerRef}
            className="h-screen snap-y snap-mandatory overflow-y-auto overflow-x-hidden bg-background text-foreground selection:bg-primary selection:text-primary-foreground"
        >
            <StickyNav containerRef={containerRef} />

            <main className="w-full">
                <HeroSection />
                <ShowcaseSection />
                <FeaturesSection />
                <UseCasesSection />
                <ArtifactsSection />
                <ComparisonSection />
                <SocialProofSection />
                <ProvidersSection />
                <PricingSection />
                <SecuritySection />
                <FaqSection />
                <CtaSection />
            </main>

            <FooterSection />
        </div>
    )
}
