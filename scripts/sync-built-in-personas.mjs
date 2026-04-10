import { readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const builtinsDir = path.resolve(process.cwd(), "src/lib/personas/builtins")
const indexPath = path.join(builtinsDir, "index.ts")
const ignoredFiles = new Set(["index.ts", "types.ts"])
const personaExportPattern = /export const (\w+): BuiltInPersona\s*=/

const entries = await readdir(builtinsDir, { withFileTypes: true })

const personaModules = entries
    .filter(
        (entry) => entry.isFile() && entry.name.endsWith(".ts") && !ignoredFiles.has(entry.name)
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

const personas = []

for (const fileName of personaModules) {
    const filePath = path.join(builtinsDir, fileName)
    const contents = await readFile(filePath, "utf8")
    const match = contents.match(personaExportPattern)

    if (!match) {
        throw new Error(
            `Expected ${path.relative(process.cwd(), filePath)} to export a BuiltInPersona constant`
        )
    }

    const exportName = match[1]
    const importPath = `./${fileName.replace(/\.ts$/, "")}`
    personas.push({ exportName, importPath })
}

const importLines = personas.map(
    ({ exportName, importPath }) => `import { ${exportName} } from "${importPath}"`
)
const personaList = personas.map(({ exportName }) => `    ${exportName}`).join(",\n")

const output = `${importLines.join("\n")}

export const MAX_PERSONA_KNOWLEDGE_DOCS = 5
export const MAX_PERSONA_PROMPT_TOKENS = 20_000
export const MAX_PERSONA_AVATAR_BYTES = 100 * 1024
export const MIN_PERSONA_STARTERS = 2
export const MAX_PERSONA_STARTERS = 5

export type { BuiltInPersona, BuiltInPersonaDoc } from "./types"

export const BUILT_IN_PERSONAS = [
${personaList}
]

export const getBuiltInPersonaById = (id: string) =>
    BUILT_IN_PERSONAS.find((persona) => persona.id === id) ?? null
`

await writeFile(indexPath, output, "utf8")
