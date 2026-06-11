"use client"

import { MobileSnapCarousel } from "@/components/landing-page/mobile-snap-carousel"
import { cn } from "@/lib/utils"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { Check, Code, FileText, Sparkles, VenetianMask } from "lucide-react"
import type { ComponentType } from "react"
import { useRef } from "react"

gsap.registerPlugin(ScrollTrigger)

type UseCase = {
    title: string
    description: string
    Icon: ComponentType<{ className?: string }>
    accentClassName: string
    checks: string[]
}

const useCases: UseCase[] = [
    {
        title: "Developers",
        description:
            "Compare answers across models instantly. Use Smart Artifacts to preview UI components right in the chat.",
        Icon: Code,
        accentClassName: "text-blue-500 bg-blue-500/10",
        checks: ["Code refactoring", "Live UI previews", "Complex debugging"]
    },
    {
        title: "Creators",
        description:
            "Brainstorm ideas with the sharpest models, and generate breathtaking images using top-tier models like FLUX.",
        Icon: Sparkles,
        accentClassName: "text-purple-500 bg-purple-500/10",
        checks: ["High-res image generation", "Ideation & outlining", "Creative feedback"]
    },
    {
        title: "Researchers",
        description:
            "Utilize real-time web search to ground your questions in fact. Upload dense documents for rapid analysis.",
        Icon: FileText,
        accentClassName: "text-emerald-500 bg-emerald-500/10",
        checks: ["Live web grounding", "Document analysis", "Source summarization"]
    },
    {
        title: "Roleplayers",
        description:
            "Immerse yourself in infinite worlds. Build custom Personas with deep backstories and distinct, unfiltered voices.",
        Icon: VenetianMask,
        accentClassName: "text-pink-500 bg-pink-500/10",
        checks: ["Deep character prompts", "Consistent persona voice", "Unfiltered model choices"]
    }
]

function UseCaseCard({ useCase }: { useCase: UseCase }) {
    const { Icon } = useCase

    return (
        <div
            className="use-case-card flex h-full flex-col items-center rounded-xl border border-border/50 bg-background/50 p-6 text-center lg:p-8"
            style={{ willChange: "transform, opacity" }}
        >
            <div
                className={cn(
                    "mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-lg",
                    useCase.accentClassName
                )}
            >
                <Icon className="h-8 w-8" />
            </div>
            <h3 className="mb-4 font-bold text-2xl">{useCase.title}</h3>
            <p className="mb-6 flex-1 text-muted-foreground text-sm leading-relaxed lg:text-base">
                {useCase.description}
            </p>
            <ul className="w-full space-y-2 text-left text-muted-foreground text-sm">
                {useCase.checks.map((check) => (
                    <li key={check} className="flex items-center gap-2">
                        <Check
                            className={cn(
                                "h-4 w-4 shrink-0",
                                useCase.accentClassName.split(" ")[0]
                            )}
                        />
                        {check}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export function UseCasesSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useGSAP(
        () => {
            const scroller = document.querySelector("main")?.parentElement

            gsap.fromTo(
                ".use-case-header",
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
                ".use-case-card",
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
            id="use-cases"
            ref={sectionRef}
            className="flex min-h-[80vh] snap-start flex-col items-center justify-center bg-muted/5 px-6 py-20"
        >
            <div className="container mx-auto max-w-6xl">
                <div
                    className="use-case-header mb-8 px-6 text-center md:mb-16 md:px-0"
                    style={{ willChange: "transform, opacity, filter" }}
                >
                    <h2 className="mb-4 font-bold text-3xl md:text-5xl">Built for everyone</h2>
                    <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                        Whether you're writing code or drafting an essay, SilkChat adapts to your
                        workflow.
                    </p>
                </div>

                <MobileSnapCarousel
                    items={useCases}
                    getKey={(useCase) => useCase.title}
                    renderItem={(useCase) => <UseCaseCard useCase={useCase} />}
                />

                <div className="hidden grid-cols-1 gap-6 md:grid md:grid-cols-2 lg:grid-cols-4">
                    {useCases.map((useCase) => (
                        <UseCaseCard key={useCase.title} useCase={useCase} />
                    ))}
                </div>
            </div>
        </section>
    )
}
