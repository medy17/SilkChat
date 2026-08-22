// Generates web-optimized webp variants for the landing-page gallery.
// For each source image in public/gallery it writes two files into public/gallery/opt:
//   <base>.webp        grid thumbnail (<=700px wide)
//   <base>-full.webp   lightbox image (longest edge <=1800px)
// Re-run after adding new source images: `bun scripts/optimize-gallery.mjs`

import { mkdir, readdir, stat } from "node:fs/promises"
import path from "node:path"

const sourceDir = path.resolve("public/gallery")
const outDir = path.join(sourceDir, "opt")

await mkdir(outDir, { recursive: true })

const files = (await readdir(sourceDir)).filter((file) => /\.(png|jpe?g)$/i.test(file))

for (const file of files) {
    const base = file.replace(/\.(png|jpe?g)$/i, "")
    const input = path.join(sourceDir, file)
    const gridOut = path.join(outDir, `${base}.webp`)
    const fullOut = path.join(outDir, `${base}-full.webp`)

    const metadata = await Bun.file(input).image().metadata()
    await Bun.file(input)
        .image()
        .resize(Math.min(700, metadata.width))
        .webp({ quality: 78 })
        .write(gridOut)

    const fullScale = Math.min(1, 1800 / Math.max(metadata.width, metadata.height))
    await Bun.file(input)
        .image()
        .resize(Math.round(metadata.width * fullScale))
        .webp({ quality: 82 })
        .write(fullOut)

    const [{ size: gridSize }, { size: fullSize }] = await Promise.all([
        stat(gridOut),
        stat(fullOut)
    ])
    const kb = (bytes) => `${Math.round(bytes / 1024)}KB`
    console.log(`${base}: grid ${kb(gridSize)}, full ${kb(fullSize)}`)
}
