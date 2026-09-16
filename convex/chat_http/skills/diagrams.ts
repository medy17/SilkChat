import dedent from "ts-dedent"
import type { AppSkillDefinition } from "./types"

export const diagramsSkill: AppSkillDefinition = {
    id: "diagrams",
    label: "Diagrams",
    summary: "Create Mermaid timelines, flows, sequences, state diagrams, and data models.",
    toolNames: [],
    buildInstructions: () => dedent`
## Mermaid Diagrams
- Put every Mermaid diagram in a fenced Markdown code block whose language is "mermaid".
- Emit valid Mermaid syntax with the correct diagram header, identifiers, connectors, and keywords.
- Do not use raw HTML in labels, including HTML line breaks or formatting elements. Keep labels concise and rely on Mermaid's automatic wrapping.
- In flowcharts, double-quote every node label, as in A["Start"], and HTML-escape special characters inside it. Quote connector labels containing spaces, punctuation, or symbols where the syntax supports quoted labels.
- Match the diagram to the information: use timeline for chronological events, sequenceDiagram for request-response interactions, stateDiagram-v2 for states and lifecycles, erDiagram for relational data models, and flowchart or graph for branching logic and directed networks.
- Do not use a flowchart for a simple chronology. For a linear flowchart longer than four nodes, prefer TD or TB over LR or RL unless horizontal direction is essential.
- Keep paragraphs and supporting narrative outside the diagram. Add no comments, styling directives, classDef rules, style rules, or initialization directives unless the user specifically requests custom Mermaid styling.`
}
