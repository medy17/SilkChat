export type RGB = readonly [number, number, number]

export type GalaxyPalette = {
    foreground: RGB
    accent: RGB
    background: RGB
    isDark: boolean
}

export const rgba = ([r, g, b]: RGB, alpha: number) => `rgba(${r},${g},${b},${alpha})`

export const mixRgba = (from: RGB, to: RGB, amount: number, alpha: number) =>
    `rgba(${from[0] + (to[0] - from[0]) * amount},${from[1] + (to[1] - from[1]) * amount},${
        from[2] + (to[2] - from[2]) * amount
    },${alpha})`

const FALLBACK: GalaxyPalette = {
    foreground: [10, 10, 10],
    accent: [10, 10, 10],
    background: [255, 255, 255],
    isDark: false
}

const ACCENT_TOKENS = ["--primary", "--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"]

const isChromatic = ([r, g, b]: RGB) => Math.max(r, g, b) - Math.min(r, g, b) >= 40

// Theme tokens can be any CSS color (oklch included), so let a 1×1 canvas resolve them.
export const readGalaxyPalette = (element: Element): GalaxyPalette => {
    const probe = document.createElement("canvas")
    probe.width = 1
    probe.height = 1
    const context = probe.getContext("2d", { willReadFrequently: true })
    const style = getComputedStyle(element)

    const read = (name: string, fallback: RGB): RGB => {
        const value = style.getPropertyValue(name).trim()
        if (!value || !context) return fallback
        context.clearRect(0, 0, 1, 1)
        context.fillStyle = rgba(fallback, 1)
        context.fillStyle = value
        context.fillRect(0, 0, 1, 1)
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data
        return [r ?? 0, g ?? 0, b ?? 0]
    }

    const foreground = read("--foreground", FALLBACK.foreground)
    // The highlight needs a hue. Monochrome themes set --primary to the foreground, so
    // fall through to the chart palette until a token carries colour.
    const accent =
        ACCENT_TOKENS.map((name) => read(name, foreground)).find(isChromatic) ?? foreground

    return {
        foreground,
        accent,
        background: read("--background", FALLBACK.background),
        isDark: document.documentElement.classList.contains("dark")
    }
}
