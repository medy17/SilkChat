// Builds the SilkChat app frame runtime (React, the @silk/ui kit, and the code transform)
// into public/silk-app/<version>/, next to the Tailwind browser compiler it loads after,
// plus the heavy modules apps load on demand. Runs before dev and build; the output is
// gitignored.
//
// The version is a content hash, so deployed files can be cached forever and an open tab
// never pairs its host with a newer runtime. With --dev it is "dev", so rebuilds land at
// the same URLs; Vite reads it from the directory name (scripts/silk-app-runtime-plugin.ts).

import { createHash } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { SILK_APP_CHUNKS } from "../src/silk-app-runtime/chunks.ts"

const root = process.cwd()
const outDir = path.join(root, "public/silk-app")
const runtimeDir = path.join(root, "src/silk-app-runtime")
const cacheDir = path.join(root, "node_modules/.cache/silk-app")
const dev = process.argv.includes("--dev")

const define = { "process.env.NODE_ENV": JSON.stringify("production") }

const assertBuilt = (result, label) => {
    if (result.success) return
    for (const log of result.logs) console.error(log)
    throw new Error(`Failed to build ${label}`)
}

// Chunks use the runtime's React instead of bundling a second copy.
const sharedReactPlugin = {
    name: "silk-app-shared-react",
    setup(build) {
        build.onResolve(
            { filter: /^(react|react-dom|react\/jsx-runtime|react\/jsx-dev-runtime)$/ },
            (args) => ({ path: args.path, namespace: "silk-app-shared" })
        )
        build.onLoad({ filter: /.*/, namespace: "silk-app-shared" }, (args) => {
            const key = args.path === "react/jsx-dev-runtime" ? "react/jsx-runtime" : args.path
            return {
                contents: `module.exports = globalThis.__SILK_APP_SHARED__[${JSON.stringify(key)}]`,
                loader: "js"
            }
        })
    }
}

const frameCssFiles = [
    path.join(runtimeDir, "frame.css"),
    path.join(root, "node_modules/tw-animate-css/dist/tw-animate.css")
]
const frameCss = (await Promise.all(frameCssFiles.map((file) => readFile(file, "utf8")))).join("\n")

await mkdir(cacheDir, { recursive: true })

const runtime = await Bun.build({
    entrypoints: [path.join(runtimeDir, "entry.tsx")],
    target: "browser",
    format: "iife",
    minify: true,
    metafile: true,
    define: { ...define, __SILK_APP_FRAME_CSS__: JSON.stringify(frameCss) }
})
assertBuilt(runtime, "the SilkChat app runtime")

// Each chunk registers the modules it provides under their registry keys.
const chunkEntries = await Promise.all(
    Object.entries(SILK_APP_CHUNKS).map(async ([name, chunk]) => {
        const entry = path.join(cacheDir, "chunks", `${name}.js`)
        const registrations = Object.entries(chunk.provides).map(
            ([key, binding]) =>
                `globalThis.__SILK_APP_CHUNKS__[${JSON.stringify(key)}] = ${binding}`
        )
        await mkdir(path.dirname(entry), { recursive: true })
        await writeFile(entry, `${[...chunk.imports, ...registrations].join("\n")}\n`)
        return entry
    })
)

const chunks = await Bun.build({
    entrypoints: chunkEntries,
    naming: "[name].js",
    target: "browser",
    format: "iife",
    minify: true,
    define,
    plugins: [sharedReactPlugin]
})
assertBuilt(chunks, "SilkChat app chunks")

const files = new Map([
    ["runtime.js", await runtime.outputs[0].text()],
    [
        "tailwind.js",
        await readFile(
            path.join(root, "node_modules/@tailwindcss/browser/dist/index.global.js"),
            "utf8"
        )
    ],
    ...(await Promise.all(
        chunks.outputs.map(async (output) => [
            `chunks/${path.basename(output.path)}`,
            await output.text()
        ])
    ))
])

const hash = createHash("sha256")
for (const [name, contents] of [...files].sort(([left], [right]) => left.localeCompare(right))) {
    hash.update(name).update("\0").update(contents).update("\0")
}
const version = dev ? "dev" : hash.digest("hex").slice(0, 12)

await rm(outDir, { recursive: true, force: true })
for (const [name, contents] of files) {
    const file = path.join(outDir, version, name)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, contents)
}

// Source files the runtime is built from, so the dev server can rebuild when one changes.
const inputs = Object.keys(runtime.metafile.inputs)
    .map((input) => path.resolve(root, input))
    .filter((input) => !input.includes(`${path.sep}node_modules${path.sep}`))
    .concat(frameCssFiles.slice(0, 1))
await writeFile(path.join(cacheDir, "inputs.json"), JSON.stringify(inputs))

const kb = (name) => `${Math.round(Buffer.byteLength(files.get(name)) / 1024)} KB`
console.log(
    `Built SilkChat app runtime ${version}: runtime.js ${kb("runtime.js")}, ${Object.keys(
        SILK_APP_CHUNKS
    )
        .map((name) => `${name} ${kb(`chunks/${name}.js`)}`)
        .join(", ")}`
)
