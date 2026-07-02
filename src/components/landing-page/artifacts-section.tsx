"use client"

import { Check, LayoutTemplate, MousePointerClick, Terminal } from "lucide-react"
import { useState } from "react"

import { SectionHead, Tile } from "@/components/landing-page/shared"
import { Button } from "@/components/ui/button"

export function ArtifactsSection() {
    const [artifactCount, setArtifactCount] = useState(0)

    return (
        <section id="artifacts" className="border-t py-24 [border-color:var(--landing-border)]">
            <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 md:px-8 lg:grid-cols-[1.1fr_0.9fr]">
                <Tile>
                    <div className="grid lg:grid-cols-2">
                        <div className="border-b [background:var(--landing-surface-strong)] [border-color:var(--landing-border)] lg:border-r lg:border-b-0">
                            <div className="flex items-center gap-2 border-b px-4 py-3 [background:var(--landing-surface-stronger)] [border-color:var(--landing-border)]">
                                <Terminal className="size-4 [color:var(--landing-muted-faint)]" />
                                <span className="font-mono text-xs [color:var(--landing-muted)]">
                                    counter.tsx
                                </span>
                            </div>
                            <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-6 [color:var(--landing-muted)]">
                                <code>
                                    <span className="text-pink-300">export default</span>{" "}
                                    <span className="text-sky-300">function</span>{" "}
                                    <span className="text-emerald-300">Counter</span>() {"{\n"}
                                    {"  "}const [count, setCount] = useState(0){"\n\n"}
                                    {"  "}return &lt;button onClick={"{"}() =&gt; setCount(count +
                                    1){"}"}&gt;{"\n"}
                                    {"    "}Increment {"{"}count{"}"}
                                    {"\n"}
                                    {"  "}&lt;/button&gt;{"\n"}
                                    {"}"}
                                </code>
                            </pre>
                        </div>
                        <div className="[background:var(--landing-surface)]">
                            <div className="flex items-center gap-2 border-b px-4 py-3 [background:var(--landing-surface-stronger)] [border-color:var(--landing-border)]">
                                <LayoutTemplate className="size-4 [color:var(--landing-fg)]" />
                                <span className="text-sm [color:var(--landing-muted-soft)]">
                                    Preview
                                </span>
                            </div>
                            <div className="grid min-h-72 place-items-center bg-[url('/noise.png')] p-8">
                                <div className="w-full max-w-64 rounded-[var(--radius-xl)] border p-7 text-center shadow-2xl [background:var(--landing-surface-strong)] [border-color:var(--landing-border)]">
                                    <div className="mb-5 font-semibold text-5xl [color:var(--landing-fg)]">
                                        {artifactCount}
                                    </div>
                                    <Button
                                        className="h-11 w-full gap-2 rounded-[var(--radius-lg)] font-semibold transition-transform active:scale-95"
                                        onClick={() => setArtifactCount((current) => current + 1)}
                                    >
                                        <MousePointerClick className="size-4" />
                                        Increment
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Tile>

                <div>
                    <SectionHead className="mb-8" title="Code that runs in the chat.">
                        Smart Artifacts render React, HTML, and Markdown directly in the
                        conversation. Stop copy-pasting and start seeing results instantly.
                    </SectionHead>
                    <ul className="space-y-3">
                        {[
                            "Preview generated UI",
                            "Inspect documents inline",
                            "Keep context in one place"
                        ].map((item) => (
                            <li
                                key={item}
                                className="flex items-center gap-3 [color:var(--landing-muted)]"
                            >
                                <Check className="size-4 text-emerald-400" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    )
}
