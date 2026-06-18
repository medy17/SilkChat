// Generates web-optimized webp variants for the landing-page gallery.
// For each source image in public/gallery it writes two files into public/gallery/opt:
//   <base>.webp        grid thumbnail (<=700px wide)
//   <base>-full.webp   lightbox image (longest edge <=1800px)
// Re-run after adding new source images: `node scripts/optimize-gallery.mjs`

import { mkdir, readdir, stat } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const sourceDir = path.resolve("public/gallery")
const outDir = path.join(sourceDir, "opt")

await mkdir(outDir, { recursive: true })

const files = (await readdir(sourceDir)).filter((file) => /\.(png|jpe?g)$/i.test(file))

for (const file of files) {
    const base = file.replace(/\.(png|jpe?g)$/i, "")
    const input = path.join(sourceDir, file)
    const gridOut = path.join(outDir, `${base}.webp`)
    const fullOut = path.join(outDir, `${base}-full.webp`)

    await sharp(input)
        .resize({ width: 700, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(gridOut)

    await sharp(input)
        .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(fullOut)

    const [{ size: gridSize }, { size: fullSize }] = await Promise.all([
        stat(gridOut),
        stat(fullOut)
    ])
    const kb = (bytes) => `${Math.round(bytes / 1024)}KB`
    console.log(`${base}: grid ${kb(gridSize)}, full ${kb(fullSize)}`)
}
