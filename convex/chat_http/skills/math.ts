import dedent from "ts-dedent"
import type { AppSkillDefinition } from "./types"

export const mathSkill: AppSkillDefinition = {
    id: "math",
    label: "Math Kit",
    summary:
        "Solve non-trivial math and render native charts or relationship networks. Most arithmetic problems you can likely solve without Math Kit but graphs will need it.",
    ability: "mathematical_instruments",
    toolNames: ["execute_math", "render_chart", "render_network"],
    buildInstructions: ({ mathKitEnabled }) => {
        const toolInstructions = mathKitEnabled
            ? dedent`
Math Kit is the name the user sees in the Tools menu for the internal \`mathematical_instruments\` ability. Math Kit is enabled. Its tools are separate capabilities with different jobs:
- \`render_chart\`: renders supplied numeric data as a native interactive line, bar, area, scatter, or sampled-function plot. It does not execute code or derive data. Use a linear x scale for continuous numeric functions.
- \`render_network\`: renders supplied nodes and edges as a native interactive network. It does not run graph algorithms. Use it for relationships, topology, paths, trees, and dependency graphs.
- \`execute_math\`: when it appears in the callable tool list, it is a real scoped Python 3.13 executor included with Math Kit (\`mathematical_instruments\`). It automatically provides SymPy, NumPy, SciPy, pandas, Matplotlib, NetworkX, statsmodels, and Pint. It does not depend on the separate Code Execution toggle being on. Since the two are separate, never claim \`execute_math\` is unavailable merely because \`execute_code\` is absent or Code Execution is off; the callable tool list is authoritative.

Tool routing rules:
- Answer trivial arithmetic directly. Use \`execute_math\` to verify non-trivial symbolic algebra, numerical methods, statistics, data analysis, units, or graph algorithms.
- If the user already supplied all chart or network data, call the renderer directly without executing Python first.
- When computation produces a visualization, call \`execute_math\` first, then pass only the useful computed data to \`render_chart\` or \`render_network\`.
- Every \`render_chart\` invocation must include complete, non-empty \`series\` and \`data\` arrays in that same invocation. Never send a metadata-only chart call or defer either array to a later call.
- Use \`execute_code\` instead only for general-purpose JavaScript/Python, arbitrary third-party dependencies, software testing, internet retrieval, or persistent filesystem work. Do not call both executors for the same calculation.
- Prefer the native renderers over Canvas, Mermaid, HTML, React, ASCII art, Matplotlib images, or other code-generated images whenever the requested visualization fits their contracts.`
            : "Math Kit (internal ability: `mathematical_instruments`) is unavailable with the selected model."

        return dedent`
## Math Rules
Default to plain text. Use LaTeX only for explicitly mathematical equations, numerical derivations, or symbolic algebra—not merely scientific/technical text or mentions of numbers. Use double-dollar delimiters for inline math ($$L_{0}$$) and block fences on their own lines:
  $$
  L(t) = L_{0}e^{-kt}
  $$
Single-dollar delimiters ($L_{0}$) are forbidden.

## Math Kit (internal ability: \`mathematical_instruments\`)
${toolInstructions}`
    }
}
