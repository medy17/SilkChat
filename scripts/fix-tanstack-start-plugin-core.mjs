import fs from "node:fs/promises"
import path from "node:path"

const files = [
    "node_modules/@tanstack/start-plugin-core/dist/esm/import-protection-plugin/postCompileUsage.js",
    "node_modules/@tanstack/start-plugin-core/dist/esm/import-protection-plugin/rewriteDeniedImports.js",
    "node_modules/@tanstack/start-plugin-core/dist/esm/start-compiler-plugin/compiler.js",
    "node_modules/@tanstack/start-plugin-core/dist/esm/start-compiler-plugin/handleCreateIsomorphicFn.js",
    "node_modules/@tanstack/start-plugin-core/dist/esm/start-compiler-plugin/handleCreateServerFn.js",
    "node_modules/@tanstack/start-plugin-core/dist/esm/start-compiler-plugin/handleEnvOnly.js",
    "node_modules/@tanstack/start-plugin-core/dist/esm/start-compiler-plugin/utils.js"
]

const from = 'from "@babel/types";'
const to = 'from "@babel/types/lib/index.js";'

for (const relativeFile of files) {
    const file = path.resolve(process.cwd(), relativeFile)
    const source = await fs.readFile(file, "utf8")

    if (source.includes(to)) {
        continue
    }

    if (!source.includes(from)) {
        throw new Error(`Expected import not found in ${relativeFile}`)
    }

    await fs.writeFile(file, source.replaceAll(from, to))
}
