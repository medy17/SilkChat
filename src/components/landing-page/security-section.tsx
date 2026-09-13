"use client"

import { ArrowUpRight, FileCode2, GitFork, Server } from "lucide-react"
import { useRef } from "react"

import { GithubIcon } from "@/components/brand-icons"
import { Button } from "@/components/ui/button"
import { Sculpture } from "./sculpture"
import type { LandingScrollProps } from "./use-landing-scroll"
import { LandingScene, useLandingVisual } from "./landing-story"

function SourceVisual({ containerRef }: LandingScrollProps) {
    const sculptureRef = useRef<HTMLDivElement>(null)
    const { progress, reduced } = useLandingVisual(containerRef, sculptureRef, "focus")
    return (
        <div ref={sculptureRef} className="flex min-w-0 justify-center">
            <Sculpture
                kind="source"
                progress={progress}
                reduced={reduced}
                containerRef={containerRef}
            />
        </div>
    )
}

export function SecuritySection({ containerRef }: LandingScrollProps) {
    return (
        <LandingScene
            id="privacy"
            propSide="right"
            arrival="after-transition"
            release
            containerRef={containerRef}
            visual={<SourceVisual containerRef={containerRef} />}
        >
            <div className="landing-copy">
                <h2 className="landing-heading">
                    Open source.
                    <br />
                    Open to possibility.
                </h2>
                <p>The code is yours to inspect, run, and build on.</p>
                <ul className="landing-points">
                    <li>
                        <span>
                            <FileCode2 />
                        </span>
                        Inspect the complete source
                    </li>
                    <li>
                        <span>
                            <Server />
                        </span>
                        Run your own deployment
                    </li>
                    <li>
                        <span>
                            <GitFork />
                        </span>
                        Fork, customize, and contribute
                    </li>
                </ul>
                <div className="landing-source-actions">
                    <Button asChild size="lg" className="landing-primary h-12 px-5">
                        <a
                            href="https://github.com/medy17/silkchat"
                            target="_blank"
                            rel="noreferrer"
                        >
                            <GithubIcon className="size-4" />
                            Explore the source
                            <ArrowUpRight className="size-4" />
                        </a>
                    </Button>
                    <a
                        href="https://github.com/medy17/silkchat/blob/main/docs/SETUP_GUIDE.md"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Setup guide <ArrowUpRight className="size-4" />
                    </a>
                </div>
            </div>
        </LandingScene>
    )
}
