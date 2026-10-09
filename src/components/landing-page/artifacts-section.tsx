"use client"

import { FileText, LayoutTemplate, MessagesSquare, MousePointerClick, Terminal } from "lucide-react"
import { type MotionValue, motion, useReducedMotion, useTransform } from "motion/react"
import { type ReactNode, type RefObject, useRef, useState } from "react"

import { Capability, ChapterCopy, useSceneProgress } from "@/components/landing-page/scroll-scene"
import { Tile } from "@/components/landing-page/shared"
import ClickSpark from "@/components/react-bits/click-spark"
import { Button } from "@/components/ui/button"

const syntax = {
    keyword: "[color:var(--color-pink-700)] dark:[color:var(--color-pink-300)]",
    function: "[color:var(--color-sky-700)] dark:[color:var(--color-sky-300)]",
    tag: "[color:var(--color-emerald-700)] dark:[color:var(--color-emerald-300)]",
    number: "[color:var(--color-amber-700)] dark:[color:var(--color-amber-300)]"
}

const codeLines: ReactNode[] = [
    <>
        <span className={syntax.keyword}>export default function</span>{" "}
        <span className={syntax.function}>Counter</span>() {"{"}
    </>,
    <>
        {"  "}
        <span className={syntax.keyword}>const</span> [count, setCount] =
    </>,
    <>
        {"    "}
        <span className={syntax.function}>useState</span>(<span className={syntax.number}>0</span>)
    </>,
    "",
    <>
        {"  "}
        <span className={syntax.keyword}>return</span> (
    </>,
    <>
        {"    <"}
        <span className={syntax.tag}>button</span>
    </>,
    <>
        {"      "}
        <span className={syntax.function}>onClick</span>
        {"={() =>"}
    </>,
    <>
        {"        "}
        <span className={syntax.function}>setCount</span>
        {"(count + "}
        <span className={syntax.number}>1</span>)
    </>,
    "      }",
    "    >",
    "      Increment {count}",
    <>
        {"    </"}
        <span className={syntax.tag}>button</span>
        {">"}
    </>,
    "  )",
    "}"
]

const capabilities = [
    { label: "Preview generated UI", Icon: LayoutTemplate },
    { label: "Inspect documents inline", Icon: FileText },
    { label: "Keep context in one place", Icon: MessagesSquare }
]

// Lines resolve top to bottom as if the model were still writing them.
function CodeLine({
    children,
    index,
    progress,
    reduced
}: {
    children: ReactNode
    index: number
    progress: MotionValue<number>
    reduced: boolean
}) {
    const start = -0.32 + index * 0.028
    const opacity = useTransform(progress, [start, start + 0.08], [0.12, 1])
    const x = useTransform(progress, [start, start + 0.08], [-6, 0])
    return (
        <motion.div style={reduced ? undefined : { opacity, x }} className="min-h-6">
            {children}
        </motion.div>
    )
}

export function ArtifactsSection({
    containerRef
}: {
    containerRef: RefObject<HTMLDivElement | null>
}) {
    const sceneRef = useRef<HTMLElement>(null)
    const reduced = useReducedMotion() === true
    const progress = useSceneProgress({ containerRef, sceneRef })
    const [artifactCount, setArtifactCount] = useState(0)

    const turn = useTransform(progress, [-0.45, 0.15], [-14, 0])
    const slide = useTransform(progress, [-0.45, 0.15], [60, 0])
    // The preview only "renders" once the code above has finished arriving.
    const previewOpacity = useTransform(progress, [0.02, 0.25], [0.15, 1])
    const previewScale = useTransform(progress, [0.02, 0.25], [0.92, 1])
    const previewFilter = useTransform(progress, [0.02, 0.25], ["blur(10px)", "blur(0px)"])

    return (
        <section
            id="artifacts"
            ref={sceneRef}
            className="border-t py-20 [border-color:var(--landing-border)] md:py-32"
        >
            <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 md:grid-cols-[0.85fr_1.15fr] md:px-8 lg:gap-20">
                <div>
                    <ChapterCopy
                        title="Generate & run code immediately."
                        description="Smart Artifacts render React, HTML, and Markdown directly in the conversation. Stop copy-pasting and start seeing results instantly."
                        progress={progress}
                        reduced={reduced}
                    />
                    <ul className="space-y-4">
                        {capabilities.map(({ label, Icon }, index) => (
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
                </div>

                <motion.div
                    style={
                        reduced
                            ? undefined
                            : { rotateY: turn, x: slide, transformPerspective: 1600 }
                    }
                    className="min-w-0"
                >
                    <Tile className="min-w-0">
                        <div className="grid lg:grid-cols-2">
                            <div className="min-w-0 border-b [background:var(--landing-surface-strong)] [border-color:var(--landing-border)] lg:border-r lg:border-b-0">
                                <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4 [background:var(--landing-surface-stronger)] [border-color:var(--landing-border)]">
                                    <Terminal className="size-4 [color:var(--landing-muted-faint)]" />
                                    <span className="font-mono text-xs [color:var(--landing-muted)]">
                                        counter.tsx
                                    </span>
                                </div>
                                <pre className="whitespace-pre-wrap p-5 font-mono text-xs leading-6 [color:var(--landing-muted)] [overflow-wrap:anywhere]">
                                    <code>
                                        {codeLines.map((line, index) => (
                                            <CodeLine
                                                key={index}
                                                index={index}
                                                progress={progress}
                                                reduced={reduced}
                                            >
                                                {line}
                                            </CodeLine>
                                        ))}
                                    </code>
                                </pre>
                            </div>
                            <div className="flex min-w-0 flex-col [background:var(--landing-surface)]">
                                <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4 [background:var(--landing-surface-stronger)] [border-color:var(--landing-border)]">
                                    <LayoutTemplate className="size-4 [color:var(--landing-fg)]" />
                                    <span className="text-sm [color:var(--landing-muted-soft)]">
                                        Preview
                                    </span>
                                </div>
                                <div className="grid min-h-72 flex-1 place-items-center bg-[url('/noise.png')] p-5">
                                    <motion.div
                                        style={
                                            reduced
                                                ? undefined
                                                : {
                                                      opacity: previewOpacity,
                                                      scale: previewScale,
                                                      filter: previewFilter
                                                  }
                                        }
                                        className="w-full max-w-64 rounded-[var(--radius-xl)] border p-5 text-center [background:var(--landing-surface-strong)] [border-color:var(--landing-border)]"
                                    >
                                        <div className="mb-5 font-semibold text-5xl [color:var(--landing-fg)]">
                                            {artifactCount}
                                        </div>
                                        <ClickSpark
                                            sparkColor="var(--primary-foreground)"
                                            sparkSize={10}
                                            sparkRadius={15}
                                            sparkCount={8}
                                            duration={400}
                                        >
                                            <Button
                                                className="h-11 w-full gap-2 rounded-[var(--radius-lg)] font-semibold transition-transform active:scale-95"
                                                onClick={() =>
                                                    setArtifactCount((current) => current + 1)
                                                }
                                            >
                                                <MousePointerClick className="size-4" />
                                                Increment
                                            </Button>
                                        </ClickSpark>
                                    </motion.div>
                                </div>
                            </div>
                        </div>
                    </Tile>
                </motion.div>
            </div>
        </section>
    )
}
