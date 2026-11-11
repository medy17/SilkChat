import {
    arcAngle,
    buildArcTables,
    clamp,
    easeInOutCubic,
    easeOutCubic,
    GUIDE_ORBITS,
    type GalaxyField,
    ORBITS,
    PERSPECTIVE,
    type Point,
    STARS
} from "./field"
import { type GalaxyPalette, mixRgba, readGalaxyPalette, rgba } from "./palette"

export type GalaxyHover = { cluster: number; point: Point | null }

export type GlassMarkFrame = {
    px: number
    t: number
    faceX: number
    faceY: number
    spinX: number
    spinY: number
    palette: GalaxyPalette
    paint: (context: CanvasRenderingContext2D, size: number) => void
}

export type GlassMark = {
    canvas: HTMLCanvasElement
    render: (frame: GlassMarkFrame) => void
    dispose: () => void
}

export type GalaxyIntro = { boot: number; labs: number }

type EngineOptions = {
    wrap: HTMLDivElement
    back: HTMLCanvasElement
    front: HTMLCanvasElement
    field: GalaxyField
    labels: () => (HTMLDivElement | null)[]
    card: () => HTMLDivElement | null
    copy: () => HTMLElement | null
    intro: GalaxyIntro
    reducedMotion: boolean
    onHoverChange: (hover: GalaxyHover | null) => void
    loadMark?: () => Promise<GlassMark | null>
}

type Rect = { l: number; t: number; r: number; b: number }

const WIDE_MIN = 1024
const HOLD_ZOOM = 5.5
const HOVER_SPIN = 0.45
const DRAG_SPIN = 0.006
const BUCKETS = 12
const STAR_BUCKETS = 5
const PING_RATE = 8
const MAX_PINGS = 30
const LABEL_BADGE = 28
const BADGE_CLEARANCE = 22
const MODEL_LABEL_LIMIT = 24

export function startGalaxy(options: EngineOptions) {
    const { wrap, back, front, field, intro, reducedMotion: still } = options
    const backContext = back.getContext("2d")
    const frontContext = front.getContext("2d")
    if (!backContext || !frontContext) return () => undefined
    const P = backContext
    const F = frontContext
    const { clusters, points } = field

    let width = 0
    let height = 0
    let disposed = false
    let palette = readGalaxyPalette(wrap)
    let fontFamily = getComputedStyle(wrap).fontFamily || "sans-serif"

    // View: eased zoom and pan, plus a scripted flight for hold-to-zoom.
    const view = { zoom: 1, panX: 0, panY: 0, tZoom: 1, tPanX: 0, tPanY: 0 }
    let flight: {
        fz: number
        fx: number
        fy: number
        tz: number
        cluster: number | null
        t0: number
        dur: number
    } | null = null
    let holding = false
    let pinned: number | null = null
    let sized = false

    // Motion state.
    let time = 0
    let motion = still ? 0 : 1
    let spin = 0
    let hoverSpin = 0
    let parallaxX = 0
    let parallaxY = 0
    let tilt = 0
    let satelliteTurn = 0
    let pointerNX = 0
    let pointerNY = 0

    // Pointer state.
    let pointer: { x: number; y: number } | null = null
    let drag: { x: number; y: number; moved: number } | null = null
    let markDrag: { x: number; y: number } | null = null
    let isTouch = false
    let lastInteraction = 0

    // Hover.
    let hoverCluster: number | null = null
    let hoverPoint: Point | null = null
    let shownPoint: Point | null = null
    let cardShown = false
    let cardX = 0
    let cardY = 0
    const highlight = new Float32Array(clusters.length)
    let anyHighlight = 0

    // Ambient pings.
    const pings: { point: Point; born: number }[] = []
    let pingDebt = 0

    // Glass mark.
    let mark: GlassMark | null = null
    let markFace = { x: 0, y: 0 }
    const markSpin = { x: 0, y: 0, vx: 0, vy: 0 }
    let markCircle = { x: -1e4, y: -1e4, r: 0 }
    let markIn = intro.labs >= 1 ? 1 : 0
    let markStyleKey = ""
    let markBehind = { x: 0, y: 0, size: 1 }

    // DOM label bookkeeping.
    const labelOpacity = clusters.map(() => 0)
    const labelX = clusters.map(() => Number.NaN)
    const labelY = clusters.map(() => Number.NaN)
    const labelZ = clusters.map(() => "")
    const bySize = clusters.map((_, i) => i).sort((a, b) => clusters[b].count - clusters[a].count)

    // Draw buckets, one fill per alpha step instead of one per dot.
    const starBuckets = Array.from({ length: STAR_BUCKETS }, () => [] as number[])
    const spokeBuckets = [0, 1].map(() => Array.from({ length: BUCKETS }, () => [] as number[]))
    const dotBuckets = [0, 1].map(() => Array.from({ length: BUCKETS }, () => [] as number[]))

    let copyRects: Rect[] = []
    // Bottom of the hero copy in layout terms, unaffected by its intro transforms.
    let copyBottom = 0
    let arcTables = buildArcTables(1, 0)
    let arcCos = Number.NaN

    const baseZoom = () => (width >= WIDE_MIN ? 1.66 : 1.9)
    const isZoomed = () => view.tZoom > baseZoom() * 1.02
    // Wide screens put the system right of the copy column. Narrow ones stack the copy on
    // top and centre the system in the space below it.
    const geometry = () => {
        const wide = width >= WIDE_MIN
        return {
            ox: wide ? width * 0.68 : width * 0.5,
            oy: wide ? height * 0.5 : Math.max(height * 0.5, (copyBottom + height) / 2),
            R: wide ? Math.min(width * 0.34, height * 0.9) : Math.min(width * 0.56, height * 0.8),
            wide
        }
    }
    const isFront = (cluster: number) => (clusters[cluster]?.Y ?? 0) > 0
    const inMark = (p: { x: number; y: number }) =>
        Boolean(mark) && Math.hypot(p.x - markCircle.x, p.y - markCircle.y) < markCircle.r

    const distanceToCopy = (x: number, y: number) =>
        copyRects.reduce(
            (best, rect) =>
                Math.min(best, Math.max(rect.l - x, x - rect.r, rect.t - y, y - rect.b, 0)),
            Number.POSITIVE_INFINITY
        )
    const copyFade = (p: { x: number; y: number }, floor: number) =>
        clamp(distanceToCopy(p.x, p.y) / 30, floor, 1)

    const measureCopy = () => {
        const copy = options.copy()
        if (!copy) {
            copyRects = []
            copyBottom = 0
            return
        }
        // The copy and the galaxy share the hero as their offset parent.
        copyBottom = copy.offsetTop + copy.offsetHeight
        const origin = back.getBoundingClientRect()
        const rects: DOMRect[] = []
        for (const node of copy.querySelectorAll("[data-galaxy-avoid]")) {
            rects.push(node.getBoundingClientRect())
        }
        copyRects = rects.map((rect) => ({
            l: rect.left - origin.left - 32,
            t: rect.top - origin.top - 32,
            r: rect.right - origin.left + 32,
            b: rect.bottom - origin.top + 32
        }))
    }

    const refreshTheme = () => {
        palette = readGalaxyPalette(wrap)
        fontFamily = getComputedStyle(wrap).fontFamily || fontFamily
    }
    const themeObserver = new MutationObserver(refreshTheme)
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "style"]
    })

    const resize = () => {
        const rect = wrap.getBoundingClientRect()
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        width = rect.width
        height = rect.height
        for (const [canvas, context] of [
            [back, P],
            [front, F]
        ] as const) {
            canvas.width = Math.round(width * dpr)
            canvas.height = Math.round(height * dpr)
            context.setTransform(dpr, 0, 0, dpr, 0, 0)
        }
        if (!sized && width > 0) {
            sized = true
            view.zoom = baseZoom()
            view.tZoom = view.zoom
        } else if (!isZoomed()) {
            view.tZoom = baseZoom()
        }
        measureCopy()
    }
    void document.fonts?.ready.then(() => {
        if (!disposed) measureCopy()
    })
    // The hero copy animates in; measure again once it has landed.
    const settleTimer = window.setTimeout(measureCopy, 2000)

    if (options.loadMark) {
        options
            .loadMark()
            .catch(() => null)
            .then((loaded) => {
                if (disposed || !loaded) {
                    loaded?.dispose()
                    return
                }
                mark = loaded
                Object.assign(loaded.canvas.style, {
                    position: "absolute",
                    left: "0",
                    top: "0",
                    pointerEvents: "none",
                    zIndex: "1",
                    opacity: "0"
                })
                loaded.canvas.setAttribute("aria-hidden", "true")
                back.after(loaded.canvas)
            })
    }

    const startFlight = (zoom: number, cluster: number | null, duration: number) => {
        flight = {
            fz: view.zoom,
            fx: view.panX,
            fy: view.panY,
            tz: zoom,
            cluster,
            t0: time,
            dur: still ? 0 : duration
        }
    }

    const clusterAt = (p: { x: number; y: number }) => {
        let best: number | null = null
        let bestDistance = Number.POSITIVE_INFINITY
        clusters.forEach((cluster, i) => {
            const dx = (p.x - cluster.px) / (cluster.prx + 16)
            const dy = (p.y - cluster.py) / (cluster.pry + 16)
            const inside =
                dx * dx + dy * dy <= 1 ||
                Math.hypot(p.x - cluster.px, p.y - cluster.py) <= LABEL_BADGE / 2 + 4
            if (!inside || labelOpacity[i] < 0.2) return
            const distance = Math.hypot(p.x - cluster.px, p.y - cluster.py)
            if (distance < bestDistance) {
                bestDistance = distance
                best = i
            }
        })
        return best
    }

    const updateHover = () => {
        const dragged = Boolean(drag && drag.moved > 4)
        const overMark = Boolean(pointer && inMark(pointer))
        // Until the labs fade in, points still sit at the origin and aren't hoverable.
        const inCopy = Boolean(pointer && copyFade(pointer, 0) < 0.5) || intro.labs < 0.5

        hoverPoint = null
        if (pointer && !dragged && !markDrag && !overMark && !inCopy) {
            let bestDistance = isTouch ? 28 : 16
            for (const point of points) {
                if (copyFade(point, 0) < 0.5) continue
                if (!isFront(point.cluster) && inMark(point)) continue
                const distance = Math.hypot(point.x - pointer.x, point.y - pointer.y)
                if (distance < bestDistance) {
                    bestDistance = distance
                    hoverPoint = point
                }
            }
        }

        const cluster = hoverPoint
            ? hoverPoint.cluster
            : pointer && !dragged && !markDrag && !overMark && !inCopy
              ? clusterAt(pointer)
              : null

        const cursor =
            drag && dragged
                ? "grabbing"
                : markDrag
                  ? "grabbing"
                  : overMark
                    ? "grab"
                    : cluster !== null
                      ? "pointer"
                      : "default"
        if (back.style.cursor !== cursor) back.style.cursor = cursor

        if (cluster !== hoverCluster || hoverPoint !== shownPoint) {
            hoverCluster = cluster
            shownPoint = hoverPoint
            if (cluster === null) {
                cardShown = false
                options.onHoverChange(null)
            } else {
                options.onHoverChange({ cluster, point: hoverPoint })
            }
        }
    }

    const localPoint = (event: { clientX: number; clientY: number }) => {
        const rect = back.getBoundingClientRect()
        return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    const onPointerDown = (event: PointerEvent) => {
        isTouch = event.pointerType === "touch"
        const p = localPoint(event)
        pointer = p
        lastInteraction = performance.now()
        updateHover()

        if (event.pointerType === "mouse" && event.button === 0 && hoverCluster !== null) {
            holding = true
            pinned = hoverCluster
            motion = 0
            startFlight(HOLD_ZOOM, hoverCluster, 1.1)
            back.setPointerCapture(event.pointerId)
            return
        }
        if (inMark(p)) {
            markDrag = p
            back.setPointerCapture(event.pointerId)
            back.style.touchAction = "none"
            return
        }
        drag = { x: p.x, y: p.y, moved: 0 }
        if (!isTouch) back.setPointerCapture(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
        isTouch = event.pointerType === "touch"
        lastInteraction = performance.now()
        const p = localPoint(event)
        if (markDrag) {
            markSpin.y += (p.x - markDrag.x) * 0.012
            markSpin.x += (p.y - markDrag.y) * 0.012
            markDrag = p
            pointer = p
            return
        }
        if (drag) {
            const dx = p.x - drag.x
            const dy = p.y - drag.y
            drag.moved += Math.abs(dx) + Math.abs(dy)
            drag.x = p.x
            drag.y = p.y
            if (!holding) spin += DRAG_SPIN * dx
        }
        if (isTouch && !drag) return
        pointer = p
        pointerNX = width ? (p.x / width - 0.5) * 2 : 0
        pointerNY = height ? (p.y / height - 0.5) * 2 : 0
        updateHover()
    }

    const onPointerUp = (event: PointerEvent) => {
        if (back.hasPointerCapture(event.pointerId)) back.releasePointerCapture(event.pointerId)
        if (holding) {
            holding = false
            startFlight(baseZoom(), null, 0.9)
            updateHover()
            return
        }
        if (markDrag) {
            markDrag = null
            back.style.touchAction = "pan-y"
            updateHover()
            return
        }
        drag = null
        updateHover()
    }

    const onPointerLeave = (event: PointerEvent) => {
        if (event.pointerType === "touch") return
        pointer = null
        pointerNX = 0
        pointerNY = 0
        updateHover()
    }

    const onDocumentPointerDown = (event: PointerEvent) => {
        if (event.target instanceof Node && wrap.contains(event.target)) return
        pointer = null
        updateHover()
    }

    back.addEventListener("pointerdown", onPointerDown)
    back.addEventListener("pointermove", onPointerMove)
    back.addEventListener("pointerup", onPointerUp)
    back.addEventListener("pointercancel", onPointerUp)
    back.addEventListener("pointerleave", onPointerLeave)
    document.addEventListener("pointerdown", onDocumentPointerDown)

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(wrap)
    resize()

    // Glass mark backplate: a blurred crop of the galaxy behind the mark, refracted by it.
    const paintBackplate = (context: CanvasRenderingContext2D, size: number) => {
        const labsIn = easeOutCubic(intro.labs)
        if (labsIn < 0.01) return
        const scale = back.width / (width || 1)
        context.globalAlpha = 0.75 * labsIn
        context.filter = "blur(3px)"
        context.drawImage(
            back,
            (markBehind.x - markBehind.size / 2) * scale,
            (markBehind.y - markBehind.size / 2) * scale,
            markBehind.size * scale,
            markBehind.size * scale,
            0,
            0,
            size,
            size
        )
        context.drawImage(
            front,
            (markBehind.x - markBehind.size / 2) * scale,
            (markBehind.y - markBehind.size / 2) * scale,
            markBehind.size * scale,
            markBehind.size * scale,
            0,
            0,
            size,
            size
        )
        context.filter = "none"
        context.globalAlpha = 1
    }

    let frameId = 0
    let lastFrame = performance.now()
    let running = false
    let hidden = false

    const draw = (dt: number) => {
        const g = geometry()
        const { isDark } = palette
        const fg = (alpha: number) => rgba(palette.foreground, alpha)
        const accent = (alpha: number) => rgba(palette.accent, alpha)

        P.clearRect(0, 0, width, height)
        F.clearRect(0, 0, width, height)

        intro.boot = still ? 9 : Math.min(9, intro.boot + dt)
        if (intro.boot > 0.5 && clusters.length > 0) {
            intro.labs = still ? 1 : Math.min(1, intro.labs + dt / 0.9)
        }
        const drawIn = (step: number) => easeOutCubic(clamp((intro.boot - 0.1 * step) / 0.8, 0, 1))
        P.globalAlpha = drawIn(0)
        F.globalAlpha = P.globalAlpha
        const labsIn = easeOutCubic(intro.labs)

        // View easing and the hold-to-zoom flight.
        const ease = still ? 1 : 1 - 0.001 ** dt
        view.zoom += (view.tZoom - view.zoom) * ease
        view.panX += (view.tPanX - view.panX) * ease
        view.panY += (view.tPanY - view.panY) * ease
        if (flight) {
            const progress = flight.dur ? clamp((time - flight.t0) / flight.dur, 0, 1) : 1
            const k = easeInOutCubic(progress)
            let tx = 0
            let ty = 0
            const target = flight.cluster === null ? undefined : clusters[flight.cluster]
            if (target) {
                // Track the planet so it lands dead centre even while it settles.
                const s = PERSPECTIVE / (PERSPECTIVE - target.Y * Math.sin(tiltAngle()))
                tx = -flight.tz * target.X * g.R * s
                ty = -flight.tz * target.Y * Math.cos(tiltAngle()) * g.R * s
            }
            view.zoom = flight.fz + (flight.tz - flight.fz) * k
            view.panX = flight.fx + (tx - flight.fx) * k
            view.panY = flight.fy + (ty - flight.fy) * k
            view.tZoom = view.zoom
            view.tPanX = view.panX
            view.tPanY = view.panY
            if (progress >= 1 && !holding) {
                flight = null
                pinned = null
            }
        }

        const zoom = view.zoom
        const cx = g.ox + view.panX
        const cy = g.oy + view.panY

        // Orbits slow while a lab is hovered and stop while zoomed or dragging.
        const halted =
            still || zoom > baseZoom() * 1.05 || holding || Boolean(drag && drag.moved > 4)
        const targetMotion = halted ? 0 : hoverCluster === null ? 1 : 0.4
        motion =
            Math.abs(targetMotion - motion) < 0.005
                ? targetMotion
                : motion + (targetMotion - motion) * Math.min(1, 2 * dt)

        // Hover turns the system toward the cursor; it freezes while a lab is hovered so
        // the planet under the cursor stays put.
        if (hoverCluster === null && !holding) {
            const reach = still ? 0 : 1
            hoverSpin += (pointerNX * HOVER_SPIN * reach - hoverSpin) * Math.min(1, 2.4 * dt)
            tilt += (pointerNY * reach - tilt) * 0.04
            const parallaxReach = drag || still ? 0 : zoom < baseZoom() * 1.3 ? 1 : 0.4
            parallaxX += (pointerNX * parallaxReach - parallaxX) * 0.05
            parallaxY += (pointerNY * parallaxReach - parallaxY) * 0.05
        }
        const parallaxScale = 0.0015 * Math.min(width, 1440)
        const shift = (depth: number) => ({
            x: -parallaxX * parallaxScale * depth,
            y: -parallaxY * parallaxScale * depth * 0.7
        })

        const tiltRad = tiltAngle()
        const cosT = Math.cos(tiltRad)
        const sinT = Math.sin(tiltRad)
        if (Math.abs(cosT - arcCos) > 0.005) {
            arcCos = cosT
            arcTables = buildArcTables(cosT, sinT)
        }

        const project = (x: number, y: number) => {
            const s = PERSPECTIVE / (PERSPECTIVE - y * sinT)
            return {
                x: g.ox + x * g.R * s * zoom + view.panX,
                y: g.oy + y * cosT * g.R * s * zoom + view.panY,
                s
            }
        }

        // Stars.
        const starZoom = Math.sqrt(zoom)
        const starShift = shift(0.3)
        const starMax = isDark ? 0.42 : 0.55
        for (const bucket of starBuckets) bucket.length = 0
        for (const star of STARS) {
            const x = cx + star.x * g.R * starZoom + starShift.x
            const y = cy + star.y * g.R * starZoom + starShift.y
            if (x < -2 || y < -2 || x > width + 2 || y > height + 2) continue
            const twinkle = still ? 1 : 0.8 + 0.2 * Math.sin(0.8 * time + star.tw)
            const alpha = star.a * twinkle * copyFade({ x, y }, 0.3)
            starBuckets[Math.min(STAR_BUCKETS - 1, Math.floor(alpha * STAR_BUCKETS))]?.push(
                x - star.size / 2,
                y - star.size / 2,
                star.size
            )
        }
        starBuckets.forEach((bucket, i) => {
            if (!bucket.length) return
            P.fillStyle = fg(((i + 0.5) / STAR_BUCKETS) * starMax)
            P.beginPath()
            for (let j = 0; j < bucket.length; j += 3) {
                P.rect(bucket[j], bucket[j + 1], bucket[j + 2], bucket[j + 2])
            }
            P.fill()
        })

        // Orbit rings, drawn in one after another on first paint.
        const ring = (
            radius: number,
            offset: { x: number; y: number },
            samples: number,
            drawn: number
        ) => {
            P.beginPath()
            for (let i = 0; i <= drawn; i++) {
                const angle = Math.PI / 2 + (i / samples) * Math.PI * 2
                const p = project(Math.cos(angle) * radius, Math.sin(angle) * radius)
                if (i === 0) P.moveTo(p.x + offset.x, p.y + offset.y)
                else P.lineTo(p.x + offset.x, p.y + offset.y)
            }
            P.stroke()
        }
        P.lineWidth = 1
        P.strokeStyle = fg(isDark ? 0.09 : 0.15)
        ORBITS.forEach((radius, i) => {
            ring(radius, shift(0.5 + 0.25 * i), 96, Math.round(96 * drawIn(i)))
        })
        GUIDE_ORBITS.forEach((radius, i) => {
            P.strokeStyle = fg((isDark ? 0.07 : 0.08) * (1 - 0.28 * i))
            ring(radius, shift(1.25 + 0.25 * i), 128, Math.round(128 * drawIn(ORBITS.length + i)))
        })

        // Planets.
        satelliteTurn += dt * motion * 0.6
        for (const cluster of clusters) {
            cluster.theta += cluster.omega * motion * dt
            const table = arcTables.get(cluster.orbit)
            const angle = table
                ? arcAngle(cluster.theta + spin + hoverSpin, table)
                : cluster.theta + spin + hoverSpin
            const x = Math.cos(angle) * cluster.orbit
            const y = Math.sin(angle) * cluster.orbit
            const p = project(x, y)
            const offset = shift(cluster.depth)
            cluster.px = p.x + offset.x
            cluster.py = p.y + offset.y
            cluster.prx = cluster.r * g.R * p.s * zoom
            cluster.pry = cluster.prx * cosT
            cluster.X = x
            cluster.Y = y
        }

        const blend = still ? 1 : Math.min(1, 14 * dt)
        for (let i = 0; i < clusters.length; i++) {
            const target = hoverCluster === i || pinned === i ? 1 : 0
            highlight[i] += (target - highlight[i]) * blend
        }
        anyHighlight += (Number(hoverCluster !== null || pinned !== null) - anyHighlight) * blend

        // Moons.
        const sizeZoom = 1 + (zoom - 1) * 0.3
        const dotMin = isDark ? 0.3 : 0.38
        const dotMax = isDark ? 1 : 0.95
        const dim = 1 - 0.45 * anyHighlight
        for (const point of points) {
            const cluster = clusters[point.cluster]
            if (!cluster || labsIn < 0.01) continue
            const orbitAngle = point.angle + satelliteTurn * (0.12 / (0.4 + point.ring))
            const p = project(
                cluster.X + Math.cos(orbitAngle) * point.ring * cluster.r,
                cluster.Y + Math.sin(orbitAngle) * point.ring * cluster.r
            )
            const offset = shift(cluster.depth)
            point.s = p.s
            let x = p.x + offset.x
            let y = p.y + offset.y

            // Moons lean away from the cursor.
            let nudge = 0
            if (pointer && !drag && zoom < baseZoom() * 1.3) {
                const dx = x - pointer.x
                const dy = y - pointer.y
                const distance = Math.hypot(dx, dy)
                if (distance < 120) {
                    nudge = 1 - distance / 120
                    const push = nudge * nudge * 3
                    x += (dx / (distance || 1)) * push
                    y += (dy / (distance || 1)) * push
                }
            }

            // Keep the disc clear of the lab badge.
            const dx = x - cluster.px
            const dy = y - cluster.py
            const distance = Math.hypot(dx, dy)
            const clearance = BADGE_CLEARANCE
            const spread = Math.sqrt(
                clearance * clearance +
                    distance *
                        distance *
                        (1 - (clearance / Math.max(cluster.prx, clearance + 1)) ** 2)
            )
            x = cluster.px + (distance > 0.5 ? dx / distance : Math.cos(point.angle)) * spread
            y = cluster.py + (distance > 0.5 ? dy / distance : Math.sin(point.angle)) * spread
            point.x = x
            point.y = y
            if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue

            const fade = copyFade(point, 0.3) * labsIn
            const lit = highlight[point.cluster] ?? 0
            const depthFade = clamp((point.s - 0.7) / 0.6, 0.55, 1)
            const base = ((dotMin + (dotMax - dotMin) * point.lum) * depthFade + 0.5 * nudge) * dim
            const alpha = base + (1 - base) * lit
            const spoke =
                cluster.count > 1
                    ? (isDark ? 0.16 : 0.26) * (cluster.count <= 6 ? 1.5 : 1) * depthFade * dim
                    : 0
            const radius = Math.max(1.9, point.size * point.s * sizeZoom) + 0.6 * lit
            const layer = isFront(point.cluster) ? 1 : 0
            const context = layer ? F : P

            if (lit > 0.01) {
                if (spoke) {
                    context.strokeStyle = mixRgba(
                        palette.foreground,
                        palette.accent,
                        lit,
                        (spoke + (0.45 - spoke) * lit) * fade
                    )
                    context.lineWidth = 0.6
                    context.beginPath()
                    context.moveTo(cluster.px, cluster.py)
                    context.lineTo(x, y)
                    context.stroke()
                }
                context.fillStyle = mixRgba(palette.foreground, palette.accent, lit, alpha * fade)
                context.beginPath()
                context.arc(x, y, radius, 0, Math.PI * 2)
                context.fill()
                continue
            }
            if (spoke) {
                spokeBuckets[layer][
                    Math.min(BUCKETS - 1, Math.floor(((spoke * fade) / 0.4) * BUCKETS))
                ]?.push(cluster.px, cluster.py, x, y)
            }
            dotBuckets[layer][Math.min(BUCKETS - 1, Math.floor(alpha * fade * BUCKETS))]?.push(
                x,
                y,
                radius
            )
        }
        ;[P, F].forEach((context, layer) => {
            context.lineWidth = 0.6
            spokeBuckets[layer].forEach((bucket, i) => {
                if (!bucket.length) return
                context.strokeStyle = fg(((i + 0.5) / BUCKETS) * 0.4)
                context.beginPath()
                for (let j = 0; j < bucket.length; j += 4) {
                    context.moveTo(bucket[j], bucket[j + 1])
                    context.lineTo(bucket[j + 2], bucket[j + 3])
                }
                context.stroke()
                bucket.length = 0
            })
            dotBuckets[layer].forEach((bucket, i) => {
                if (!bucket.length) return
                context.fillStyle = fg((i + 0.5) / BUCKETS)
                context.beginPath()
                for (let j = 0; j < bucket.length; j += 3) {
                    context.moveTo(bucket[j] + bucket[j + 2], bucket[j + 1])
                    context.arc(bucket[j], bucket[j + 1], bucket[j + 2], 0, Math.PI * 2)
                }
                context.fill()
                bucket.length = 0
            })
        })

        drawModelLabels(sizeZoom)
        drawMark(dt, g, project, shift)
        drawPings(accent)

        if (hoverPoint) {
            const context = isFront(hoverPoint.cluster) ? F : P
            context.strokeStyle = accent(1)
            context.lineWidth = 1.5
            context.beginPath()
            context.arc(hoverPoint.x, hoverPoint.y, 6, 0, Math.PI * 2)
            context.stroke()
        }

        // On wide screens the copy column sits on the left; fade the field out under it.
        if (g.wide) {
            const gradient = P.createLinearGradient(0, 0, width * 0.42, 0)
            gradient.addColorStop(0, "rgba(0,0,0,1)")
            gradient.addColorStop(0.2, "rgba(0,0,0,0.55)")
            gradient.addColorStop(0.45, "rgba(0,0,0,0.3)")
            gradient.addColorStop(1, "rgba(0,0,0,0)")
            for (const context of [P, F]) {
                context.save()
                context.globalAlpha = 1
                context.globalCompositeOperation = "destination-out"
                context.fillStyle = gradient
                context.fillRect(0, 0, width * 0.42, height)
                context.restore()
            }
        }

        updateLabels(dt, g.wide, labsIn)
        updateCard(dt)
    }

    function tiltAngle() {
        return (width >= WIDE_MIN ? 1.27 : 1) + 0.015 * tilt
    }

    const drawModelLabels = (sizeZoom: number) => {
        const reveal = clamp((view.zoom - 2.6) / 1.2, 0, 1)
        const focus =
            pinned === null
                ? []
                : points.filter((point) => point.cluster === pinned).slice(0, MODEL_LABEL_LIMIT)
        if (reveal <= 0 || (!pointer && !focus.length) || (drag && drag.moved > 4)) return
        F.font = `450 14px ${fontFamily}`
        F.textAlign = "left"
        F.textBaseline = "middle"
        const placed: { x: number; y: number; w: number }[] = []
        const seen = new Set<Point>()
        for (const point of hoverPoint ? [hoverPoint, ...focus] : focus) {
            if (seen.has(point)) continue
            seen.add(point)
            const x = point.x + 6 * sizeZoom
            const w = F.measureText(point.model.name).width
            if (
                placed.some(
                    (other) =>
                        Math.abs(other.y - point.y) < 15 &&
                        x < other.x + other.w + 6 &&
                        x + w + 6 > other.x
                )
            ) {
                continue
            }
            placed.push({ x, y: point.y, w })
            const strength = point === hoverPoint ? 1 : palette.isDark ? 0.75 : 0.85
            F.fillStyle = rgba(palette.foreground, strength * reveal * copyFade(point, 0))
            F.fillText(point.model.name, x, point.y)
        }
    }

    const drawMark = (
        dt: number,
        g: ReturnType<typeof geometry>,
        project: (x: number, y: number) => { x: number; y: number },
        shift: (depth: number) => { x: number; y: number }
    ) => {
        if (!mark) return
        const offset = shift(1.4)
        const size = 0.225 * g.R * view.zoom
        const x = g.ox + view.panX + offset.x
        const y = (project(0, -ORBITS[0]).y + project(0, ORBITS[0]).y) / 2 + offset.y - 0.2 * size
        const box = 1.9 * size
        const dpr = Math.min(window.devicePixelRatio || 1, 2)

        let faceX = 0
        let faceY = 0
        if (pointer && !drag && !markDrag && !still) {
            const dx = pointer.x - x
            const dy = pointer.y - y
            const distance = Math.hypot(dx, dy) || 1
            const falloff = clamp((distance - 0.1 * width) / (0.4 * width), 0, 1)
            const reach = Math.min(1, distance / 32) * (1 - falloff * falloff * (3 - 2 * falloff))
            faceX = (dx / distance) * reach
            faceY = (dy / distance) * reach
        }
        markFace = {
            x: markFace.x + (faceX - markFace.x) * Math.min(1, 4 * dt),
            y: markFace.y + (faceY - markFace.y) * Math.min(1, 4 * dt)
        }
        markCircle = { x, y, r: 0.62 * size }
        if (!markDrag) {
            // A damped spring brings a flicked mark back to rest.
            markSpin.vx += (-60 * markSpin.x - 11 * markSpin.vx) * dt
            markSpin.vy += (-60 * markSpin.y - 11 * markSpin.vy) * dt
            markSpin.x += markSpin.vx * dt
            markSpin.y += markSpin.vy * dt
        }
        markBehind = { x, y, size: box * 0.9 }

        const visible =
            x + box / 2 > 0 && x - box / 2 < width && y + box / 2 > 0 && y - box / 2 < height
        const moving = Boolean(drag) || Math.abs(view.tZoom - view.zoom) > 0.001 || Boolean(flight)
        if (visible) {
            mark.render({
                px: Math.min(box * dpr, moving ? 768 : 1536),
                t: still ? 0 : time,
                faceX: markFace.x,
                faceY: markFace.y,
                spinX: markSpin.x,
                spinY: markSpin.y,
                palette,
                paint: paintBackplate
            })
        }
        markIn = still ? 1 : Math.min(1, markIn + (intro.labs > 0 ? dt / 0.8 : 0))
        const opacity = (copyFade({ x, y }, 0.08) * markIn * (2 - markIn)).toFixed(3)
        const boxSize = Math.round(box * 2) / 2
        const left = Math.round((x - box / 2) * 2) / 2
        const top = Math.round((y - box / 2) * 2) / 2
        const key = `${boxSize} ${left} ${top} ${opacity}`
        if (key !== markStyleKey) {
            markStyleKey = key
            const style = mark.canvas.style
            style.width = `${boxSize}px`
            style.height = `${boxSize}px`
            style.transform = `translate(${left}px, ${top}px)`
            style.opacity = opacity
        }
    }

    const drawPings = (accent: (alpha: number) => string) => {
        for (let i = pings.length - 1; i >= 0; i--) {
            const ping = pings[i]
            const age = (time - ping.born) / 1.1
            if (age >= 1) {
                pings.splice(i, 1)
                continue
            }
            const { x, y } = ping.point
            const fade = copyFade(ping.point, 0.1)
            const context = isFront(ping.point.cluster) ? F : P
            if (age < 0.3) {
                context.fillStyle = accent((1 - age / 0.3) * 0.75 * fade)
                context.beginPath()
                context.arc(x, y, 3, 0, Math.PI * 2)
                context.fill()
            }
            context.strokeStyle = accent((1 - age) * (palette.isDark ? 0.7 : 0.75) * fade)
            context.lineWidth = 1.3
            context.beginPath()
            context.arc(x, y, 2 + 13 * easeOutCubic(age), 0, Math.PI * 2)
            context.stroke()
        }
    }

    const updateLabels = (dt: number, wide: boolean, labsIn: number) => {
        const elements = options.labels()
        const step = Math.min(1, 12 * dt)
        const placed: { x: number; y: number }[] = []
        const shown = clusters.map(() => false)
        const order =
            hoverCluster === null
                ? bySize
                : [hoverCluster, ...bySize.filter((i) => i !== hoverCluster)]
        for (const i of order) {
            const cluster = clusters[i]
            if (!cluster) continue
            const overlaps = placed.some(
                (other) =>
                    Math.abs(other.y - cluster.py) < LABEL_BADGE - 6 &&
                    Math.abs(other.x - cluster.px) < LABEL_BADGE + 8
            )
            if (!overlaps) {
                placed.push({ x: cluster.px, y: cluster.py })
                shown[i] = true
            }
        }

        clusters.forEach((cluster, i) => {
            const element = elements[i]
            if (!element) return
            const onScreen =
                cluster.px > -40 &&
                cluster.px < width + 40 &&
                cluster.py > -40 &&
                cluster.py < height + 40
            const edge = clamp(cluster.px / (0.16 * width), 0, 1)
            const behindMark = !isFront(i) && inMark({ x: cluster.px, y: cluster.py }) ? 0.1 : 1
            const others = hoverCluster !== null && hoverCluster !== i ? 0.75 : 1
            const target =
                shown[i] && onScreen
                    ? clamp(distanceToCopy(cluster.px, cluster.py) / 40, 0, 1) *
                      (wide ? edge * edge * (3 - 2 * edge) : 1) *
                      behindMark *
                      others *
                      labsIn
                    : 0
            const current = labelOpacity[i]
            const next =
                Math.abs(target - current) < 0.01 ? target : current + (target - current) * step
            if (next !== current) {
                labelOpacity[i] = next
                element.style.opacity = next.toFixed(3)
            }
            if (next === 0) return
            const z = isFront(i) ? "2" : "0"
            if (z !== labelZ[i]) {
                labelZ[i] = z
                element.style.zIndex = z
            }
            const x = Math.round(cluster.px * 2) / 2
            const y = Math.round(cluster.py * 2) / 2
            if (x !== labelX[i] || y !== labelY[i]) {
                labelX[i] = x
                labelY[i] = y
                element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
            }
        })
    }

    const updateCard = (dt: number) => {
        const card = options.card()
        if (!card || hoverCluster === null) return
        const cluster = clusters[hoverCluster]
        if (!cluster) return
        const halfWidth = card.offsetWidth / 2
        const cardHeight = card.offsetHeight

        let anchorX = hoverPoint?.x ?? cluster.px
        let top = (hoverPoint?.y ?? cluster.py) - 10
        let bottom = (hoverPoint?.y ?? cluster.py) + 10
        if (view.zoom <= baseZoom() * 1.3) {
            anchorX = cluster.px
            top = cluster.py - LABEL_BADGE / 2
            bottom = cluster.py + LABEL_BADGE / 2
            for (const point of points) {
                if (point.cluster !== hoverCluster) continue
                top = Math.min(top, point.y - 2 * point.size)
                bottom = Math.max(bottom, point.y + 2 * point.size)
            }
        }
        const x = clamp(anchorX, halfWidth + 8, width - halfWidth - 8)
        const y = top - 12 - cardHeight >= 8 ? top - 12 - cardHeight : bottom + 12
        const follow = !cardShown || still ? 1 : 1 - 0.0001 ** dt
        cardX += (x - cardX) * follow
        cardY += (y - cardY) * follow
        cardShown = true
        card.style.transform = `translate(${cardX}px, ${cardY}px) translateX(-50%)`
        card.style.visibility = "visible"
    }

    const tick = (now: number) => {
        const busy =
            now - lastInteraction < 1000 ||
            Boolean(drag) ||
            Boolean(markDrag) ||
            Boolean(flight) ||
            Math.abs(view.tZoom - view.zoom) > 0.001
        if (now - lastFrame < (busy ? 1000 / 60 : 1000 / 30) - 2) {
            frameId = requestAnimationFrame(tick)
            return
        }
        const dt = Math.min((now - lastFrame) / 1000, 0.05)
        lastFrame = now
        time += dt

        if (!still && intro.labs >= 1 && points.length > 0) {
            pingDebt += PING_RATE * dt * Math.max(motion, 0.25)
            while (pingDebt >= 1) {
                const point = points[Math.floor(Math.random() * points.length)]
                if (point) pings.push({ point, born: time })
                if (pings.length > MAX_PINGS) pings.shift()
                pingDebt -= 1
            }
        }
        if (pointer && !isTouch) updateHover()
        draw(dt)
        frameId = requestAnimationFrame(tick)
    }

    const schedule = () => {
        cancelAnimationFrame(frameId)
        if (running && !hidden && document.visibilityState === "visible") {
            lastFrame = performance.now()
            frameId = requestAnimationFrame(tick)
        }
    }
    const intersection = new IntersectionObserver(([entry]) => {
        running = entry?.isIntersecting ?? false
        schedule()
    })
    intersection.observe(wrap)
    document.addEventListener("visibilitychange", schedule)

    // Pause while a modal hides the page.
    const isHidden = () => wrap.closest('[aria-hidden="true"]') !== null
    hidden = isHidden()
    const hiddenObserver = new MutationObserver(() => {
        const next = isHidden()
        if (next !== hidden) {
            hidden = next
            schedule()
        }
    })
    hiddenObserver.observe(wrap.ownerDocument.body, {
        attributes: true,
        attributeFilter: ["aria-hidden"],
        subtree: true
    })

    return () => {
        disposed = true
        window.clearTimeout(settleTimer)
        mark?.canvas.remove()
        mark?.dispose()
        cancelAnimationFrame(frameId)
        intersection.disconnect()
        hiddenObserver.disconnect()
        resizeObserver.disconnect()
        themeObserver.disconnect()
        document.removeEventListener("visibilitychange", schedule)
        document.removeEventListener("pointerdown", onDocumentPointerDown)
        back.removeEventListener("pointerdown", onPointerDown)
        back.removeEventListener("pointermove", onPointerMove)
        back.removeEventListener("pointerup", onPointerUp)
        back.removeEventListener("pointercancel", onPointerUp)
        back.removeEventListener("pointerleave", onPointerLeave)
    }
}
