import Shuriken from "@/assets/shuriken.svg"
import {
    SHURIKEN_CORE_SCALE,
    SHURIKEN_BUBBLE_VIEWBOX,
    SHURIKEN_TAIL_PATH as TAIL_PATH,
    SHURIKEN_BORDER_PATH as BORDER_PATH
} from "@/lib/shuriken-bubble-geometry"
import { useEffect, useRef, type ComponentType, type SVGProps } from "react"

const ShurikenCore = Shuriken as unknown as ComponentType<SVGProps<SVGSVGElement>>

export const SHURIKEN_BUBBLE_DURATION_MS = 3100

const FAN_DURATION_MS = 1100

const progress = (time: number, start: number, end: number) =>
    Math.max(0, Math.min(1, (time - start) / (end - start)))
const easeOut = (value: number) => 1 - (1 - value) ** 3

function samplePath(path: SVGPathElement) {
    const length = path.getTotalLength()
    return Array.from({ length: 160 }, (_, index) => path.getPointAtLength((length * index) / 160))
}

/** The fifth wing becomes the speaker tail during the fan-out, then draws the border. */
export function ShurikenBubble({
    animated = false,
    ...props
}: SVGProps<SVGSVGElement> & { animated?: boolean }) {
    const coreRef = useRef<SVGGElement>(null)
    const tailRef = useRef<SVGPathElement>(null)
    const borderRef = useRef<SVGPathElement>(null)

    useEffect(() => {
        const core = coreRef.current
        const tail = tailRef.current
        const border = borderRef.current
        if (!core || !tail || !border) return

        const blades = Array.from(core.querySelectorAll("path"))
        if (!blades.length) return

        const finish = () => {
            core.setAttribute("transform", `translate(0 -5) scale(${SHURIKEN_CORE_SCALE})`)
            core.setAttribute("opacity", "1")
            for (const blade of blades) blade.removeAttribute("transform")
            tail.setAttribute("d", TAIL_PATH)
            tail.setAttribute("opacity", "1")
            border.removeAttribute("stroke-dasharray")
            border.removeAttribute("stroke-dashoffset")
            border.setAttribute("opacity", "1")
        }

        if (!animated) {
            finish()
            return
        }

        // Sample the canonical logo blade, rather than maintaining another copy of its geometry.
        tail.setAttribute("d", TAIL_PATH)
        const bladePoints = samplePath(blades[0])
        const tailPoints = samplePath(tail)
        const borderLength = border.getTotalLength()
        const angle = (-135 * Math.PI) / 180
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)

        const draw = (time: number) => {
            const fan = progress(time, 0, FAN_DURATION_MS)
            const form = easeOut(fan)
            core.setAttribute("transform", `translate(0 -5) scale(${SHURIKEN_CORE_SCALE * form})`)
            core.setAttribute("opacity", String(form))
            blades.forEach((blade, index) => {
                // Each canonical path already contains its quarter-turn rotation.
                const rotation = -135 + (index * 90 + 135) * form - index * 90
                blade.setAttribute("transform", `rotate(${rotation})`)
            })

            const reach = fan * fan
            const settle = easeOut(progress(fan, 0.55, 1))
            const size = form * (0.65 + 0.35 * reach)
            if (settle < 1) {
                const points = bladePoints.map((point, index) => {
                    const x = (point.x * cos - point.y * sin) * size - 60 * reach
                    const y = (point.x * sin + point.y * cos) * size + 70 * reach
                    const target = tailPoints[index]
                    return `${(x + (target.x - x) * settle).toFixed(3)} ${(y + (target.y - y) * settle).toFixed(3)}`
                })
                tail.setAttribute("d", `M${points.join(" L")} Z`)
            } else {
                // Exact curves at rest; rounded caps overlap the border to prevent seams.
                tail.setAttribute("d", TAIL_PATH)
            }
            tail.setAttribute("opacity", String(form))

            const ink = easeOut(progress(time, FAN_DURATION_MS, SHURIKEN_BUBBLE_DURATION_MS))
            border.setAttribute("stroke-dasharray", `${borderLength} ${borderLength}`)
            border.setAttribute("stroke-dashoffset", String(borderLength * (1 - ink)))
            border.setAttribute("opacity", time >= FAN_DURATION_MS ? "1" : "0")
        }

        let frame = 0
        const start = performance.now()
        draw(0)
        const tick = (now: number) => {
            const elapsed = now - start
            if (elapsed >= SHURIKEN_BUBBLE_DURATION_MS) {
                finish()
                return
            }
            draw(elapsed)
            frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [animated])

    return (
        <svg viewBox={SHURIKEN_BUBBLE_VIEWBOX} fill="currentColor" {...props}>
            <path
                ref={borderRef}
                d={BORDER_PATH}
                fill="none"
                stroke="currentColor"
                strokeWidth="18"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={animated ? 0 : 1}
            />
            <g
                ref={coreRef}
                transform={`translate(0 -5) scale(${SHURIKEN_CORE_SCALE})`}
                opacity={animated ? 0 : 1}
            >
                <ShurikenCore x="-128" y="-128" width="256" height="256" overflow="visible" />
            </g>
            <path ref={tailRef} d={TAIL_PATH} opacity={animated ? 0 : 1} />
        </svg>
    )
}
