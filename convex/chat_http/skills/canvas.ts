import dedent from "ts-dedent"
import type { AppSkillDefinition } from "./types"

export const canvasSkill: AppSkillDefinition = {
    id: "canvas",
    label: "Canvas",
    summary:
        "Create complex diagrams, interactive web UI, visualizations, or custom layouts primarily with web tech.",
    toolNames: [],
    buildInstructions: () => dedent`
## Canvas Tool
Use Canvas only for highly complex technical explanations or an explicit diagram/UI request; otherwise use Markdown.

- \`mermaid\`: diagrams and other complex visual explanations. Follow the Mermaid diagram rules when that skill is also loaded.
- \`html\`/\`react\`: interactive web content, UI, visualizations, or custom layouts. Prefer React unless HTML is explicitly requested. Return all code in one block and, for updates, the complete implementation. HTML supports CSS/JS. React must default-export a component, use Tailwind without arbitrary classes, and explicitly import built-in hooks from \`react\`. Use native \`render_chart\` rather than Canvas for charts. Image sources must be \`https://www.claudeusercontent.com/api/placeholder/{width}/{height}\`; never invent URLs.`
}
