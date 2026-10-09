"use client"

import { FileUp, LockKeyhole, ShieldCheck } from "lucide-react"
import { type MotionValue, motion, useReducedMotion, useTransform } from "motion/react"
import { type RefObject, useRef } from "react"

import { GithubIcon } from "@/components/brand-icons"
import { Capability, ChapterCopy, useSceneProgress } from "@/components/landing-page/scroll-scene"
import { Tile } from "@/components/landing-page/shared"
import { Button } from "@/components/ui/button"

const guarantees = [
    { label: "Keys are encrypted and stored securely", Icon: LockKeyhole },
    { label: "Open source, so you can audit or self-host it", Icon: GithubIcon },
    { label: "BYOK keeps provider-level retention policies", Icon: ShieldCheck },
    { label: "Import conversations from other tools", Icon: FileUp }
]

const session = [
    { command: true, text: "gh repo clone medy17/silkchat" },
    { command: false, text: "Cloned SilkChat into ./silkchat" },
    { command: true, text: "bun install" },
    { command: false, text: "Dependencies installed" },
    { command: true, text: "bun run dev" },
    { command: false, text: "SilkChat dev server", link: "http://localhost:3000" }
]

// Each command lands, then its output follows a beat later.
function SessionLine({
    line,
    index,
    progress,
    reduced
}: {
    line: (typeof session)[number]
    index: number
    progress: MotionValue<number>
    reduced: boolean
}) {
    const start = -0.25 + index * 0.06 + (line.command ? 0 : 0.02)
    const opacity = useTransform(progress, [start, start + 0.05], [0, 1])
    const y = useTransform(progress, [start, start + 0.05], [6, 0])
    return (
        <motion.div
            style={reduced ? undefined : { opacity, y }}
            className={
                line.command
                    ? "[color:var(--landing-muted-soft)]"
                    : "[color:var(--landing-muted-faint)]"
            }
        >
            {line.command ? <span className="[color:var(--landing-fg)]">$ </span> : null}
            {line.text}
            {"link" in line ? (
                <span className="[color:var(--landing-fg)]"> {line.link}</span>
            ) : null}
        </motion.div>
    )
}

export function SecuritySection({
    containerRef
}: {
    containerRef: RefObject<HTMLDivElement | null>
}) {
    const sceneRef = useRef<HTMLElement>(null)
    const reduced = useReducedMotion() === true
    const progress = useSceneProgress({ containerRef, sceneRef })
    const lift = useTransform(progress, [-0.45, 0.1], [80, 0])
    const scale = useTransform(progress, [-0.45, 0.1], [0.92, 1])
    const caretOpacity = useTransform(progress, [0.1, 0.14], [0, 1])

    return (
        <section
            id="privacy"
            ref={sceneRef}
            className="border-t py-20 [border-color:var(--landing-border)] md:py-32"
        >
            <style>
                {`
                    @keyframes landing-caret {
                        50% { opacity: 0; }
                    }
                `}
            </style>
            <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 md:grid-cols-[0.9fr_1.1fr] md:px-8 lg:gap-20">
                <div>
                    <ChapterCopy
                        title="Audit it. Host it. Fork it."
                        description="SilkChat is built for privacy and transparency. Use your own keys, review the source, and keep provider-level retention under your control."
                        progress={progress}
                        reduced={reduced}
                    />
                    <ul className="mb-10 space-y-4">
                        {guarantees.map(({ label, Icon }, index) => (
                            <Capability
                                key={label}
                                label={label}
                                Icon={Icon}
                                index={index}
                                progress={progress}
                                reduced={reduced}
                            />
                        ))}
                    </ul>
                    <a href="https://github.com/medy17/silkchat" target="_blank" rel="noreferrer">
                        <Button
                            variant="outline"
                            className="h-11 rounded-[var(--radius-lg)] border bg-transparent [border-color:var(--landing-border)] [color:var(--landing-fg)] hover:[background:var(--landing-surface-strong)] hover:[color:var(--landing-fg)]"
                        >
                            <GithubIcon className="mr-2 size-4" />
                            View source code
                        </Button>
                    </a>
                </div>

                <motion.div style={reduced ? undefined : { y: lift, scale }} className="min-w-0">
                    <Tile>
                        <div className="flex items-center gap-2 border-b px-4 py-3 [background:var(--landing-surface-stronger)] [border-color:var(--landing-border)]">
                            <span className="size-2.5 rounded-full [background:var(--landing-muted-faint)]" />
                            <span className="size-2.5 rounded-full [background:var(--landing-muted-faint)]" />
                            <span className="size-2.5 rounded-full [background:var(--landing-muted-faint)]" />
                            <span className="ml-3 font-mono text-xs [color:var(--landing-muted-faint)]">
                                ~/silkchat
                            </span>
                        </div>
                        <div className="min-h-72 space-y-1 p-6 font-mono text-sm leading-7 [overflow-wrap:anywhere]">
                            {session.map((line, index) => (
                                <SessionLine
                                    key={line.text}
                                    line={line}
                                    index={index}
                                    progress={progress}
                                    reduced={reduced}
                                />
                            ))}
                            <motion.div
                                aria-hidden="true"
                                style={reduced ? undefined : { opacity: caretOpacity }}
                            >
                                <span className="[color:var(--landing-fg)]">$ </span>
                                <span className="inline-block h-4 w-2 translate-y-0.5 [animation:landing-caret_1s_steps(1)_infinite] [background:var(--landing-fg)] motion-reduce:[animation:none]" />
                            </motion.div>
                        </div>
                    </Tile>
                </motion.div>
            </div>
        </section>
    )
}
