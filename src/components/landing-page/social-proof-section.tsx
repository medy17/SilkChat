"use client"

import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useRef } from "react"

gsap.registerPlugin(ScrollTrigger)

export function SocialProofSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useGSAP(
        () => {
            const scroller = document.querySelector("main")?.parentElement

            gsap.fromTo(
                ".social-proof-header",
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

            const counters = gsap.utils.toArray<HTMLElement>(".stat-counter")
            counters.forEach((counter) => {
                const target = Number.parseFloat(counter.getAttribute("data-target") || "0")
                const decimals = Number.parseInt(counter.getAttribute("data-decimals") || "0", 10)
                const suffix = counter.getAttribute("data-suffix") || ""
                const obj = { val: 0 }

                gsap.to(obj, {
                    val: target,
                    duration: 2.5,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: sectionRef.current,
                        scroller: scroller || undefined,
                        start: "top 75%"
                    },
                    onUpdate: () => {
                        counter.textContent = obj.val.toFixed(decimals) + suffix
                    }
                })
            })

            gsap.fromTo(
                ".testimonial-card",
                { y: 50, opacity: 0, scale: 0.95 },
                {
                    y: 0,
                    opacity: 1,
                    scale: 1,
                    duration: 0.8,
                    stagger: 0.15,
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
            id="social-proof"
            ref={sectionRef}
            className="flex min-h-screen snap-start flex-col items-center justify-center bg-background px-6 py-20"
        >
            <div className="container mx-auto max-w-5xl">
                <div
                    className="social-proof-header mb-16 text-center"
                    style={{ willChange: "transform, opacity, filter" }}
                >
                    <h2 className="mb-4 font-bold text-3xl md:text-5xl">Loved by thousands</h2>
                    <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                        Don't just take our word for it.
                    </p>
                </div>

                <div className="mb-16 grid grid-cols-2 gap-8 md:grid-cols-4">
                    {[
                        { target: 12, suffix: "k+", decimals: 0, label: "Active Users" },
                        { target: 1.2, suffix: "M+", decimals: 1, label: "Messages Sent" },
                        { target: 50, suffix: "+", decimals: 0, label: "Models Available" },
                        { target: 4.9, suffix: "/5", decimals: 1, label: "User Rating" }
                    ].map((stat) => (
                        <div key={stat.label} className="text-center">
                            <p
                                className="stat-counter font-bold text-4xl tracking-tight md:text-5xl"
                                data-target={stat.target}
                                data-suffix={stat.suffix}
                                data-decimals={stat.decimals}
                            >
                                0{stat.suffix}
                            </p>
                            <p className="mt-2 text-muted-foreground text-sm">{stat.label}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {[
                        {
                            quote: "SilkChat replaced three separate subscriptions for me. Having every model in one place is an absolute game-changer.",
                            name: "Alex R.",
                            role: "Full-Stack Developer"
                        },
                        {
                            quote: "The artifacts feature is insane. I can prototype UI components directly in a chat and see them render live. Nothing else does this.",
                            name: "Priya S.",
                            role: "UX Designer"
                        },
                        {
                            quote: "BYOK means I'm in full control of my costs and data. It's the only AI platform I actually trust with sensitive work.",
                            name: "Marcus T.",
                            role: "Security Consultant"
                        }
                    ].map((testimonial) => (
                        <div
                            key={testimonial.name}
                            className="testimonial-card flex flex-col justify-between rounded-xl border border-border/50 bg-muted/20 p-6"
                            style={{ willChange: "transform, opacity" }}
                        >
                            <p className="mb-6 flex-1 text-muted-foreground leading-relaxed">
                                "{testimonial.quote}"
                            </p>
                            <div>
                                <p className="font-semibold">{testimonial.name}</p>
                                <p className="text-muted-foreground text-sm">{testimonial.role}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
