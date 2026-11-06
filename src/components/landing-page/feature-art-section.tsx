"use client"

import { motion, useReducedMotion } from "motion/react"
import { PixelCardArt } from "@/components/landing-page/pixel-card-art"
import {
    type CardPainter,
    createCocoonPainter,
    createLabsPainter,
    createLifePainter,
    createWeavePainter
} from "@/components/landing-page/pixel-card-scenes"

const cards: { title: string; createPainter: () => CardPainter }[] = [
    { title: "Every major lab in one place", createPainter: createLabsPainter },
    { title: "Switch models mid-thread", createPainter: createWeavePainter },
    { title: "Run code in the chat", createPainter: createLifePainter },
    { title: "Your keys, your data", createPainter: createCocoonPainter }
]

export function FeatureArtCards() {
    const reduced = useReducedMotion() === true

    return (
        <motion.ul
            initial={reduced ? false : "hidden"}
            whileInView="shown"
            viewport={{ once: true, amount: 0.15 }}
            variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.08 } } }}
            className="relative mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-3 gap-y-5 md:gap-x-4 lg:grid-cols-4"
        >
            {cards.map(({ title, createPainter }) => (
                <motion.li
                    key={title}
                    variants={{
                        hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
                        shown: { opacity: 1, y: 0, filter: "blur(0px)" }
                    }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                    <div aria-hidden="true" className="relative aspect-[3/2] overflow-hidden">
                        <PixelCardArt createPainter={createPainter} />
                    </div>
                    <h3 className="mt-1 font-medium text-sm [color:var(--landing-fg)]">{title}</h3>
                </motion.li>
            ))}
        </motion.ul>
    )
}
