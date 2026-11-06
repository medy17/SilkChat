// A moonlit lake painted one chunky pixel at a time: silk threads drift across
// the sky, moths gather at the moon or the pointer, and silk lanterns float on
// water that ripples under the cursor. Nothing here touches the DOM. It fills an
// RGBA buffer that the caller blits to a low-resolution canvas.

export type Rgb = readonly [number, number, number]

export type SceneColors = {
    background: Rgb
    foreground: Rgb
    accent: Rgb
    warm: Rgb
}

// The block of hero copy, in scene pixels. Nothing is ever drawn behind it.
export type CopyRect = { left: number; top: number; right: number; bottom: number }

export type Palette = {
    ramp: Uint32Array
    backdrop: number
    farLand: number
    nearLand: number
    moth: number
    mothBody: number
    lantern: number
    lanternCore: number
    lanternFrame: number
    lanternGlow: number
}

type Moth = {
    x: number
    y: number
    velocityX: number
    velocityY: number
    orbit: number
    radius: number
    flap: number
}

type Lantern = { x: number; y: number; drift: number; bob: number; large: boolean }
type Ripple = { x: number; y: number; age: number; strength: number }

export type PixelScene = {
    width: number
    height: number
    horizon: number
    copy: CopyRect
    clearTop: number
    time: number
    pixels: Uint8ClampedArray
    palette: Palette
    moon: { x: number; y: number }
    pointer: { x: number; y: number; active: boolean }
    moths: Moth[]
    lanterns: Lantern[]
    ripples: Ripple[]
}

type SceneLayers = {
    words: Uint32Array
    skyBase: Float32Array
    skyValue: Float32Array
    quiet: Float32Array
    land: Uint8Array
    streaks: Float32Array
    edge: Float32Array
}

const layers = new WeakMap<PixelScene, SceneLayers>()

export const BAYER = [
    0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60,
    28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47,
    7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21
].map((value) => (value + 0.5) / 64)

const STREAK_WIDTH = 256
const STREAK_ROWS = 64
const MAX_RIPPLES = 10
const COPY_MARGIN = 4
// From a moth's center to the edge of its sprite, plus a pixel of air.
const MOTH_CLEARANCE = 5
const LAND_NONE = 0
const LAND_FAR = 1
const LAND_NEAR = 2

// # wing, o body, W lit core, L paper, d frame
export const MOTH_WINGS_UP = ["##...##", "###o###", ".##o##.", "..#o#..", "...o..."]
export const MOTH_WINGS_DOWN = [".......", "###o###", "###o###", ".##o##.", "...o..."]
const LANTERN_LARGE = [".ddd.", ".LWL.", ".LWL.", ".LLL.", "ddddd"]
const LANTERN_SMALL = ["LWL", "LLL", "ddd"]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const smoothstep = (from: number, to: number, value: number) => {
    const t = clamp((value - from) / (to - from), 0, 1)
    return t * t * (3 - 2 * t)
}
const mix = (from: Rgb, to: Rgb, amount: number): Rgb => [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount
]
const pack = ([red, green, blue]: Rgb) =>
    ((255 << 24) | (Math.round(blue) << 16) | (Math.round(green) << 8) | Math.round(red)) >>> 0

function seededRandom(seed: number) {
    let state = seed
    return () => {
        state = (state + 0x6d2b79f5) | 0
        let value = Math.imul(state ^ (state >>> 15), 1 | state)
        value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296
    }
}

const brightness = ([red, green, blue]: Rgb) =>
    (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255

// Dark themes light the scene with the foreground. Light themes lower the sky a
// little so a white moon has something to sit against, and text stays dark on it.
export function buildPalette({ background, foreground, accent, warm }: SceneColors): Palette {
    const isDark = brightness(background) < 0.5
    const white: Rgb = [255, 255, 255]
    const black: Rgb = [0, 0, 0]
    const light = isDark ? foreground : white
    const sky = isDark ? background : mix(background, foreground, 0.1)
    const tinted = mix(sky, accent, 0.3)
    const shadow = isDark ? mix(background, black, 0.42) : mix(background, foreground, 0.58)
    const moth = isDark ? light : shadow

    return {
        ramp: Uint32Array.from(
            [
                mix(sky, accent, 0.04),
                mix(sky, accent, 0.14),
                tinted,
                mix(tinted, light, 0.22),
                mix(tinted, light, 0.48),
                mix(tinted, light, 0.76),
                light
            ].map(pack)
        ),
        backdrop: pack(background),
        farLand: pack(mix(shadow, tinted, 0.55)),
        nearLand: pack(shadow),
        moth: pack(moth),
        mothBody: pack(mix(moth, tinted, 0.5)),
        lantern: pack(warm),
        lanternCore: pack(mix(warm, white, 0.7)),
        lanternFrame: pack(mix(shadow, warm, 0.2)),
        lanternGlow: pack(mix(warm, tinted, 0.5))
    }
}

function buildLand(
    width: number,
    height: number,
    horizon: number,
    ceiling: number,
    random: () => number
) {
    const land = new Uint8Array(width * height)
    const paint = (x: number, y: number, kind: number) => {
        if (x < 0 || x >= width || y < ceiling || y >= horizon) return
        const index = y * width + x
        if (land[index] < kind) land[index] = kind
    }

    // The tallest crown stands about 36 pixels at full scale.
    const scale = clamp((horizon - ceiling) / 36, 0.3, 1.4)
    const phase = random() * 10
    for (let x = 0; x < width; x++) {
        const across = x / width
        const toEdge = Math.abs(across - 0.5) * 2
        const hills =
            2.5 +
            Math.sin(across * 9 + phase) * 2 +
            Math.sin(across * 23 + phase * 2) * 1.2 +
            smoothstep(0.4, 1, toEdge) * 16
        const top = Math.round(hills * scale)
        for (let y = 0; y < top; y++) paint(x, horizon - 1 - y, LAND_FAR)
    }

    // Round mulberry crowns crowd the shore at both edges and thin out inland.
    const reach = Math.max(14, width * 0.2)
    for (const side of [0, 1]) {
        for (let tree = 0; tree < 11; tree++) {
            const inland = (tree + random() * 0.8) / 11
            const x = Math.round(side === 0 ? inland * reach : width - 1 - inland * reach)
            const radius = (7.5 - inland * 4.5 + random() * 2.5) * scale
            const trunk = radius * (0.9 + random() * 1.1)
            const crownY = horizon - trunk - radius * 0.5

            for (let y = Math.round(crownY); y < horizon; y++) {
                paint(x, y, LAND_NEAR)
                paint(x + 1, y, LAND_NEAR)
            }
            for (let lobe = 0; lobe < 6; lobe++) {
                const lobeX = x + (random() - 0.5) * radius * 1.7
                const lobeY = crownY + (random() - 0.5) * radius * 1.1
                const lobeRadius = radius * (0.32 + random() * 0.3)
                const reachOut = Math.ceil(lobeRadius)
                for (let dy = -reachOut; dy <= reachOut; dy++) {
                    for (let dx = -reachOut; dx <= reachOut; dx++) {
                        if (dx * dx + dy * dy <= lobeRadius * lobeRadius) {
                            paint(Math.round(lobeX + dx), Math.round(lobeY + dy), LAND_NEAR)
                        }
                    }
                }
            }
        }
        const shore = Math.round(reach * 1.2)
        for (let offset = 0; offset < shore; offset++) {
            const x = side === 0 ? offset : width - 1 - offset
            const rise = Math.round((1 - offset / shore) * 5 * scale)
            for (let y = 0; y < rise; y++) paint(x, horizon - 1 - y, LAND_NEAR)
        }
    }

    for (let y = horizon - 1; y > 0; y--) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x
            const above = land[index - width]
            if (land[index] === LAND_NEAR && above !== LAND_NEAR && (x + y) % 3 !== 0) {
                land[index] = LAND_FAR
            }
        }
    }
    return land
}

// Long, thin noise rows: sampled across the water they read as wind streaks.
function buildStreaks(random: () => number) {
    const streaks = new Float32Array(STREAK_WIDTH * STREAK_ROWS)
    for (let row = 0; row < STREAK_ROWS; row++) {
        const knots = Array.from({ length: 16 }, () => random())
        for (let x = 0; x < STREAK_WIDTH; x++) {
            const position = (x / STREAK_WIDTH) * knots.length
            const knot = Math.floor(position)
            const blend = smoothstep(0, 1, position - knot)
            const from = knots[knot]
            const to = knots[(knot + 1) % knots.length]
            streaks[row * STREAK_WIDTH + x] = from + (to - from) * blend
        }
    }
    return streaks
}

// Beside the copy when there is room for it, otherwise low over the water.
function placeMoon(
    width: number,
    horizon: number,
    copy: CopyRect,
    clearTop: number,
    radius: number
) {
    const gutter = width - copy.right
    if (gutter > radius * 6) {
        return {
            x: Math.round(copy.right + gutter * 0.55),
            y: Math.round(Math.max(copy.top, clearTop) + radius * 2)
        }
    }
    return { x: Math.round(width * 0.72), y: Math.round(horizon - radius - 2) }
}

// Moths may go anywhere except over the copy, the column above it, or the nav.
function keepMothClear(scene: PixelScene, moth: Moth) {
    const { copy, clearTop, width } = scene
    const top = clearTop + MOTH_CLEARANCE
    if (moth.y < top) {
        moth.y = top
        moth.velocityY = Math.max(0, moth.velocityY)
    }

    const left = copy.left - MOTH_CLEARANCE
    const right = copy.right + MOTH_CLEARANCE
    const bottom = copy.bottom + MOTH_CLEARANCE
    if (moth.x <= left || moth.x >= right || moth.y >= bottom) return

    // A side the canvas can't show isn't a way out.
    const toLeft = left > 0 ? moth.x - left : Number.POSITIVE_INFINITY
    const toRight = right < width ? right - moth.x : Number.POSITIVE_INFINITY
    const toBottom = bottom - moth.y
    if (toBottom <= toLeft && toBottom <= toRight) {
        moth.y = bottom
        moth.velocityY = Math.max(0, moth.velocityY)
    } else if (toLeft <= toRight) {
        moth.x = left
        moth.velocityX = Math.min(0, moth.velocityX)
    } else {
        moth.x = right
        moth.velocityX = Math.max(0, moth.velocityX)
    }
}

export function createPixelScene({
    width,
    height,
    horizon: requestedHorizon,
    copy,
    clearTop,
    colors
}: {
    width: number
    height: number
    horizon: number
    copy: CopyRect
    // Rows above this stay empty for the nav.
    clearTop: number
    colors: SceneColors
}): PixelScene {
    const random = seededRandom(17)
    const horizon = Math.round(requestedHorizon)
    const skyBelowCopy = horizon - copy.bottom
    const moonRadius = clamp(Math.min(height * 0.03, skyBelowCopy / 2 - 3), 3, 8)
    const moon = placeMoon(width, horizon, copy, clearTop, moonRadius)

    const skyBase = new Float32Array(width * horizon)
    for (let y = 0; y < horizon; y++) {
        const descent = clamp((y - copy.bottom) / Math.max(1, skyBelowCopy), 0, 1)
        const glow = descent ** 2 * 0.3
        for (let x = 0; x < width; x++) {
            const distance = Math.hypot(x - moon.x, (y - moon.y) * 1.1)
            const halo = 0.42 * Math.exp(-Math.max(0, distance - moonRadius) / (moonRadius * 1.6))
            skyBase[y * width + x] = distance <= moonRadius ? 1.3 : glow + halo
        }
    }
    for (let star = 0; star < width * 0.22; star++) {
        const x = Math.floor(random() * width)
        const y = Math.floor(random() ** 1.5 * horizon * 0.7)
        skyBase[y * width + x] = Math.max(skyBase[y * width + x], 0.3 + random() * 0.4)
    }

    // One at the copy and under the nav, easing to zero across a soft margin.
    const quiet = new Float32Array(width * horizon)
    const soft = Math.max(8, width * 0.03)
    for (let y = 0; y < horizon; y++) {
        const belowCopy = Math.max(y - copy.bottom - COPY_MARGIN, 0)
        const belowNav = Math.max(y - clearTop, 0)
        for (let x = 0; x < width; x++) {
            const besideCopy = Math.max(
                copy.left - COPY_MARGIN - x,
                x - copy.right - COPY_MARGIN,
                0
            )
            const fromClear = Math.min(Math.hypot(besideCopy, belowCopy), belowNav)
            quiet[y * width + x] = 1 - smoothstep(0, soft, fromClear)
        }
    }

    const edge = new Float32Array(width)
    for (let x = 0; x < width; x++) {
        edge[x] = random() * 0.5 + Math.sin(x * 0.21) * 0.25 + Math.sin(x * 0.067) * 0.25
    }

    const lanternCount = clamp(Math.round(width / 26), 5, 16)

    const scene: PixelScene = {
        width,
        height,
        horizon,
        copy,
        clearTop,
        time: 0,
        pixels: new Uint8ClampedArray(width * height * 4),
        palette: buildPalette(colors),
        moon,
        pointer: { x: 0, y: 0, active: false },
        moths: Array.from({ length: clamp(Math.round(width / 40), 4, 12) }, () => ({
            x: moon.x + (random() - 0.5) * 60,
            y: moon.y + (random() - 0.5) * 40,
            velocityX: 0,
            velocityY: 0,
            orbit: random() * Math.PI * 2,
            radius: (20 + random() * 30) * Math.min(1, width / 240),
            flap: random() * 10
        })),
        lanterns: Array.from({ length: lanternCount }, (_, index) => {
            const depth = random()
            return {
                x: ((index + random() * 0.7) / lanternCount) * width,
                y: horizon + 5 + depth ** 1.4 * (height - horizon) * 0.48,
                drift: (random() - 0.5) * 2.4,
                bob: random() * 10,
                large: depth > 0.5
            }
        }),
        ripples: []
    }

    layers.set(scene, {
        words: new Uint32Array(scene.pixels.buffer),
        skyBase,
        skyValue: new Float32Array(width * horizon),
        quiet,
        land: buildLand(width, height, horizon, copy.bottom + COPY_MARGIN, random),
        streaks: buildStreaks(random),
        edge
    })
    for (const moth of scene.moths) keepMothClear(scene, moth)
    return scene
}

export function setSceneColors(scene: PixelScene, colors: SceneColors) {
    scene.palette = buildPalette(colors)
}

export function movePointer(scene: PixelScene, x: number, y: number) {
    const { pointer, ripples, horizon } = scene
    const travelled = pointer.active ? Math.hypot(x - pointer.x, y - pointer.y) : 0
    pointer.x = x
    pointer.y = y
    pointer.active = true

    const newest = ripples[ripples.length - 1]
    const settled = !newest || newest.age > 0.16
    if (y > horizon + 1 && travelled > 0.5 && settled) addRipple(scene, x, y, 0.5)
}

export function clearPointer(scene: PixelScene) {
    scene.pointer.active = false
}

function addRipple(scene: PixelScene, x: number, y: number, strength: number) {
    scene.ripples.push({ x, y, age: 0, strength })
    if (scene.ripples.length > MAX_RIPPLES) scene.ripples.shift()
}

// A press sends the moths scattering and drops a ring on the water.
export function pressScene(scene: PixelScene, x: number, y: number) {
    for (const moth of scene.moths) {
        const away = Math.atan2(moth.y - y, moth.x - x)
        moth.velocityX += Math.cos(away) * 70
        moth.velocityY += Math.sin(away) * 70
    }
    if (y > scene.horizon) addRipple(scene, x, y, 1)
}

export function stepPixelScene(scene: PixelScene, delta: number) {
    const { moths, lanterns, ripples, moon, pointer, width, horizon } = scene
    scene.time += delta
    const time = scene.time

    for (const moth of moths) {
        const swirl = moth.orbit + time * (0.5 + moth.radius / 60)
        const anchorX = pointer.active ? pointer.x : moon.x
        const anchorY = pointer.active ? pointer.y : moon.y
        const radius = pointer.active ? moth.radius * 0.5 : moth.radius
        const targetX = anchorX + Math.cos(swirl) * radius
        const targetY = anchorY + Math.sin(swirl * 1.3) * radius * 0.6
        const pull = pointer.active ? 7 : 2.4

        moth.velocityX += (targetX - moth.x) * pull * delta
        moth.velocityY += (targetY - moth.y) * pull * delta
        moth.velocityY += Math.sin(time * 7 + moth.flap) * 14 * delta
        const drag = 1 - clamp(2.6 * delta, 0, 0.9)
        moth.velocityX *= drag
        moth.velocityY *= drag
        moth.x += moth.velocityX * delta
        moth.y += moth.velocityY * delta
        keepMothClear(scene, moth)
    }

    for (const lantern of lanterns) {
        lantern.x += lantern.drift * delta
        if (lantern.x < -6) lantern.x = width + 5
        if (lantern.x > width + 6) lantern.x = -5
        if (lantern.y < horizon + 3) lantern.y = horizon + 3
    }

    for (const ripple of ripples) ripple.age += delta
    while (ripples.length > 0 && ripples[0].age > 2.4) ripples.shift()
}

function drawThreads(scene: PixelScene, skyValue: Float32Array, time: number) {
    const { width, horizon, copy } = scene
    for (let thread = 0; thread < 9; thread++) {
        // Every third strand runs in the open sky under the copy.
        const lane =
            thread % 3 === 0
                ? copy.bottom + (horizon - copy.bottom) * (0.3 + thread * 0.06)
                : horizon * (0.1 + thread * 0.095)
        const speed = 0.12 + (thread % 3) * 0.05
        const length = 0.02 + (thread % 4) * 0.008
        for (let x = 0; x < width; x++) {
            // Only part of each thread is lit at once, so strands pass rather than sit.
            const lit = Math.sin(x * length * 1.7 + time * speed * 2 + thread * 2.1)
            if (lit < 0.1) continue
            const y = Math.round(
                lane +
                    Math.sin(x * length + time * speed + thread) * 4 +
                    Math.sin(x * length * 2.6 - time * speed * 1.4) * 1.6
            )
            if (y < 0 || y >= horizon) continue
            skyValue[y * width + x] += lit * 0.42
        }
    }
}

export function renderPixelScene(scene: PixelScene) {
    const { width, height, horizon, time, palette, pointer, moon, ripples } = scene
    const layer = layers.get(scene)
    if (!layer) return
    const { words, skyBase, skyValue, quiet, land, streaks, edge } = layer
    const { ramp } = palette
    const top = ramp.length - 1
    const lightRadius = 24
    const lightReach = lightRadius * lightRadius

    const glowAt = (x: number, y: number) => {
        if (!pointer.active) return 0
        const dx = x - pointer.x
        const dy = y - pointer.y
        const distance = dx * dx + dy * dy
        if (distance >= lightReach) return 0
        const falloff = 1 - Math.sqrt(distance) / lightRadius
        return falloff * falloff * 0.36
    }

    skyValue.set(skyBase)
    drawThreads(scene, skyValue, time)

    for (let y = 0; y < horizon; y++) {
        const row = y * width
        for (let x = 0; x < width; x++) {
            const index = row + x
            const value = (skyValue[index] + glowAt(x, y)) * (1 - quiet[index])
            skyValue[index] = value
            const landKind = land[index]
            if (landKind === LAND_NEAR) words[index] = palette.nearLand
            else if (landKind === LAND_FAR) words[index] = palette.farLand
            else {
                const dither = BAYER[(y & 7) * 8 + (x & 7)]
                words[index] = ramp[clamp(Math.floor(value * top + dither), 0, top)]
            }
        }
    }

    const waterHeight = height - horizon
    for (let y = horizon; y < height; y++) {
        const row = y * width
        const depth = (y - horizon) / waterHeight
        const sourceY = Math.max(0, horizon - 1 - Math.floor((y - horizon) * 1.5))
        const sourceRow = sourceY * width
        const wobble = Math.sin(y * 0.6 + time * 1.5) * (0.6 + depth * 3)
        const streakRow = (y % STREAK_ROWS) * STREAK_WIDTH
        const flow = time * (y % 2 === 0 ? 5 : -3.5) * (0.5 + depth)
        const stretch = 0.9 / (0.5 + depth * 1.6)
        const glitterWidth = 3 + depth * width * 0.09
        const dissolveAt = 0.7

        for (let x = 0; x < width; x++) {
            const index = row + x
            const dither = BAYER[(y & 7) * 8 + (x & 7)]

            // Jagged bottom edge that crumbles into the page.
            const fade = (depth - dissolveAt - edge[x] * 0.12) / 0.16
            if (fade > dither) {
                words[index] = palette.backdrop
                continue
            }

            const streak =
                streaks[
                    streakRow +
                        (((Math.floor(x * stretch + flow) % STREAK_WIDTH) + STREAK_WIDTH) %
                            STREAK_WIDTH)
                ]
            let rippleBoost = 0
            let rippleShift = 0
            for (const ripple of ripples) {
                const dx = x - ripple.x
                const dy = (y - ripple.y) * 2.6
                const ring = Math.abs(Math.hypot(dx, dy) - ripple.age * 26)
                if (ring < 2.2) {
                    const fading = (1 - ripple.age / 2.4) * ripple.strength
                    rippleBoost += (1 - ring / 2.2) * 0.55 * fading
                    rippleShift += dx > 0 ? 2 * fading : -2 * fading
                }
            }

            const sourceX = clamp(Math.round(x + wobble + rippleShift), 0, width - 1)
            const source = sourceRow + sourceX
            const landKind = land[source]
            if (landKind !== LAND_NONE && streak > 0.34 + depth * 1.1) {
                words[index] = landKind === LAND_NEAR ? palette.farLand : ramp[1]
                continue
            }

            let value =
                0.1 +
                (1 - depth) ** 2 * 0.2 +
                skyValue[source] * 0.45 +
                (streak - 0.5) * (0.42 + depth * 0.2) +
                rippleBoost +
                glowAt(x, y)

            const fromMoon = Math.abs(x - moon.x)
            if (fromMoon < glitterWidth) {
                const path = 1 - fromMoon / glitterWidth
                if (streak > 0.68 - path * 0.3) value += 0.55 * path + 0.2
            }

            words[index] = ramp[clamp(Math.floor(value * top + dither), 0, top)]
        }
    }

    const plot = (x: number, y: number, color: number) => {
        if (x >= 0 && x < width && y >= 0 && y < height) words[y * width + x] = color
    }

    const stamp = (sprite: string[], left: number, top: number, colors: Record<string, number>) => {
        for (let dy = 0; dy < sprite.length; dy++) {
            for (let dx = 0; dx < sprite[dy].length; dx++) {
                const color = colors[sprite[dy][dx]]
                if (color !== undefined) plot(left + dx, top + dy, color)
            }
        }
    }

    const lanternColors = {
        L: palette.lantern,
        W: palette.lanternCore,
        d: palette.lanternFrame
    }
    for (const lantern of scene.lanterns) {
        const sprite = lantern.large ? LANTERN_LARGE : LANTERN_SMALL
        const half = (sprite[0].length - 1) / 2
        const x = Math.round(lantern.x)
        const y = Math.round(lantern.y + Math.sin(time * 1.4 + lantern.bob) * 0.7)

        // Light breaks into dashes on the water under each lantern.
        const dashes = lantern.large ? [3, 2, 2, 1] : [2, 1]
        dashes.forEach((reach, row) => {
            const sway = Math.round(Math.sin(time * 2.4 + row * 1.3 + lantern.bob))
            for (let dx = -reach; dx <= reach; dx++) {
                plot(x + dx + sway, y + 1 + row * 2, palette.lanternGlow)
            }
        })
        stamp(sprite, x - half, y - sprite.length + 1, lanternColors)
    }

    const mothColors = { "#": palette.moth, o: palette.mothBody }
    for (const moth of scene.moths) {
        const sprite = Math.sin(time * 16 + moth.flap) > 0 ? MOTH_WINGS_UP : MOTH_WINGS_DOWN
        stamp(sprite, Math.round(moth.x) - 3, Math.round(moth.y) - 2, mothColors)
    }
}
