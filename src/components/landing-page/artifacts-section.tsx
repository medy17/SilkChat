"use client"

import { FileText, LayoutTemplate, MessagesSquare, MousePointerClick, Terminal } from "lucide-react"
import { useState } from "react"

import { SectionHead, Tile } from "@/components/landing-page/shared"
import ClickSpark from "@/components/react-bits/click-spark"
import { Button } from "@/components/ui/button"

const syntax = {
    keyword: "[color:var(--color-pink-700)] dark:[color:var(--color-pink-300)]",
    function: "[color:var(--color-sky-700)] dark:[color:var(--color-sky-300)]",
    tag: "[color:var(--color-emerald-700)] dark:[color:var(--color-emerald-300)]",
    number: "[color:var(--color-amber-700)] dark:[color:var(--color-amber-300)]"
}

export function ArtifactsSection() {
    const [artifactCount, setArtifactCount] = useState(0)

    return (
        <section id="artifacts" className="border-t py-24 [border-color:var(--landing-border)]">
            <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 md:px-8 lg:grid-cols-[1.1fr_0.9fr]">
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
                                <div className="w-full max-w-64 rounded-[var(--radius-xl)] border p-5 text-center [background:var(--landing-surface-strong)] [border-color:var(--landing-border)]">
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
                                </div>
                            </div>
                        </div>
                    </div>
                </Tile>

                <div>
                    <SectionHead className="mb-8" title="Generate & Run Code Immediately">
                        Smart Artifacts render React, HTML, and Markdown directly in the
                        conversation. Stop copy-pasting and start seeing results instantly.
                    </SectionHead>
                    <ul className="space-y-3">
                        {[
                            { label: "Preview generated UI", Icon: LayoutTemplate },
                            { label: "Inspect documents inline", Icon: FileText },
                            { label: "Keep context in one place", Icon: MessagesSquare }
                        ].map(({ label, Icon }) => (
                            <li
                                key={label}
                                className="flex items-center gap-3 text-sm leading-6 [color:var(--landing-muted)]"
                            >
                                <span
                                    aria-hidden="true"
                                    className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] [background:var(--landing-surface-strong)] [color:var(--landing-fg)]"
                                >
                                    <Icon className="size-4" />
                                </span>
                                {label}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    )
}
