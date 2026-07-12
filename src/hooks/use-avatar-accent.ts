import { useEffect, useState } from "react"

const FALLBACK_ACCENT = "var(--primary)"
const SAMPLE_SIZE = 32

type ColorBucket = {
    red: number
    green: number
    blue: number
    count: number
    saturation: number
}

const rgbToHsl = (red: number, green: number, blue: number) => {
    const r = red / 255
    const g = green / 255
    const b = blue / 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const delta = max - min
    const lightness = (max + min) / 2
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
    let hue = 0

    if (delta !== 0) {
        if (max === r) hue = 60 * (((g - b) / delta) % 6)
        else if (max === g) hue = 60 * ((b - r) / delta + 2)
        else hue = 60 * ((r - g) / delta + 4)
    }

    return {
        hue: hue < 0 ? hue + 360 : hue,
        saturation,
        lightness
    }
}

const isLikelySkinTone = (
    red: number,
    green: number,
    blue: number,
    hue: number,
    saturation: number
) => {
    // Hue alone would also reject amber clothing and scenery. YCbCr narrows the
    // filter to the chroma region typically occupied by a broad range of skin tones.
    const chromaBlue = 128 - 0.168736 * red - 0.331264 * green + 0.5 * blue
    const chromaRed = 128 + 0.5 * red - 0.418688 * green - 0.081312 * blue
    return (
        hue >= 4 &&
        hue <= 48 &&
        saturation >= 0.12 &&
        saturation <= 0.72 &&
        chromaBlue >= 76 &&
        chromaBlue <= 132 &&
        chromaRed >= 132 &&
        chromaRed <= 178 &&
        red > green &&
        green > blue
    )
}

const extractAccent = (image: HTMLImageElement) => {
    const canvas = document.createElement("canvas")
    canvas.width = SAMPLE_SIZE
    canvas.height = SAMPLE_SIZE
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) return FALLBACK_ACCENT

    context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
    const pixels = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data
    const buckets = new Map<string, ColorBucket>()

    for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3]
        if (alpha < 160) continue

        const red = pixels[index]
        const green = pixels[index + 1]
        const blue = pixels[index + 2]
        const { hue, saturation, lightness } = rgbToHsl(red, green, blue)
        if (lightness < 0.12 || lightness > 0.92 || saturation < 0.12) continue
        if (isLikelySkinTone(red, green, blue, hue, saturation)) continue

        const key = `${red >> 5}-${green >> 5}-${blue >> 5}`
        const bucket = buckets.get(key)
        if (bucket) {
            bucket.red += red
            bucket.green += green
            bucket.blue += blue
            bucket.count += 1
            bucket.saturation += saturation
        } else {
            buckets.set(key, { red, green, blue, count: 1, saturation })
        }
    }

    const winner = [...buckets.values()].sort((left, right) => {
        const leftScore = left.count * (0.5 + left.saturation / left.count) ** 2
        const rightScore = right.count * (0.5 + right.saturation / right.count) ** 2
        return rightScore - leftScore
    })[0]
    if (!winner) return FALLBACK_ACCENT

    const { hue, saturation } = rgbToHsl(
        winner.red / winner.count,
        winner.green / winner.count,
        winner.blue / winner.count
    )

    return `hsl(${Math.round(hue)} ${Math.round(Math.min(78, Math.max(48, saturation * 100)))}% 58%)`
}

export function useAvatarAccent(imageUrl?: string | null) {
    const [accent, setAccent] = useState(FALLBACK_ACCENT)

    useEffect(() => {
        setAccent(FALLBACK_ACCENT)
        if (!imageUrl) return

        let cancelled = false
        const image = new Image()
        image.crossOrigin = "anonymous"
        image.onload = () => {
            if (cancelled) return
            try {
                setAccent(extractAccent(image))
            } catch {
                setAccent(FALLBACK_ACCENT)
            }
        }
        image.onerror = () => {
            if (!cancelled) setAccent(FALLBACK_ACCENT)
        }
        image.src = imageUrl

        return () => {
            cancelled = true
        }
    }, [imageUrl])

    return accent
}
