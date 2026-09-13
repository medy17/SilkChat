"use client"

import type { MotionValue } from "motion/react"
import {
    Component,
    lazy,
    type ReactNode,
    Suspense,
    useCallback,
    useEffect,
    useRef,
    useState
} from "react"

import { LogoSymbol } from "@/components/logo"
import { SOURCE_BRACE_PATH, type SculptureKind } from "@/lib/landing-sculpture"
import type { LandingScrollProps } from "./use-landing-scroll"

const SculptureCanvas = lazy(() => import("./sculpture-canvas"))

export class SceneBoundary extends Component<
    { children: ReactNode; onFailure: () => void },
    { failed: boolean }
> {
    state = { failed: false }
    static getDerivedStateFromError() {
        return { failed: true }
    }
    componentDidCatch() {
        this.props.onFailure()
    }
    render() {
        return this.state.failed ? null : this.props.children
    }
}

export function Sculpture({
    kind,
    progress,
    reduced,
    containerRef,
    onReady: onSceneReady
}: LandingScrollProps & {
    kind: SculptureKind
    progress: MotionValue<number>
    reduced: boolean
    onReady?: () => void
}) {
    const hostRef = useRef<HTMLDivElement>(null)
    const [activated, setActivated] = useState(false)
    const [ready, setReady] = useState(false)
    const [failed, setFailed] = useState(false)
    const [color, setColor] = useState("currentColor")
    const onReady = useCallback(() => {
        setReady(true)
        onSceneReady?.()
    }, [onSceneReady])
    const onFailure = useCallback(() => {
        setFailed(true)
        setReady(false)
    }, [])

    useEffect(() => {
        const host = hostRef.current
        if (!host || reduced || activated) return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) setActivated(true)
            },
            {
                root: containerRef.current,
                rootMargin: `${containerRef.current?.clientHeight ?? window.innerHeight}px 0px`
            }
        )
        observer.observe(host)
        return () => observer.disconnect()
    }, [containerRef, reduced, activated])

    useEffect(() => {
        const sample = document.createElement("canvas").getContext("2d")
        const update = () => {
            if (!hostRef.current) return
            const cssColor = getComputedStyle(hostRef.current).color
            if (!sample) {
                setColor(cssColor)
                return
            }
            // Canvas resolves theme colors including oklch into the sRGB form
            // expected by Three's material color parser.
            sample.fillStyle = cssColor
            sample.fillRect(0, 0, 1, 1)
            const [r, g, b] = sample.getImageData(0, 0, 1, 1).data
            setColor(`rgb(${r}, ${g}, ${b})`)
        }
        update()
        const observer = new MutationObserver(update)
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class", "style"]
        })
        return () => observer.disconnect()
    }, [])

    return (
        <div ref={hostRef} className="landing-sculpture" aria-hidden="true">
            <div
                className="landing-sculpture-ground"
                style={{ opacity: ready || reduced || failed ? 1 : 0 }}
            />
            <div className="landing-sculpture-fallback" hidden={!reduced && !failed}>
                {kind === "conversation" ? (
                    <LogoSymbol />
                ) : (
                    <svg viewBox="0 0 300 300" fill="currentColor">
                        <path d={SOURCE_BRACE_PATH} />
                        <path d={SOURCE_BRACE_PATH} transform="translate(300 0) scale(-1 1)" />
                    </svg>
                )}
            </div>
            {activated && !failed && color !== "currentColor" && (
                <SceneBoundary onFailure={onFailure}>
                    <Suspense fallback={null}>
                        <div
                            className="landing-sculpture-canvas"
                            style={{ opacity: ready && !reduced ? 1 : 0 }}
                        >
                            <SculptureCanvas
                                kind={kind}
                                progress={progress}
                                color={color}
                                onReady={onReady}
                                onFailure={onFailure}
                            />
                        </div>
                    </Suspense>
                </SceneBoundary>
            )}
        </div>
    )
}
