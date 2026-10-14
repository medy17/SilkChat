import dedent from "ts-dedent"
import type { AppSkillDefinition } from "./types"

export const canvasSkill: AppSkillDefinition = {
    id: "canvas",
    label: "Canvas",
    summary:
        "Live interactive apps inline, for when manipulating something explains it better than reading about it; also complex diagrams, web UI, and custom layouts that look like SilkChat's native interface.",
    toolNames: [],
    buildInstructions: () => dedent`
## Canvas Tool
Use Canvas only when an artifact does something prose can't, or for an explicit diagram/UI request; otherwise use Markdown.

### Interactive apps
Write one \`\`\`silk-app fence when the user is better served by manipulating something than by reading about it: changing inputs and watching what follows, exploring a space of cases, or doing a task the app performs. Judge by what the user needs, not by the words they use: an answer that fits in a sentence stays a sentence, and a plain question may deserve an app. If one answer, a table, or a single chart covers it, don't build one.

SilkChat runs the fence inline as a live, sandboxed app styled to the user's theme. Prefer it to \`html\`/\`react\` unless the user wants code to use elsewhere. Introduce it briefly and say what to try. For changes, rewrite the whole fence.
- One self-contained TSX module that default-exports a component. Keep state in React and derive every readout, alert, and chart from it in render, so all of it responds together. No network requests, storage, or external URLs.
- Imports: \`@silk/ui\`, \`react\`, \`recharts\`, \`motion/react\`, \`lucide-react\`, \`three\` (and \`three/addons/controls/OrbitControls.js\`), \`d3\`. Nothing else.
- Style with Tailwind theme tokens: \`bg-card\`, \`bg-muted\`, \`text-muted-foreground\`, \`border-border\`, \`text-destructive\`, \`text-warning\`, \`text-success\`, \`text-info\`, \`font-mono\`, and \`rounded-[var(--radius-lg)]\`-style radii. Never hardcode colors, fonts, or radii; the app must work in light and dark themes. The frame is transparent and sizes to its content: no page background, outer padding, or \`h-screen\`.
- Icons only where they carry meaning.
- Shape the app to its content. One control beside a live result can be the whole app; a game or physical system may be little more than a \`Canvas\`. Add a header, alert, stats, or tabs only when each carries something the user needs. Stack top-level sections in \`<div className="flex flex-col gap-3">\` and never nest cards.

\`@silk/ui\` exports:
- \`AppHeader({ title, description, tags?: string[], actions })\`
- \`Card\`, \`CardHeader\`, \`CardTitle\`, \`CardDescription\`, \`CardAction\`, \`CardContent\`, \`CardFooter\` (shadcn API)
- \`Alert({ tone, title, badge, icon, children })\`. Tones: neutral, info, success, warning, critical; a tone change animates in.
- \`StatGrid\`, \`Stat({ label, value, unit, hint, tone, digits })\`. Numeric values animate between states.
- \`Chart({ type: "line" | "area" | "bar" | "scatter", data, x, series: [{ key, label, axis: "left" | "right" }], height, xLabel, yLabel, yLabelRight, yDomain: [min, max], yDomainRight, references: [{ y, label, axis }], stacked, dots })\`. Up to five series, colored by the theme. When controls change the data, fix \`yDomain\` so axes hold still.
- \`Control({ label, description, value, children })\`: a labelled row holding one control and its readout.
- \`Slider({ value, onValueChange, min, max, step })\` takes and returns a number. \`Segmented({ options, value, onValueChange })\`, \`Switch({ checked, onCheckedChange })\`, \`Tabs\`/\`TabsList\`/\`TabsTrigger\`/\`TabsContent\`, \`Select\` parts, \`Button\`, \`Badge\`, \`Tag({ tone })\`, \`Progress\`, \`Table\` parts, \`Checkbox\`, \`RadioGroup\`, \`ToggleGroup\`, \`Input\`, \`Label\`, \`Accordion\`, \`Tooltip\`, \`Separator\`.
- \`Canvas({ draw: (ctx, { width, height, time, delta }) => void, animate, height })\` for 2D drawing at device resolution. \`useThemeColors()\` returns theme colors as rgb strings, plus \`dark\`, for canvas, SVG, and \`three\`.
- \`AnimatedNumber\`, \`formatNumber(value, digits)\`, \`formatValue\`, \`cn\`.

For \`three\`, render into a ref'd container in \`useEffect\`, size to the container with a ResizeObserver at devicePixelRatio, use a transparent clear color and theme colors, and dispose on unmount.

### Other formats
- \`mermaid\`: diagrams and other complex visual explanations. Follow the Mermaid diagram rules when that skill is also loaded.
- \`html\`/\`react\`: web content the user wants as code, or when HTML is explicitly requested. Return all code in one block and, for updates, the complete implementation. HTML supports CSS/JS. React must default-export a component, use Tailwind without arbitrary classes, and explicitly import built-in hooks from \`react\`. Image sources must be \`https://www.claudeusercontent.com/api/placeholder/{width}/{height}\`; never invent URLs.
- Use native \`render_chart\` rather than Canvas for a standalone chart.`
}
