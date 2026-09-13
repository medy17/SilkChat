"use client"

import { ArrowLeftRight, FileUp, KeyRound } from "lucide-react"
import { easeOut, easeInOut, motion, type MotionValue, useTransform } from "motion/react"
import { useRef } from "react"

import { type Provider, providers } from "@/components/landing-page/content"
import { LogoSymbol } from "@/components/logo"
import type { LandingScrollProps } from "./use-landing-scroll"
import { LandingScene, useLandingVisual } from "./landing-story"

const positions = [
    [50, 12],
    [82, 30],
    [82, 70],
    [50, 88],
    [18, 70],
    [18, 30]
]

// Assemble at screen center, hold for another 8vh, then disperse and fade.
const diagramStops = [0, 0.5, 0.6, 1]
// Keep the scattered marks hidden until they clear the copy on small screens.
const visibilityStops = [0, 0.18, 0.42, 0.6, 1]
const visibilityValues = [0, 0, 1, 1, 0]

function ProviderMark({
    provider: { name, Icon },
    index,
    progress,
    reduced
}: {
    provider: Provider
    index: number
    progress: MotionValue<number>
    reduced: boolean
}) {
    const [left, top] = positions[index]
    const orbitStops = [0, 0.24, 0.5, 0.6, 1]
    const x = useTransform(
        progress,
        orbitStops,
        [(left - 50) * 1.7, (left - 50) * 0.55 - (top - 50) * 0.3, 0, 0, (left - 50) * 1.3],
        { ease: easeInOut }
    )
    const y = useTransform(
        progress,
        orbitStops,
        [(top - 50) * 1.5, (top - 50) * 0.5 + (left - 50) * 0.3, 0, 0, (top - 50) * 1.2 - 24],
        { ease: easeInOut }
    )
    const scale = useTransform(progress, diagramStops, [0.7, 1, 1, 0.8], { ease: easeOut })
    const opacity = useTransform(progress, visibilityStops, visibilityValues)
    return (
        <li className="landing-provider-node" style={{ left: `${left}%`, top: `${top}%` }}>
            <motion.div style={reduced ? undefined : { x, y, scale, opacity }}>
                <Icon className="size-9 md:size-11" />
                <span>{name}</span>
            </motion.div>
        </li>
    )
}

function ProvidersVisual({ containerRef }: LandingScrollProps) {
    const diagramRef = useRef<HTMLDivElement>(null)
    const { progress, reduced } = useLandingVisual(containerRef, diagramRef, "focus")
    const connections = useTransform(progress, diagramStops, [0, 1, 1, 0])
    const centerOpacity = useTransform(progress, visibilityStops, visibilityValues)
    return (
        <div ref={diagramRef} className="landing-provider-field">
            <motion.svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
                style={reduced ? undefined : { opacity: connections }}
            >
                {positions.map(([x, y]) => (
                    <path key={`${x}-${y}`} d={`M50 50 Q${x} 50 ${x} ${y}`} />
                ))}
            </motion.svg>
            <motion.div
                className="landing-provider-center"
                aria-hidden="true"
                style={reduced ? undefined : { opacity: centerOpacity }}
            >
                <LogoSymbol />
            </motion.div>
            <ul aria-label="Supported AI providers">
                {providers.map((provider, index) => (
                    <ProviderMark
                        key={provider.name}
                        provider={provider}
                        index={index}
                        progress={progress}
                        reduced={reduced}
                    />
                ))}
            </ul>
        </div>
    )
}

export function ProvidersSection({ containerRef }: LandingScrollProps) {
    return (
        <LandingScene
            id="providers"
            propSide="left"
            containerRef={containerRef}
            visual={<ProvidersVisual containerRef={containerRef} />}
        >
            <div className="landing-copy">
                <h2 className="landing-heading">
                    Change models.
                    <br />
                    Keep your train of thought.
                </h2>
                <p>Bring your favorite models into the same conversation.</p>
                <ul className="landing-points">
                    <li>
                        <span>
                            <ArrowLeftRight />
                        </span>
                        Switch models mid-conversation
                    </li>
                    <li>
                        <span>
                            <FileUp />
                        </span>
                        Import your existing chats
                    </li>
                    <li>
                        <span>
                            <KeyRound />
                        </span>
                        Use included access or your own keys
                    </li>
                </ul>
            </div>
        </LandingScene>
    )
}
