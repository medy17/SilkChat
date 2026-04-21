"use client"

import { MagicCard } from "@/components/magic-cards"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { BrainCircuit, FileText, FileUp, Globe, Image as ImageIcon, Users } from "lucide-react"
import { useRef } from "react"

gsap.registerPlugin(ScrollTrigger)

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
                    className="feature-header mb-16 text-center"
                    style={{ willChange: "transform, opacity, filter" }}
                >
                    <h2 className="mb-4 font-bold text-3xl md:text-5xl">Everything you need</h2>
                    <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                        Built for power users and teams who want the most out of their AI
                        experience.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <MagicCard
                        gradientFrom="rgba(59, 130, 246, 0.2)"
                        gradientTo="rgba(37, 99, 235, 0.1)"
                        className="feature-card rounded-xl p-8"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                            <BrainCircuit className="h-6 w-6" />
                        </div>
                        <h3 className="mb-2 font-bold text-xl">Multi-Model Mastery</h3>
                        <p className="text-muted-foreground">
                            Switch between GPT-5.4, Claude 4.6, Gemini 3.1 Pro, and dozens more
                            instantly.
                        </p>
                    </MagicCard>

                    <MagicCard
                        gradientFrom="rgba(16, 185, 129, 0.2)"
                        gradientTo="rgba(5, 150, 105, 0.1)"
                        className="feature-card rounded-xl p-8"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                            <Globe className="h-6 w-6" />
                        </div>
                        <h3 className="mb-2 font-bold text-xl">Real-time Web Search</h3>
                        <p className="text-muted-foreground">
                            Ground your chats with the latest information from the web for accurate,
                            up-to-date answers.
                        </p>
                    </MagicCard>

                    <MagicCard
                        gradientFrom="rgba(249, 115, 22, 0.2)"
                        gradientTo="rgba(234, 88, 12, 0.1)"
                        className="feature-card rounded-xl p-8"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                            <ImageIcon className="h-6 w-6" />
                        </div>
                        <h3 className="mb-2 font-bold text-xl">Stunning Image Gen</h3>
                        <p className="text-muted-foreground">
                            Create and manage your images in our innovative Library View using Nano
                            Banana, Seedream, FLUX, and more.
                        </p>
                    </MagicCard>

                    <MagicCard
                        gradientFrom="rgba(139, 92, 246, 0.2)"
                        gradientTo="rgba(124, 58, 237, 0.1)"
                        className="feature-card rounded-xl p-8"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                            <FileText className="h-6 w-6" />
                        </div>
                        <h3 className="mb-2 font-bold text-xl">Smart Artifacts</h3>
                        <p className="text-muted-foreground">
                            Preview your code and documents on the fly without switching tabs.
                        </p>
                    </MagicCard>

                    <MagicCard
                        gradientFrom="rgba(236, 72, 153, 0.2)"
                        gradientTo="rgba(219, 39, 119, 0.1)"
                        className="feature-card relative overflow-hidden rounded-xl p-8"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="absolute top-0 right-0 rounded-bl-xl bg-pink-500/20 px-3 py-1 font-bold text-[10px] text-pink-600 uppercase tracking-wider shadow-sm backdrop-blur-md">
                            New Feature
                        </div>
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-pink-500/10 text-pink-500">
                            <FileUp className="h-6 w-6" />
                        </div>
                        <h3 className="mb-2 font-bold text-xl">Universal Import</h3>
                        <p className="text-muted-foreground">
                            Migrate your existing conversations from ChatGPT, Claude, and other
                            platforms effortlessly with a single click.
                        </p>
                    </MagicCard>

                    <MagicCard
                        gradientFrom="rgba(6, 182, 212, 0.2)"
                        gradientTo="rgba(8, 145, 178, 0.1)"
                        className="feature-card relative overflow-hidden rounded-xl p-8"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="absolute top-0 right-0 rounded-bl-xl bg-cyan-500/20 px-3 py-1 font-bold text-[10px] text-cyan-600 uppercase tracking-wider shadow-sm backdrop-blur-md">
                            New Feature
                        </div>
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500">
                            <Users className="h-6 w-6" />
                        </div>
                        <h3 className="mb-2 font-bold text-xl">Custom Personas</h3>
                        <p className="text-muted-foreground">
                            Craft tailored AI personalities with unique system prompts and context
                            to suit your specific workflows and tasks.
                        </p>
                    </MagicCard>
                </div>
            </div>
        </section>
    )
}
