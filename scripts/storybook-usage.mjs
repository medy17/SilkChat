import { readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true })
    return (
        await Promise.all(
            entries.map((entry) =>
                entry.isDirectory() ? walk(path.join(dir, entry.name)) : path.join(dir, entry.name)
            )
        )
    ).flat()
}
const sources = await Promise.all(
    (await walk(path.join(root, "src")))
        .filter(
            (file) =>
                /\.tsx?$/.test(file) &&
                !file.includes(".stories.") &&
                !file.endsWith("routeTree.gen.ts")
        )
        .map(async (file) => ({ file, text: await readFile(file, "utf8") }))
)
const components = sources.filter(
    ({ file }) => file.includes(`${path.sep}components${path.sep}`) && file.endsWith(".tsx")
)
const usage = {}
for (const { file } of components) {
    const key = path
        .relative(path.join(root, "src/components"), file)
        .replaceAll("\\", "/")
        .replace(/\.tsx$/, "")
    const consumers = []
    for (const source of sources) {
        if (source.file === file) continue
        for (const match of source.text.matchAll(
            /(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g
        )) {
            const specifier = match[1]
            const resolved = specifier.startsWith("@/")
                ? path.join(root, "src", specifier.slice(2))
                : specifier.startsWith(".")
                  ? path.resolve(path.dirname(source.file), specifier)
                  : ""
            if (resolved === file.slice(0, -4)) {
                consumers.push(path.relative(root, source.file).replaceAll("\\", "/"))
                break
            }
        }
    }
    usage[key] = consumers
}
await writeFile(path.join(root, ".storybook/usage.json"), `${JSON.stringify(usage, null, 2)}\n`)
console.log(`Indexed call sites for ${components.length} component modules.`)
const stories = new Set(
    (await walk(path.join(root, "stories/components")))
        .filter((file) => file.endsWith(".stories.tsx"))
        .map((file) =>
            path
                .relative(path.join(root, "stories/components"), file)
                .replaceAll("\\", "/")
                .replace(/\.stories\.tsx$/, "")
        )
)
const exclusions = JSON.parse(
    await readFile(path.join(root, ".storybook/story-exclusions.json"), "utf8")
)
const missing = Object.keys(usage).filter((key) => !stories.has(key) && !exclusions[key])
console.log(
    `${stories.size} story modules; ${Object.keys(exclusions).length} documented nonvisual exclusions.`
)
if (missing.length) {
    console.error(`Missing stories: ${missing.join(", ")}`)
    process.exitCode = 1
}
