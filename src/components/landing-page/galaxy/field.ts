import type { GalaxyCatalog, GalaxyLab, GalaxyModel } from "./catalog"

// Orbit radii in units of the system radius R. Planets ride ORBITS; GUIDE_ORBITS are
// decorative outer rings.
export const ORBITS = [0.32, 0.55, 0.75, 0.92, 1.08, 1.24]
export const GUIDE_ORBITS = [1.5, 1.9]

// Fake perspective: a point at depth y (positive = toward the viewer) scales by
// PERSPECTIVE / (PERSPECTIVE - y * sin(tilt)).
export const PERSPECTIVE = 3.4

const ORBIT_SPEED = 0.012
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const INNER_RING_CAPACITY = 4
const LUT_SAMPLES = 128

export type Cluster = GalaxyLab & {
    orbit: number
    theta: number
    omega: number
    /** Planet radius in R units. */
    r: number
    /** Parallax weight; bigger labs sit nearer. */
    depth: number
    // Per frame.
    X: number
    Y: number
    px: number
    py: number
    prx: number
    pry: number
}

export type Point = {
    model: GalaxyModel
    cluster: number
    ring: number
    angle: number
    size: number
    lum: number
    // Per frame.
    s: number
    x: number
    y: number
}

export type Star = { x: number; y: number; size: number; a: number; tw: number }

export type GalaxyField = { clusters: Cluster[]; points: Point[] }

export const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value))

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export const seededRandom = (seed: number) => {
    let state = seed
    return () => {
        state = (state * 16807) % 0x7fffffff
        return state / 0x7fffffff
    }
}

// The biggest labs fill the inner ring; the rest spread over the outer rings in proportion
// to each ring's circumference.
export const planRings = (labCount: number) => {
    const plan = ORBITS.map(() => 0)
    plan[0] = Math.min(labCount, INNER_RING_CAPACITY)
    const rest = labCount - plan[0]
    if (rest <= 0) return plan

    const weights = ORBITS.slice(1)
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    const shares = weights.map((weight) => (rest * weight) / total)
    shares.forEach((share, i) => {
        plan[i + 1] = Math.floor(share)
    })
    let left = rest - plan.reduce((sum, count) => sum + count, 0) + plan[0]
    const byRemainder = shares
        .map((share, i) => ({ i: i + 1, remainder: share - Math.floor(share) }))
        .sort((a, b) => b.remainder - a.remainder)
    for (const { i } of byRemainder) {
        if (left <= 0) break
        plan[i] += 1
        left -= 1
    }
    return plan
}

const DAY_SECONDS = 86_400

// Newer models glow brighter. SilkChat's own fade over months from when they were added;
// the wider OpenRouter catalog fades over a year from its knowledge cutoff and stays dimmer.
const getLuminance = (model: GalaxyModel, nowSeconds: number) => {
    const date = model.date ? Date.parse(model.date) : Number.NaN
    const halfLife = model.curated ? 120 : 365
    const recency = Number.isNaN(date)
        ? 0.25
        : 2 ** (-Math.max(0, nowSeconds - date / 1000) / DAY_SECONDS / halfLife)
    if (!model.curated) return recency * 0.6
    return model.legacy ? recency * 0.5 : recency
}

const getSize = (model: GalaxyModel) => (!model.curated ? 1.2 : model.legacy ? 1.6 : 2.6)

// SilkChat's own models sit at the heart of each lab's disc.
const compareModels = (a: GalaxyModel, b: GalaxyModel) =>
    Number(b.curated) - Number(a.curated) ||
    Number(a.legacy) - Number(b.legacy) ||
    (b.date ?? "").localeCompare(a.date ?? "")

export const buildGalaxyField = (catalog: GalaxyCatalog, nowSeconds: number): GalaxyField => {
    const plan = planRings(catalog.labs.length)
    let ring = 0
    let indexInRing = 0

    const clusters: Cluster[] = catalog.labs.map((lab, k) => {
        while (ring < plan.length - 1 && indexInRing >= plan[ring]) {
            ring += 1
            indexInRing = 0
        }
        const ringCount = plan[ring] || 1
        const cluster: Cluster = {
            ...lab,
            orbit: ORBITS[ring],
            theta: ((indexInRing + ((0.618 * ring) % 1)) / ringCount) * Math.PI * 2,
            omega: ORBIT_SPEED,
            r: 0.016 + 0.011 * Math.sqrt(lab.count),
            depth: 1.2 - (k / Math.max(1, catalog.labs.length - 1)) * 0.8,
            X: 0,
            Y: 0,
            px: 0,
            py: 0,
            prx: 0,
            pry: 0
        }
        indexInRing += 1
        return cluster
    })

    const points: Point[] = catalog.labs.flatMap((lab, clusterIndex) => {
        const models = catalog.models.filter((model) => model.lab === lab.key).sort(compareModels)
        return models.map((model, i) => ({
            model,
            cluster: clusterIndex,
            ring: Math.sqrt((i + 0.5) / models.length),
            angle: i * GOLDEN_ANGLE + clusterIndex,
            size: getSize(model),
            lum: getLuminance(model, nowSeconds),
            s: 1,
            x: 0,
            y: 0
        }))
    })

    return { clusters, points }
}

/**
 * Arc-length lookup per orbit, so planets keep a steady on-screen speed around the
 * perspective ellipse instead of speeding up at its ends.
 */
export const buildArcTables = (cosTilt: number, sinTilt: number) =>
    new Map(
        ORBITS.map((orbit) => {
            const table = new Float32Array(LUT_SAMPLES + 1)
            const at = (angle: number) => {
                const scale = PERSPECTIVE / (PERSPECTIVE - Math.sin(angle) * orbit * sinTilt)
                return [Math.cos(angle) * scale, cosTilt * Math.sin(angle) * scale] as const
            }
            let [lastX, lastY] = at(0)
            let length = 0
            for (let i = 1; i <= LUT_SAMPLES; i++) {
                const [x, y] = at((i / LUT_SAMPLES) * Math.PI * 2)
                length += Math.hypot(x - lastX, y - lastY)
                table[i] = length
                lastX = x
                lastY = y
            }
            return [orbit, table.map((value) => value / length)] as const
        })
    )

export const arcAngle = (theta: number, table: Float32Array) => {
    const u = (((theta / (Math.PI * 2)) % 1) + 1) % 1
    let lo = 0
    let hi = LUT_SAMPLES
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if ((table[mid] ?? 0) <= u) lo = mid
        else hi = mid
    }
    const start = table[lo] ?? 0
    const span = (table[hi] ?? 1) - start || 1
    return ((lo + (u - start) / span) / LUT_SAMPLES) * Math.PI * 2
}

export const STARS: Star[] = (() => {
    const random = seededRandom(11)
    return Array.from({ length: 1800 }, () => {
        const angle = random() * Math.PI * 2
        const radius = Math.sqrt(0.09 + random() * (12.96 - 0.09))
        return {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius * 0.8,
            size: 0.6 + 1.1 * random(),
            a: 0.3 + 0.7 * random(),
            tw: random() * Math.PI * 2
        }
    })
})()
