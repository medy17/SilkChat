"use client"

import { testimonials } from "@/components/landing-page/content"
import { SectionHead } from "@/components/landing-page/shared"
import { cn } from "@/lib/utils"

export function SocialProofSection() {
    const firstRow = testimonials.filter((_, index) => index % 2 === 0)
    const secondRow = testimonials.filter((_, index) => index % 2 === 1)

    return (
        <section
            id="testimonials"
            className="overflow-hidden border-t py-24 [border-color:var(--landing-border)]"
        >
            <style>
                {`
                    @keyframes landing-marquee {
                        from { transform: translateX(0); }
                        to { transform: translateX(-50%); }
                    }
                `}
            </style>

            <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
                <SectionHead title="Loved by people building with SilkChat.">
                    Don't just take our word for it. Real workflows are moving into SilkChat because
                    it keeps models, search, images, artifacts, and keys under one roof.
                </SectionHead>
            </div>

            <div className="relative flex flex-col gap-3 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
                {[firstRow, secondRow].map((row, rowIndex) => (
                    <div key={rowIndex === 0 ? "first" : "second"} className="overflow-hidden">
                        <div
                            className={cn(
                                "flex w-max gap-3 pr-3 [animation:landing-marquee_54s_linear_infinite] hover:[animation-play-state:paused]",
                                rowIndex === 1 &&
                                    "[animation-direction:reverse] [animation-duration:62s]"
                            )}
                        >
                            {[0, 1].map((groupIndex) => (
                                <div
                                    key={`${rowIndex}-${groupIndex}`}
                                    className="flex gap-3 pr-3"
                                    aria-hidden={groupIndex === 1}
                                >
                                    {row.map((testimonial) => (
                                        <article
                                            key={`${testimonial.name}-${groupIndex}`}
                                            className="flex h-36 w-[min(20rem,82vw)] flex-col justify-between rounded-[var(--radius-lg)] border p-4 transition-colors [background:var(--landing-surface)] [border-color:var(--landing-border)] hover:[background:var(--landing-surface-strong)]"
                                        >
                                            <p className="line-clamp-3 text-sm leading-6 [color:var(--landing-muted-soft)]">
                                                "{testimonial.quote}"
                                            </p>
                                            <div>
                                                <div className="font-medium text-sm [color:var(--landing-fg)]">
                                                    {testimonial.name}
                                                </div>
                                                <div className="text-xs [color:var(--landing-muted-faint)]">
                                                    {testimonial.role}
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}
