"use client"

import { testimonials } from "@/components/landing-page/content"
import { SectionHead } from "@/components/landing-page/shared"

// One looping set must be wider than the widest viewport, or the track runs out
// before it wraps. 12 cards at 20rem + gap is ~4000px, enough for 4K.
const MIN_CARDS_PER_SET = 12
const SECONDS_PER_CARD = [18, 21]

function buildSet<T>(row: T[]) {
    const repeats = Math.ceil(MIN_CARDS_PER_SET / row.length)
    return Array.from({ length: repeats }, (_, repeatIndex) =>
        row.map((item, itemIndex) => ({ item, repeatIndex, itemIndex }))
    ).flat()
}

export function SocialProofSection() {
    const rows = [
        buildSet(testimonials.filter((_, index) => index % 2 === 0)),
        buildSet(testimonials.filter((_, index) => index % 2 === 1))
    ]

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
                <SectionHead title="Loved by Builders">
                    Don't just take our word for it. Real workflows are moving into SilkChat because
                    it keeps models, search, images, artifacts, and keys under one roof.
                </SectionHead>
            </div>

            <div className="relative flex flex-col gap-3 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
                {rows.map((set, rowIndex) => (
                    <div key={rowIndex === 0 ? "first" : "second"} className="overflow-hidden">
                        <div
                            className="flex w-max [animation:landing-marquee_linear_infinite] hover:[animation-play-state:paused] motion-reduce:[animation:none]"
                            style={{
                                animationDuration: `${set.length * SECONDS_PER_CARD[rowIndex]}s`,
                                animationDirection: rowIndex === 1 ? "reverse" : "normal"
                            }}
                        >
                            {[0, 1].map((groupIndex) => (
                                <div key={`${rowIndex}-${groupIndex}`} className="flex gap-3 pr-3">
                                    {set.map(({ item: testimonial, repeatIndex, itemIndex }) => (
                                        <article
                                            key={`${repeatIndex}-${itemIndex}`}
                                            aria-hidden={groupIndex > 0 || repeatIndex > 0}
                                            className="flex h-36 w-[min(20rem,82vw)] shrink-0 flex-col justify-between rounded-[var(--radius-lg)] border p-4 transition-colors [background:var(--landing-surface)] [border-color:var(--landing-border)] hover:[background:var(--landing-surface-strong)]"
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
