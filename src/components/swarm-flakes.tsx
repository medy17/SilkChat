"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"

// --- CONFIGURATION ---
const SWARM_CONFIG = {
    // Increase this value to reduce the flake count (e.g., 24, 32, 48)
    // Default was 16. A good balance for performance and visuals is 32.
    baseParticleSpacing: 32,

    // Enable/disable theme-driven colors
    useThemeColors: true
}
// ---------------------

interface SwarmFlakesDemoProps {
    className?: string
    particleSpacing?: number
}
export interface SwarmFlakesRef {
    triggerRipple: () => void
}

function parseColorVarToRgb(cssVar: string): [number, number, number] | null {
    const val = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
    if (!val) return null

    const temp = document.createElement("div")

    // First try assigning directly (handles oklch, hex, named colors)
    temp.style.color = val

    // If that fails, it might be raw hsl numbers like "222.2 47.4% 11.2%"
    if (!temp.style.color) {
        temp.style.color = `hsl(${val})`
    }

    document.body.appendChild(temp)
    const computedColor = getComputedStyle(temp).color
    document.body.removeChild(temp)

    // Parse the rgb/rgba output from getComputedStyle
    const match = computedColor.match(/(\d+(\.\d+)?)/g)
    if (match && match.length >= 3) {
        return [
            Math.round(Number.parseFloat(match[0])),
            Math.round(Number.parseFloat(match[1])),
            Math.round(Number.parseFloat(match[2]))
        ]
    }
    return null
}

const SwarmFlakesDemo = forwardRef<SwarmFlakesRef, SwarmFlakesDemoProps>(
    ({ className = "", particleSpacing = SWARM_CONFIG.baseParticleSpacing }, ref) => {
        const canvasRef = useRef<HTMLCanvasElement>(null)

        useEffect(() => {
            const canvas = canvasRef.current
            if (!canvas) return

            const ctx = canvas.getContext("2d", { alpha: true })
            if (!ctx) return

            let width = 0
            let height = 0
            let particles: Particle[] = []
            const ripples: { radius: number; speed: number; width: number; strength: number }[] = []
            let mouseX = -1000
            let mouseY = -1000
            let animationFrameId: number

            // Theme colors
            let isDark = false
            let primaryColor = [59, 130, 246]
            let accentColor = [236, 72, 153]
            let secondaryColor = [34, 211, 238]
            let tertiaryColor = [168, 85, 247]

            function updateThemeColors() {
                isDark =
                    document.documentElement.classList.contains("dark") ||
                    document.documentElement.getAttribute("data-theme") === "dark"

                if (SWARM_CONFIG.useThemeColors) {
                    const p = parseColorVarToRgb("--accent")
                    const a = parseColorVarToRgb("--accent")
                    const s = parseColorVarToRgb("--accent")
                    const t = parseColorVarToRgb("--muted-foreground")

                    if (p) primaryColor = p
                    if (a) accentColor = a
                    if (s) secondaryColor = s
                    if (t) tertiaryColor = t
                }
            }

            class Particle {
                baseX: number
                baseY: number
                x: number
                y: number
                dx = 0
                dy = 0
                distanceToCenter = 0
                angleFromCenter = 0
                baseSize: number
                rotOffset: number

                constructor(x: number, y: number) {
                    this.baseX = x
                    this.baseY = y
                    this.x = x
                    this.y = y
                    this.baseSize = 4
                    this.rotOffset = (Math.random() - 0.5) * 0.2
                    this.updateCenterMetrics()
                }

                updateCenterMetrics() {
                    const centerX = width / 2
                    const centerY = height / 2
                    this.dx = this.baseX - centerX
                    this.dy = this.baseY - centerY
                    this.distanceToCenter = Math.sqrt(this.dx * this.dx + this.dy * this.dy)
                    this.angleFromCenter = Math.atan2(this.dy, this.dx)
                }

                draw(
                    ctx: CanvasRenderingContext2D,
                    ripples: { radius: number; speed: number; width: number; strength: number }[],
                    time: number
                ) {
                    let z = 0

                    for (let i = 0; i < ripples.length; i++) {
                        const r = ripples[i]
                        const diff = r.radius - this.distanceToCenter
                        if (diff > 0 && diff < r.width) {
                            const normalizedDiff = diff / r.width
                            const bumpHeight = Math.sin(normalizedDiff * Math.PI) * r.strength
                            z += bumpHeight
                        }
                    }

                    const distToMouse = Math.sqrt(
                        (this.baseX - mouseX) ** 2 + (this.baseY - mouseY) ** 2
                    )
                    if (distToMouse < 150) {
                        const mouseBump = Math.cos((distToMouse / 150) * (Math.PI / 2))
                        z += mouseBump * 0.8
                    }

                    const ambient =
                        (Math.sin(this.distanceToCenter * 0.02 - time * 1.5) +
                            Math.cos(this.angleFromCenter * 8 + time * 0.5)) *
                        0.15
                    z += Math.max(0, ambient)

                    const visualZ = Math.max(0, z)
                    const perspectiveShift = visualZ * 12
                    const drawX = this.baseX + Math.cos(this.angleFromCenter) * perspectiveShift
                    const drawY = this.baseY + Math.sin(this.angleFromCenter) * perspectiveShift
                    const drawSize = this.baseSize + visualZ * 5

                    const baseR = isDark ? 161 : 203
                    const baseG = isDark ? 161 : 213
                    const baseB = isDark ? 170 : 225

                    const xRatio = drawX / width
                    const yRatio = drawY / height

                    let targetR = primaryColor[0]
                    let targetG = primaryColor[1]
                    let targetB = primaryColor[2]

                    if (xRatio > 0.5) {
                        if (yRatio < 0.5) {
                            const blend = (xRatio - 0.5) * 2
                            targetR = primaryColor[0] + (accentColor[0] - primaryColor[0]) * blend
                            targetG = primaryColor[1] + (accentColor[1] - primaryColor[1]) * blend
                            targetB = primaryColor[2] + (accentColor[2] - primaryColor[2]) * blend
                        } else {
                            const blend = (xRatio - 0.5) * 2
                            targetR =
                                primaryColor[0] + (secondaryColor[0] - primaryColor[0]) * blend
                            targetG =
                                primaryColor[1] + (secondaryColor[1] - primaryColor[1]) * blend
                            targetB =
                                primaryColor[2] + (secondaryColor[2] - primaryColor[2]) * blend

                            if (yRatio < 0.8 && yRatio > 0.2) {
                                const purpleBlend = 1 - Math.abs(yRatio - 0.5) * 2
                                targetR =
                                    targetR * (1 - purpleBlend) + tertiaryColor[0] * purpleBlend
                                targetG =
                                    targetG * (1 - purpleBlend) + tertiaryColor[1] * purpleBlend
                                targetB =
                                    targetB * (1 - purpleBlend) + tertiaryColor[2] * purpleBlend
                            }
                        }
                    }

                    const clampedZ = Math.min(1, visualZ / 2.0)

                    const rColor = Math.min(255, baseR + (targetR - baseR) * clampedZ)
                    const gColor = Math.min(255, baseG + (targetG - baseG) * clampedZ)
                    const bColor = Math.min(255, baseB + (targetB - baseB) * clampedZ)

                    const darkAlphaBoost = isDark ? 2.0 : 1.0
                    const alphaBase = (0.1 + Math.min(0.35, clampedZ * 0.6)) * darkAlphaBoost

                    ctx.save()
                    ctx.translate(drawX, drawY)
                    ctx.rotate(this.rotOffset + visualZ * 0.2)

                    ctx.fillStyle = `rgba(${rColor}, ${gColor}, ${bColor}, ${alphaBase * 0.1})`
                    ctx.strokeStyle = `rgba(${rColor}, ${gColor}, ${bColor}, ${alphaBase * 0.8})`
                    ctx.lineWidth = 0.1 + visualZ * 0.2

                    ctx.beginPath()
                    ctx.rect(-drawSize / 2, -drawSize / 2, drawSize, drawSize)
                    ctx.fill()
                    ctx.stroke()

                    ctx.restore()
                }
            }

            function initParticles(spacing: number) {
                particles = []
                const centerX = width / 2
                const centerY = height / 2
                const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY) + 150

                const donutGap = 110
                const layersPerDonut = 4
                const layerSpacing = 14

                for (let layer = 0; layer < layersPerDonut; layer++) {
                    const r = layer * layerSpacing
                    if (r === 0) {
                        particles.push(new Particle(centerX, centerY))
                        continue
                    }
                    const numParticles = Math.floor((2 * Math.PI * r) / spacing)
                    for (let i = 0; i < numParticles; i++) {
                        const angle = (i / numParticles) * Math.PI * 2
                        particles.push(
                            new Particle(
                                centerX + Math.cos(angle) * r,
                                centerY + Math.sin(angle) * r
                            )
                        )
                    }
                }

                for (let donutBaseR = donutGap; donutBaseR < maxRadius; donutBaseR += donutGap) {
                    for (let layer = 0; layer < layersPerDonut; layer++) {
                        const r = donutBaseR + layer * layerSpacing
                        const circumference = 2 * Math.PI * r
                        const numParticles = Math.floor(circumference / spacing)

                        const ringOffset = layer % 2 === 0 ? 0 : Math.PI / numParticles

                        for (let i = 0; i < numParticles; i++) {
                            const angle = ringOffset + (i / numParticles) * Math.PI * 2
                            const x = centerX + Math.cos(angle) * r
                            const y = centerY + Math.sin(angle) * r
                            particles.push(new Particle(x, y))
                        }
                    }
                }
            }

            function spawnRipple() {
                ripples.push({
                    radius: 0,
                    speed: 4 + Math.random() * 3,
                    width: 350 + Math.random() * 250,
                    strength: 1.2 + Math.random() * 1.5
                })
            }

            if (canvas) {
                ;(canvas as unknown as { _triggerRipple: () => void })._triggerRipple = spawnRipple
            }

            function animate() {
                if (!ctx) return
                ctx.clearRect(0, 0, width, height)

                const time = Date.now() / 1000
                const maxDistance = Math.sqrt(width * width + height * height)

                for (let i = ripples.length - 1; i >= 0; i--) {
                    ripples[i].radius += ripples[i].speed
                    if (ripples[i].radius - ripples[i].width > maxDistance) {
                        ripples.splice(i, 1)
                    }
                }

                for (let i = 0; i < particles.length; i++) {
                    particles[i].draw(ctx, ripples, time)
                }

                animationFrameId = requestAnimationFrame(animate)
            }

            function resize() {
                if (!canvas || !ctx) return
                const parent = canvas.parentElement
                if (parent) {
                    width = parent.clientWidth
                    height = parent.clientHeight
                } else {
                    width = window.innerWidth
                    height = window.innerHeight
                }

                const dpr = window.devicePixelRatio || 1
                canvas.width = width * dpr
                canvas.height = height * dpr
                ctx.scale(dpr, dpr)

                const spacing = width < 768 ? Math.max(20, particleSpacing) : particleSpacing
                initParticles(spacing)

                // Update theme colors on resize as a fallback way to catch theme changes
                updateThemeColors()
            }

            const onMouseMove = (e: MouseEvent) => {
                if (!canvas) return
                const rect = canvas.getBoundingClientRect()
                mouseX = e.clientX - rect.left
                mouseY = e.clientY - rect.top
            }

            const onTouchMove = (e: TouchEvent) => {
                if (!canvas) return
                if (e.touches.length > 0) {
                    const rect = canvas.getBoundingClientRect()
                    mouseX = e.touches[0].clientX - rect.left
                    mouseY = e.touches[0].clientY - rect.top
                }
            }

            const onMouseLeave = () => {
                mouseX = -1000
                mouseY = -1000
            }

            window.addEventListener("resize", resize)
            canvas.addEventListener("mousemove", onMouseMove)
            canvas.addEventListener("touchmove", onTouchMove)
            canvas.addEventListener("mouseleave", onMouseLeave)

            // Setup observer for theme changes to avoid polling in draw
            const themeObserver = new MutationObserver(() => {
                updateThemeColors()
            })
            themeObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ["class", "data-theme"]
            })

            resize()

            const observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    if (!animationFrameId) animate()
                } else {
                    if (animationFrameId) {
                        cancelAnimationFrame(animationFrameId)
                        animationFrameId = 0
                    }
                }
            })

            observer.observe(canvas)

            return () => {
                window.removeEventListener("resize", resize)
                if (canvas) {
                    canvas.removeEventListener("mousemove", onMouseMove)
                    canvas.removeEventListener("touchmove", onTouchMove)
                    canvas.removeEventListener("mouseleave", onMouseLeave)
                }
                themeObserver.disconnect()
                cancelAnimationFrame(animationFrameId)
                observer.disconnect()
            }
        }, [particleSpacing])

        useImperativeHandle(ref, () => ({
            triggerRipple: () => {
                if (
                    (canvasRef.current as unknown as { _triggerRipple: () => void })?._triggerRipple
                ) {
                    ;(
                        canvasRef.current as unknown as { _triggerRipple: () => void }
                    )._triggerRipple()
                }
            }
        }))

        return (
            <canvas
                ref={canvasRef}
                className={`block ${className}`}
                style={{ touchAction: "none" }}
            />
        )
    }
)

export default SwarmFlakesDemo
