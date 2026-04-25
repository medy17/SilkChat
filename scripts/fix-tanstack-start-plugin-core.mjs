import fs from "node:fs/promises"
import path from "node:path"

const root = path.resolve(process.cwd(), "node_modules/@tanstack/start-plugin-core/dist/esm")

const from = 'from "@babel/types";'
const to = 'from "@babel/types/lib/index.js";'

const walk = async (dir) => {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const files = await Promise.all(
        entries.map(async (entry) => {
            const fullPath = path.join(dir, entry.name)
            if (entry.isDirectory()) {
                return walk(fullPath)
            }
            return entry.isFile() && entry.name.endsWith(".js") ? [fullPath] : []
        })
    )

    return files.flat()
}

try {
    const files = await walk(root)

    for (const file of files) {
        const source = await fs.readFile(file, "utf8")
        if (!source.includes(from) || source.includes(to)) {
            continue
        }

        await fs.writeFile(file, source.replaceAll(from, to))
    }
} catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        console.warn("[postinstall] @tanstack/start-plugin-core dist/esm not found; skipping patch")
    } else {
        throw error
    }
}
