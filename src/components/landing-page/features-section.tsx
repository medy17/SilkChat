"use client"

import { MobileSnapCarousel } from "@/components/landing-page/mobile-snap-carousel"
import { MagicCard } from "@/components/magic-cards"
import { cn } from "@/lib/utils"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { BrainCircuit, FileText, FileUp, Globe, Image as ImageIcon, Users } from "lucide-react"
import type { ComponentType } from "react"
import { useRef } from "react"

gsap.registerPlugin(ScrollTrigger)

type Feature = {
    title: string
    description: string
    Icon: ComponentType<{ className?: string }>
    gradientFrom: string
    gradientTo: string
    iconClassName: string
    badge?: string
}

const features: Feature[] = [
    {
        title: "Multi-Model Mastery",
        description:
            "Switch between GPT-5.4, Claude 4.6, Gemini 3.1 Pro, and dozens more instantly.",
        Icon: BrainCircuit,
        gradientFrom: "rgba(59, 130, 246, 0.2)",
        gradientTo: "rgba(37, 99, 235, 0.1)",
        iconClassName: "bg-blue-500/10 text-blue-500"
    },
    {
        title: "Real-time Web Search",
        description:
            "Ground your chats with the latest information from the web for accurate, up-to-date answers.",
        Icon: Globe,
        gradientFrom: "rgba(16, 185, 129, 0.2)",
        gradientTo: "rgba(5, 150, 105, 0.1)",
        iconClassName: "bg-emerald-500/10 text-emerald-500"
    },
    {
        title: "Stunning Image Gen",
        description:
            "Create and manage your images in our innovative Library View using Nano Banana, Seedream, FLUX, and more.",
        Icon: ImageIcon,
        gradientFrom: "rgba(249, 115, 22, 0.2)",
        gradientTo: "rgba(234, 88, 12, 0.1)",
        iconClassName: "bg-orange-500/10 text-orange-500"
    },
    {
        title: "Smart Artifacts",
        description: "Preview your code and documents on the fly without switching tabs.",
        Icon: FileText,
        gradientFrom: "rgba(139, 92, 246, 0.2)",
        gradientTo: "rgba(124, 58, 237, 0.1)",
        iconClassName: "bg-purple-500/10 text-purple-500"
    },
    {
        title: "Universal Import",
        description:
            "Migrate your existing conversations from ChatGPT, Claude, and other platforms effortlessly with a single click.",
        Icon: FileUp,
        gradientFrom: "rgba(236, 72, 153, 0.2)",
        gradientTo: "rgba(219, 39, 119, 0.1)",
        iconClassName: "bg-pink-500/10 text-pink-500",
        badge: "New Feature"
    },
    {
        title: "Custom Personas",
        description:
            "Craft tailored AI personalities with unique system prompts and context to suit your specific workflows and tasks.",
        Icon: Users,
        gradientFrom: "rgba(6, 182, 212, 0.2)",
        gradientTo: "rgba(8, 145, 178, 0.1)",
        iconClassName: "bg-cyan-500/10 text-cyan-500",
        badge: "New Feature"
    }
]

function FeatureCard({ feature, className }: { feature: Feature; className?: string }) {
    const { Icon } = feature

    return (
        <MagicCard
            gradientFrom={feature.gradientFrom}
            gradientTo={feature.gradientTo}
            className={cn(
                "feature-card h-full rounded-xl p-8",
                feature.badge && "relative overflow-hidden",
                className
            )}
            style={{ willChange: "transform, opacity" }}
        >
            {feature.badge ? (
                <div className="absolute top-0 right-0 rounded-bl-xl bg-primary/10 px-3 py-1 font-bold text-[10px] text-primary uppercase tracking-wider shadow-sm backdrop-blur-md">
                    {feature.badge}
                </div>
            ) : null}
            <div
                className={cn(
                    "mb-4 flex h-12 w-12 items-center justify-center rounded-lg",
                    feature.iconClassName
                )}
            >
                <Icon className="h-6 w-6" />
            </div>
            <h3 className="mb-2 font-bold text-xl">{feature.title}</h3>
            <p className="text-muted-foreground">{feature.description}</p>
        </MagicCard>
    )
}

export function FeaturesSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useGSAP(
        () => {
            const scroller = document.querySelector("main")?.parentElement // The containerRef from landing page

            gsap.fromTo(
                ".feature-header",
                { y: 40, opacity: 0, filter: "blur(10px)" },
                {
                    y: 0,
                    opacity: 1,
                    filter: "blur(0px)",
                    duration: 1,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: sectionRef.current,
                        scroller: scroller || undefined,
                        start: "top 75%"
                    },
                    clearProps: "willChange"
                }
            )
            gsap.fromTo(
                ".feature-card",
                { y: 50, opacity: 0, scale: 0.95 },
                {
                    y: 0,
                    opacity: 1,
                    scale: 1,
                    duration: 0.8,
                    stagger: 0.1,
                    ease: "back.out(1.2)",
                    scrollTrigger: {
                        trigger: sectionRef.current,
                        scroller: scroller || undefined,
                        start: "top 65%"
                    },
                    clearProps: "willChange"
                }
            )
        },
        { scope: sectionRef }
    )

    return (
        <section
            id="features"
            ref={sectionRef}
            className="flex min-h-screen snap-start flex-col items-center justify-center px-6 py-20"
        >
            <div className="container mx-auto">
                <div
                    className="feature-header mb-8 px-6 text-center md:mb-16 md:px-0"
                    style={{ willChange: "transform, opacity, filter" }}
                >
                    <h2 className="mb-4 font-bold text-3xl md:text-5xl">Everything you need</h2>
                    <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                        Built for power users and teams who want the most out of their AI
                        experience.
                    </p>
                </div>

                <MobileSnapCarousel
                    items={features}
                    getKey={(feature) => feature.title}
                    renderItem={(feature) => <FeatureCard feature={feature} />}
                />

                <div className="hidden grid-cols-1 gap-6 md:grid md:grid-cols-2 lg:grid-cols-3">
                    {features.map((feature) => (
                        <FeatureCard key={feature.title} feature={feature} />
                    ))}
                </div>
            </div>
        </section>
    )
}
