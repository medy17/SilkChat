import {
    LAB_LOGO_SIZE,
    SHUTTLE_LOGO_SIZE,
    labLogos,
    shuttleLogos
} from "@/components/landing-page/pixel-logos"
import {
    BAYER,
    MOTH_WINGS_DOWN,
    MOTH_WINGS_UP,
    type Palette
} from "@/components/landing-page/pixel-scene"

// Four small scenes from the hero's world, one per card. Like the lake they only
// fill a pixel buffer, so the caller owns the canvas and the clock.

export type CardFrame = {
    words: Uint32Array
    width: number
    height: number
    time: number
    palette: Palette
}

export type CardPainter = (frame: CardFrame) => void

const dither = (x: number, y: number) => BAYER[(y & 7) * 8 + (x & 7)]

function hash(x: number, y: number) {
    let value = Math.imul(x, 374761393) + Math.imul(y, 668265263)
    value = Math.imul(value ^ (value >>> 13), 1274126177)
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}

function decodeLogo(hex: string, size: number) {
    const stride = Math.ceil(size / 4)
    const bits = new Uint8Array(size * size)
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const nibble = Number.parseInt(hex[y * stride + (x >> 2)], 16)
            bits[y * size + x] = (nibble >> (3 - (x & 3))) & 1
        }
    }
    return bits
}

const labBits = labLogos.map((logo) => decodeLogo(logo, LAB_LOGO_SIZE))
const shuttleBits = shuttleLogos.map((logo) => decodeLogo(logo, SHUTTLE_LOGO_SIZE))

const rampColor = ({ palette }: CardFrame, x: number, y: number, value: number) => {
    const { ramp } = palette
    const top = ramp.length - 1
    return ramp[Math.min(top, Math.max(0, Math.floor(value * top + dither(x, y))))]
}

function plot({ words, width, height }: CardFrame, x: number, y: number, color: number) {
    if (x >= 0 && x < width && y >= 0 && y < height) words[y * width + x] = color
}

// The scenes have no frame. Like the lake, they crumble into the page: this marks
// which pixels survive, in chunky two-pixel blocks along a rounded, ragged edge.
export function createEdgeMask(width: number, height: number) {
    const mask = new Uint8Array(width * height)
    const margin = Math.max(4, height * 0.15)
    const corner = height * 0.26
    const halfWidth = width / 2
    const halfHeight = height / 2

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const blockX = x >> 1
            const blockY = y >> 1
            const fromCenterX = Math.abs(blockX * 2 + 1 - halfWidth) - (halfWidth - corner)
            const fromCenterY = Math.abs(blockY * 2 + 1 - halfHeight) - (halfHeight - corner)
            const outside = Math.hypot(Math.max(fromCenterX, 0), Math.max(fromCenterY, 0))
            const inside = Math.min(Math.max(fromCenterX, fromCenterY), 0)
            const depth = corner - outside - inside
            const ragged = (hash(blockX, blockY) - 0.5) * margin * 0.9
            mask[y * width + x] = (depth + ragged) / margin > dither(blockX, blockY) ? 1 : 0
        }
    }
    return mask
}

// The hero's night: dark at the top, lifting toward the horizon, a few stars.
function paintSky(frame: CardFrame, lift = 0.3) {
    const { width, height, time, words, palette } = frame
    for (let y = 0; y < height; y++) {
        const value = (y / height) ** 1.6 * lift
        for (let x = 0; x < width; x++) {
            words[y * width + x] = rampColor(frame, x, y, value)
            if (hash(x, y) > 0.993) {
                const twinkle = Math.sin(time * 2 + hash(y, x) * 9)
                if (twinkle > -0.3) words[y * width + x] = palette.ramp[twinkle > 0.5 ? 5 : 3]
            }
        }
    }
}

// Every lab, one at a time: a logo hangs over the water like a moon and dissolves
// into the next through the dither.
export function createLabsPainter(): CardPainter {
    const hold = 1.7
    const stride = 5

    return (frame) => {
        const { width, height, time, palette } = frame
        const size = LAB_LOGO_SIZE
        const beat = Math.floor(time / hold)
        const phase = (time % hold) / hold
        const morph = Math.min(1, Math.max(0, (phase - 0.55) / 0.4))
        const from = labBits[(beat * stride) % labBits.length]
        const to = labBits[((beat + 1) * stride) % labBits.length]

        const left = Math.round((width - size) / 2)
        const top = Math.max(4, Math.floor((height - size - 11) / 2))
        const horizon = Math.min(height - 5, top + size + 2)
        const centerX = left + size / 2
        const centerY = top + size / 2

        const logoAt = (x: number, y: number) => {
            const localX = x - left
            const localY = y - top
            if (localX < 0 || localY < 0 || localX >= size || localY >= size) return false
            const shown = dither(x, y) < morph ? to : from
            return shown[localY * size + localX] === 1
        }

        paintSky(frame)
        for (let y = 0; y < horizon; y++) {
            for (let x = 0; x < width; x++) {
                const distance = Math.hypot(x - centerX, y - centerY)
                const glow = 0.46 * Math.exp(-Math.max(0, distance - size * 0.42) / (size * 0.2))
                if (glow > 0.02) {
                    const sky = (y / height) ** 1.6 * 0.3
                    plot(frame, x, y, rampColor(frame, x, y, sky + glow))
                }
                if (logoAt(x, y)) plot(frame, x, y, palette.moth)
            }
        }

        for (let y = horizon; y < height; y++) {
            const depth = (y - horizon) / Math.max(1, height - horizon)
            const sourceY = horizon - 1 - Math.floor((y - horizon) * 1.6)
            const sway = Math.sin(y * 0.9 + time * 3) * (0.6 + depth * 2)
            for (let x = 0; x < width; x++) {
                const streak = hash(Math.floor((x + time * (y % 2 ? 7 : -5)) / 7), y)
                const lit = logoAt(Math.round(x + sway), sourceY) && streak > 0.22
                const value = lit ? 0.72 : 0.12 + (1 - depth) * 0.12 + streak * 0.3
                plot(frame, x, y, rampColor(frame, x, y, value))
            }
        }
    }
}

// Each model's band has its own weave: checks, twill, and diamonds.
const weaves = [
    (x: number, row: number) => (x + row * 2) % 4 < 2,
    (x: number, row: number) => (x + row) % 6 < 3,
    (x: number, row: number) => Math.abs((x % 8) - 4) + Math.abs((row % 8) - 4) < 4
]

// A loom. Each model weaves its own band into one continuous cloth.
export function createWeavePainter(): CardPainter {
    const rowsPerSecond = 2.6
    const bandRows = 8
    const headStart = 40

    return (frame) => {
        const { width, height, time, palette } = frame
        const { ramp } = palette
        const bands = [
            [palette.moth, ramp[3]],
            [palette.farLand, ramp[3]],
            [palette.lantern, palette.lanternGlow]
        ]
        const edge = 4
        const fell = height - SHUTTLE_LOGO_SIZE - 7
        const woven = headStart + time * rowsPerSecond
        const row = Math.floor(woven)
        const pass = woven - row
        const forward = row % 2 === 0
        const span = width - edge * 2

        paintSky(frame, 0.16)

        // Warp threads run down from the cloth to the beam.
        for (let x = edge; x < width - edge; x += 3) {
            for (let y = fell; y < height; y++) plot(frame, x, y, ramp[2])
        }

        const bandOf = (index: number) => Math.floor(index / bandRows) % bands.length
        const shuttleX = edge + span * (forward ? pass : 1 - pass)

        for (let y = 0; y <= fell; y++) {
            const index = row - (fell - y)
            if (index < 0) continue
            const band = bandOf(index)
            const [bright, dim] = bands[band]
            for (let x = edge; x < width - edge; x++) {
                const unwoven = y === fell && (forward ? x > shuttleX : x < shuttleX)
                if (unwoven) continue
                plot(frame, x, y, weaves[band](x, index) ? bright : dim)
            }
        }

        const logo = shuttleBits[bandOf(row)]
        const size = SHUTTLE_LOGO_SIZE
        const logoLeft = Math.round(
            Math.min(width - edge - size, Math.max(edge, shuttleX - size / 2))
        )
        const logoTop = fell + 2
        const logoOn = (x: number, y: number) =>
            x >= 0 && y >= 0 && x < size && y < size && logo[y * size + x] === 1
        for (let y = -1; y <= size; y++) {
            for (let x = -1; x <= size; x++) {
                if (logoOn(x, y)) plot(frame, logoLeft + x, logoTop + y, palette.moth)
                else if (
                    logoOn(x - 1, y) ||
                    logoOn(x + 1, y) ||
                    logoOn(x, y - 1) ||
                    logoOn(x, y + 1)
                ) {
                    plot(frame, logoLeft + x, logoTop + y, ramp[0])
                }
            }
        }
    }
}

// The code types itself out, then runs: a real Game of Life, trails and all.
export function createLifePainter(): CardPainter {
    const cell = 2
    const cycle = 9
    const typing = 1.8
    const generationsPerSecond = 7
    const trail = 5
    const inset = 6

    let columns = 0
    let rows = 0
    let ages = new Uint8Array(0)
    let next = new Uint8Array(0)
    let round = -1
    let generation = 0

    const seed = () => {
        ages.fill(0)
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < columns; x++) {
                if (hash(x + round * 31, y + round * 17) > 0.68) ages[y * columns + x] = 1
            }
        }
    }

    const advance = () => {
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < columns; x++) {
                let neighbours = 0
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue
                        const nx = (x + dx + columns) % columns
                        const ny = (y + dy + rows) % rows
                        if (ages[ny * columns + nx] === 1) neighbours++
                    }
                }
                const index = y * columns + x
                const age = ages[index]
                const alive = age === 1
                if (neighbours === 3 || (alive && neighbours === 2)) next[index] = 1
                else next[index] = age === 0 || age >= trail ? 0 : age + 1
            }
        }
        ;[ages, next] = [next, ages]
    }

    return (frame) => {
        const { width, height, time, palette } = frame
        const { ramp } = palette
        const codeWidth = Math.floor(width * 0.34)
        const simLeft = inset + codeWidth
        const nextColumns = Math.floor((width - simLeft - inset) / cell)
        const nextRows = Math.floor((height - inset * 2) / cell)
        if (nextColumns !== columns || nextRows !== rows) {
            columns = nextColumns
            rows = nextRows
            ages = new Uint8Array(columns * rows)
            next = new Uint8Array(columns * rows)
            round = -1
        }

        const nextRound = Math.floor(time / cycle)
        const clock = time % cycle
        if (nextRound !== round) {
            round = nextRound
            generation = 0
            seed()
        }
        const target = Math.max(0, Math.floor((clock - typing) * generationsPerSecond))
        while (generation < target) {
            advance()
            generation++
        }

        paintSky(frame, 0.1)

        // Code column: lines write themselves, indented like the real thing.
        const lineCount = Math.floor((height - inset * 2) / 4)
        const typed = Math.min(1, clock / typing) * lineCount
        for (let line = 0; line < lineCount; line++) {
            const indent = [0, 3, 6, 6, 3, 0][line % 6]
            const length = 4 + Math.floor(hash(line, 3) * (codeWidth - 10))
            const shown = Math.min(1, Math.max(0, typed - line)) * length
            const color =
                line % 3 === 0 ? palette.lantern : line % 3 === 1 ? palette.moth : palette.farLand
            const y = inset + line * 4
            for (let x = 0; x < shown; x++) {
                plot(frame, inset + indent + x, y, color)
                plot(frame, inset + indent + x, y + 1, color)
            }
        }

        if (clock < typing) {
            const blink = Math.floor(time * 4) % 2 === 0
            const line = Math.min(lineCount - 1, Math.floor(typed))
            if (blink) plot(frame, inset, inset + line * 4, palette.moth)
            return
        }

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < columns; x++) {
                const age = ages[y * columns + x]
                if (age === 0) continue
                const color = age === 1 ? palette.moth : ramp[Math.max(1, 5 - age)]
                for (let dy = 0; dy < cell; dy++) {
                    for (let dx = 0; dx < cell; dx++) {
                        plot(frame, simLeft + x * cell + dx, inset + y * cell + dy, color)
                    }
                }
            }
        }
    }
}

const KEY = [
    "..LLL..",
    ".LWWWL.",
    "LW...WL",
    ".LWWWL.",
    "..LLL..",
    "...L...",
    "...W...",
    "...L...",
    "...W...",
    "...LL..",
    "...W...",
    "...LLL.",
    "...L..."
]

// A gold key hangs from a mulberry branch. Silk winds around it into a cocoon,
// holds, and lets go again.
export function createCocoonPainter(): CardPainter {
    const cycle = 7.5

    return (frame) => {
        const { width, height, time, palette } = frame
        const { ramp } = palette
        const clock = time % cycle
        const wound =
            clock < 1.2
                ? 0
                : clock < 3.2
                  ? (clock - 1.2) / 2
                  : clock < 5.6
                    ? 1
                    : clock < 6.8
                      ? 1 - (clock - 5.6) / 1.2
                      : 0

        const branchY = 7
        const radiusY = Math.floor(height * 0.28)
        const radiusX = Math.round(radiusY * 0.74)
        const centerY = branchY + 4 + radiusY
        const sway = Math.sin(time * 0.9) * 1.6
        const centerX = Math.round(width / 2 + sway)

        paintSky(frame)

        // Branch and leaves.
        for (let x = 0; x < width; x++) {
            const y = branchY + Math.round(Math.sin(x * 0.11) * 1.2)
            plot(frame, x, y, palette.nearLand)
            plot(frame, x, y - 1, palette.nearLand)
            if (hash(Math.floor(x / 5), 7) > 0.5) {
                const leaf = hash(Math.floor(x / 5), 9) > 0.5 ? 1 : 2
                for (let dy = 1; dy <= leaf + 1; dy++) plot(frame, x, y + dy, palette.nearLand)
            }
        }

        // The thread it hangs from.
        for (let y = branchY; y < centerY - radiusY + 1; y++) {
            const lean = (sway * (y - branchY)) / Math.max(1, centerY - branchY)
            plot(frame, Math.round(width / 2 + lean), y, ramp[5])
        }

        // The key, hanging from its bow.
        const keyLeft = centerX - 3
        const keyTop = centerY - Math.floor(KEY.length / 2)
        KEY.forEach((line, dy) => {
            for (let dx = 0; dx < line.length; dx++) {
                if (line[dx] === "L") plot(frame, keyLeft + dx, keyTop + dy, palette.lantern)
                if (line[dx] === "W") plot(frame, keyLeft + dx, keyTop + dy, palette.lanternCore)
            }
        })

        // Silk winds up from the bottom, row by row, lit from the moon's side.
        const windTop = centerY + radiusY - wound * (radiusY * 2 + 1)
        for (let y = centerY - radiusY; y <= centerY + radiusY; y++) {
            if (y < windTop) continue
            const across = (y - centerY) / radiusY
            const half = Math.round(radiusX * Math.sqrt(Math.max(0, 1 - across * across)))
            for (let x = centerX - half; x <= centerX + half; x++) {
                const lit = 1 - (x - centerX + half) / Math.max(1, half * 2)
                const strand = (y * 2 + x + Math.round(across * 3)) % 5 === 0 ? 0.16 : 0
                const value = 0.34 + (1 - lit) * 0.58 - strand
                const isEdge = x === centerX - half || x === centerX + half
                plot(frame, x, y, isEdge ? palette.farLand : rampColor(frame, x, y, value))
            }
            if (y === Math.ceil(windTop)) {
                plot(frame, centerX - half - 1, y, ramp[6])
                plot(frame, centerX + half + 1, y, ramp[6])
            }
        }

        // One moth keeps it company.
        const mothX = Math.round(centerX + Math.cos(time * 0.8) * (radiusX + 10))
        const mothY = Math.round(centerY - 2 + Math.sin(time * 1.3) * radiusY * 0.6)
        const sprite = Math.sin(time * 16) > 0 ? MOTH_WINGS_UP : MOTH_WINGS_DOWN
        sprite.forEach((line, dy) => {
            for (let dx = 0; dx < line.length; dx++) {
                if (line[dx] === "#") plot(frame, mothX - 3 + dx, mothY - 2 + dy, palette.moth)
                if (line[dx] === "o") plot(frame, mothX - 3 + dx, mothY - 2 + dy, palette.mothBody)
            }
        })
    }
}
