"use client"

import { FileText, LayoutTemplate, MessagesSquare, MousePointerClick, Terminal } from "lucide-react"
import { easeOut, easeInOut, motion, useTransform } from "motion/react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import type { LandingScrollProps } from "./use-landing-scroll"
import { LandingScene, useLandingVisual, useLandingVisualScale } from "./landing-story"

const syntax = {
    keyword: "font-semibold text-pink-700 dark:text-pink-300",
    function: "text-sky-700 dark:text-sky-300",
    tag: "text-emerald-700 dark:text-emerald-300",
    number: "text-amber-700 dark:text-amber-300"
}

function ArtifactDemo({ containerRef }: LandingScrollProps) {
    const demoRef = useRef<HTMLDivElement>(null)
    const demoScale = useLandingVisualScale(demoRef)
    const [artifactCount, setArtifactCount] = useState(0)
    const [interacting, setInteracting] = useState(false)
    const codeRef = useRef<HTMLDivElement>(null)
    const previewRef = useRef<HTMLDivElement>(null)
    const { progress: codeProgress, reduced } = useLandingVisual(containerRef, codeRef, "focus")
    const { progress: previewProgress } = useLandingVisual(containerRef, previewRef, "focus")
    const clipPath = useTransform(
        codeProgress,
        [0, 0.4],
        ["inset(0 0 100% 0)", "inset(0 0 0% 0)"],
        { ease: easeInOut }
    )
    const opacity = useTransform(previewProgress, [0.2, 0.5], [0, 1])
    const y = useTransform(previewProgress, [0.2, 0.48, 0.62], [40, -5, 0], { ease: easeOut })
    const scale = useTransform(previewProgress, [0.2, 0.48, 0.62], [0.88, 1.025, 1], {
        ease: easeOut
    })
    const showComplete = reduced || interacting

    return (
        <motion.div
            ref={demoRef}
            style={{ scale: demoScale }}
            className="landing-artifact-demo"
            onFocusCapture={() => setInteracting(true)}
        >
            <div ref={codeRef} className="landing-artifact-code">
                <div className="landing-artifact-toolbar">
                    <Terminal className="size-4" aria-hidden="true" />
                    <span className="font-mono text-xs [color:var(--landing-muted)]">
                        counter.tsx
                    </span>
                </div>
                <motion.pre
                    className="whitespace-pre-wrap p-5 font-mono text-xs leading-6 [color:var(--landing-muted)] [overflow-wrap:anywhere]"
                    style={showComplete ? undefined : { clipPath }}
                >
                    <code>
                        <span className={syntax.keyword}>export default function</span>{" "}
                        <span className={syntax.function}>Counter</span>() {"{\n"}
                        {"  "}
                        <span className={syntax.keyword}>const</span>
                        {" [count, setCount] =\n    "}
                        <span className={syntax.function}>useState</span>(
                        <span className={syntax.number}>0</span>){"\n\n  "}
                        <span className={syntax.keyword}>return</span>
                        {" (\n    <"}
                        <span className={syntax.tag}>button</span>
                        {"\n      "}
                        <span className={syntax.function}>onClick</span>
                        {"={() =>\n        "}
                        <span className={syntax.function}>setCount</span>
                        {"(count + "}
                        <span className={syntax.number}>1</span>
                        {")\n      }\n    >\n      Increment {count}\n    </"}
                        <span className={syntax.tag}>button</span>
                        {">\n  )\n"}
                        {"}"}
                    </code>
                </motion.pre>
            </div>
            <div ref={previewRef} className="landing-artifact-preview">
                <div className="landing-artifact-toolbar">
                    <LayoutTemplate className="size-4" aria-hidden="true" />
                    <span className="text-sm">Preview</span>
                </div>
                <div className="grid min-h-60 flex-1 place-items-center p-5">
                    <motion.div
                        className="w-full max-w-64 text-center"
                        style={showComplete ? undefined : { opacity, y, scale }}
                    >
                        <div
                            className="mb-5 font-semibold text-5xl [color:var(--landing-fg)]"
                            aria-live="polite"
                            aria-atomic="true"
                        >
                            {artifactCount}
                        </div>
                        <Button
                            type="button"
                            className="h-11 w-full gap-2 rounded-[var(--radius-lg)] font-semibold"
                            onClick={() => setArtifactCount((current) => current + 1)}
                        >
                            <MousePointerClick className="size-4" />
                            Increment
                        </Button>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    )
}

export function ArtifactsSection({ containerRef }: LandingScrollProps) {
    return (
        <LandingScene
            id="artifacts"
            propSide="left"
            containerRef={containerRef}
            visual={<ArtifactDemo containerRef={containerRef} />}
        >
            <div className="landing-copy">
                <h2 className="landing-heading">Generate &amp; Run Code Immediately</h2>
                <p>
                    Smart Artifacts render React, HTML, and Markdown directly in the conversation.
                    Stop copy-pasting and start seeing results instantly.
                </p>
                <ul className="landing-points">
                    {[
                        { label: "Preview generated UI", Icon: LayoutTemplate },
                        { label: "Inspect documents inline", Icon: FileText },
                        { label: "Keep context in one place", Icon: MessagesSquare }
                    ].map(({ label, Icon }) => (
                        <li key={label}>
                            <span aria-hidden="true">
                                <Icon />
                            </span>
                            {label}
                        </li>
                    ))}
                </ul>
            </div>
        </LandingScene>
    )
}
