import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import {
    SHURIKEN_BORDER_PATH,
    SHURIKEN_BUBBLE_VIEWBOX,
    SHURIKEN_CORE_SCALE,
    SHURIKEN_TAIL_PATH
} from "../src/lib/shuriken-bubble-geometry"

// Run with bun scripts/generate-brand-assets.ts. The AI-generated dev logo is kept separately.
const root = new URL("../", import.meta.url)
const file = (path: string) => fileURLToPath(new URL(path, root))
const core = await readFile(file("src/assets/shuriken.svg"), "utf8")
const blades = core.slice(core.indexOf(">") + 1, core.lastIndexOf("</svg>"))
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SHURIKEN_BUBBLE_VIEWBOX}" fill="currentColor">
  <path d="${SHURIKEN_BORDER_PATH}" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" />
  <g transform="translate(0 -5) scale(${SHURIKEN_CORE_SCALE})">${blades}  </g>
  <path d="${SHURIKEN_TAIL_PATH}" />
</svg>
`
await writeFile(file("src/logo.svg"), svg)

function smallIconSvg(size: number) {
    // Optical weights for tiny raster sizes, independent of the full-size brand artwork.
    const borderWidth = size <= 16 ? 36 : size <= 32 ? 32 : 28
    const bladeWidth = size <= 16 ? 16 : 12
    return svg
        .replace('stroke-width="18"', `stroke-width="${borderWidth}"`)
        .replace(
            "<g transform=",
            `<g stroke="currentColor" stroke-width="${bladeWidth}" stroke-linejoin="round" transform=`
        )
        .replace(
            `<path d="${SHURIKEN_TAIL_PATH}"`,
            `<path stroke="currentColor" stroke-width="${borderWidth - 18}" stroke-linejoin="round" d="${SHURIKEN_TAIL_PATH}"`
        )
}

async function mark(size: number, color = "#1f1f1f", artwork = svg) {
    const source = artwork
        .replace("<svg ", `<svg width="${size}" height="${size}" `)
        .replaceAll("currentColor", color)
    return sharp(Buffer.from(source)).png().toBuffer()
}

async function icon(
    size: number,
    fraction: number,
    optical = false,
    rounded = false,
    artwork = optical ? smallIconSvg(size) : svg
) {
    const renderSize = size <= 256 ? size * 4 : size
    const inner = Math.round(renderSize * fraction)
    // Favicons need their own rounded white tile. Installed app icons are masked by the OS.
    const background = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${renderSize}" height="${renderSize}"><rect width="100%" height="100%" rx="${rounded ? renderSize * 0.22 : 0}" fill="white" /></svg>`
    )
    const composed = await sharp(background)
        .composite([{ input: await mark(inner, "#1f1f1f", artwork), gravity: "centre" }])
        .png()
        .toBuffer()
    return sharp(composed).resize(size, size).png().toBuffer()
}

await writeFile(file("public/apple-icon-180.png"), await icon(180, 0.84, true))
// The entire mark, including the tail, fits inside the maskable icon's 40%-radius safe circle.
for (const size of [192, 512]) {
    await writeFile(file(`public/manifest-icon-${size}.maskable.png`), await icon(size, 0.6, true))
}
await writeFile(file("public/logo-highres.png"), await icon(4000, 0.9))

// ICO supports embedded PNGs; provide native sizes instead of one downscaled 256px image.
const sizes = [16, 24, 32, 48, 64, 128, 256]
const images = await Promise.all(
    sizes.map((size) => {
        const favicon = core
            .replace('viewBox="-128 -128 256 256"', 'viewBox="-140 -140 280 280"')
            .replace(
                'fill="currentColor"',
                `fill="currentColor" stroke="currentColor" stroke-width="${size <= 16 ? 16 : 12}" stroke-linejoin="round"`
            )
        return icon(size, 0.96, false, true, favicon)
    })
)
const header = Buffer.alloc(6 + sizes.length * 16)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = header.length
images.forEach((image, index) => {
    const entry = 6 + index * 16
    header[entry] = sizes[index] === 256 ? 0 : sizes[index]
    header[entry + 1] = header[entry]
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(image.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += image.length
})
await writeFile(file("public/favicon.ico"), Buffer.concat([header, ...images]))

// Preserve the existing wordmark and tagline from the original social artwork.
const social = await sharp({
    create: { width: 4800, height: 2520, channels: 3, background: "#f5f2ed" }
})
    .composite([
        { input: file("assets/brand/social-wordmark.png"), left: 2700, top: 0 },
        { input: await mark(2200, "#000000"), left: 310, top: 260 }
    ])
    .png()
    .toBuffer()
await sharp(social)
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toFile(file("public/opengraph_highres.jpg"))
await sharp(social)
    .resize(1200, 630)
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toFile(file("public/opengraph.jpg"))
console.log("Generated the static SVG, favicon sizes, app icons, email logo, and social images.")
