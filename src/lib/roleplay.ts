export type RoleplayBeatKind = "narration" | "action" | "move" | "dialogue" | "thought"
export type RoleplayNode =
    | { kind: RoleplayBeatKind; text: string; via?: string }
    // compact marks a group written as <say> lines, presented as a quick exchange.
    | { kind: "character"; id?: string; name: string; compact?: true; children: RoleplayNode[] }
    | { kind: "flashback"; children: RoleplayNode[] }
export type RoleplaySegment =
    | { type: "markdown"; content: string }
    | { type: "roleplay"; content: string; streaming: boolean }

const wrappers = ["roleplay", "roleplay_markup"]
const tags = [
    "character",
    "say",
    "narration",
    "walk",
    "drive",
    "move",
    "action",
    "dialogue",
    "thought",
    "flashback"
]
// Earlier markup had fixed movement tags; they are now travel modes of <move>.
const legacyMoves: Record<string, string> = { walk: "foot", drive: "car" }
const blank = (value: string) => value.replace(/[^\r\n]/g, " ")
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
// Reserved for the user's own character when the user delegates it to the model.
export const ROLEPLAY_USER_ID = "user"
// Fallback display name for an ID seen without a name attribute.
const defaultName = (id: string) => (id === ROLEPLAY_USER_ID ? "You" : capitalize(id))

// Preserve offsets while excluding Markdown examples from native markup detection.
function maskCode(text: string, indented: boolean): string {
    let fence: { marker: string; length: number } | undefined
    const masked = text
        .split(/(?<=\n)/)
        .map((line) => {
            const run = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1]
            if (fence) {
                if (
                    run?.[0] === fence.marker &&
                    run.length >= fence.length &&
                    line.trim().length === run.length
                )
                    fence = undefined
                return blank(line)
            }
            if (run) {
                fence = { marker: run[0], length: run.length }
                return blank(line)
            }
            return indented && /^(?: {4}|\t)/.test(line) ? blank(line) : line
        })
        .join("")
    return masked.replace(/(`+)([\s\S]*?)\1(?!`)/g, blank)
}

// Keeps stray tags in beat prose as readable text rather than HTML. Code spans and
// fences show their contents verbatim, so they are left for Markdown to render as is.
export function escapeHtmlOutsideCode(text: string): string {
    const masked = maskCode(text, false)
    return text.replace(/[<>]/g, (char, index: number) =>
        masked[index] === char ? (char === "<" ? "&lt;" : "&gt;") : char
    )
}

function escaped(text: string, index: number): boolean {
    let count = 0
    while (index > 0 && text[--index] === "\\") count++
    return count % 2 === 1
}

function pendingTagStart(text: string, searchable: string, names: string[]): number {
    const index = searchable.lastIndexOf("<")
    if (index < 0 || escaped(text, index)) return text.length
    const suffix = searchable.slice(index).toLowerCase()
    if (suffix.includes(">") || suffix.length > 512) return text.length
    return names.some((name) => {
        const open = `<${name}`
        const close = `</${name}`
        return (
            open.startsWith(suffix) ||
            close.startsWith(suffix) ||
            suffix === open ||
            suffix === close ||
            suffix.startsWith(`${open} `) ||
            suffix.startsWith(`${open}\n`) ||
            suffix.startsWith(`${open}\t`) ||
            suffix.startsWith(`${close} `)
        )
    })
        ? index
        : text.length
}

export function splitRoleplayContent(text: string, streaming = false): RoleplaySegment[] {
    // Most messages contain no scene; skip masking unless a wrapper fragment may be pending.
    if (!/<\/?roleplay/i.test(text)) {
        const end = streaming ? pendingTagStart(text, text, wrappers) : text.length
        if (end === text.length) return text ? [{ type: "markdown", content: text }] : []
    }
    // A recipe is its own native surface, not a place to start another scene.
    const searchable = maskCode(text, true).replace(
        /<recipe\b[^>]*>[\s\S]*?(?:<\/recipe>|$)/gi,
        blank
    )
    const pattern = /<roleplay(?:_markup)?(?=[\s>])[^<>]*>/gi
    const segments: RoleplaySegment[] = []
    let cursor = 0
    for (let opening = pattern.exec(searchable); opening; opening = pattern.exec(searchable)) {
        if (escaped(text, opening.index)) continue
        if (opening.index > cursor)
            segments.push({ type: "markdown", content: text.slice(cursor, opening.index) })
        const start = pattern.lastIndex
        const closing = /<\/roleplay(?:_markup)?\s*>/gi
        closing.lastIndex = start
        let end = closing.exec(searchable)
        while (end && escaped(text, end.index)) end = closing.exec(searchable)
        let bodyEnd = end?.index ?? text.length
        if (!end && streaming) bodyEnd = pendingTagStart(text, searchable, wrappers)
        segments.push({
            type: "roleplay",
            content: text.slice(start, Math.max(start, bodyEnd)),
            streaming: streaming && !end
        })
        cursor = end ? closing.lastIndex : text.length
        pattern.lastIndex = cursor
        if (!end) break
    }
    const tailEnd = streaming ? pendingTagStart(text, searchable, wrappers) : text.length
    if (cursor < tailEnd) segments.push({ type: "markdown", content: text.slice(cursor, tailEnd) })
    return segments
}

function decode(text: string): string {
    const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }
    return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, value: string) => {
        if (!value.startsWith("#")) return named[value.toLowerCase()] ?? entity
        const code =
            value[1].toLowerCase() === "x"
                ? Number.parseInt(value.slice(2), 16)
                : Number.parseInt(value.slice(1), 10)
        return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
            ? String.fromCodePoint(code)
            : entity
    })
}

export function parseRoleplay(content: string, streaming = false): RoleplayNode[] {
    const searchable = maskCode(content, false)
    const end = streaming ? pendingTagStart(content, searchable, tags) : content.length
    const nodes: RoleplayNode[] = []
    const stack: RoleplayNode[] = []
    // Display names by character ID, so later <say> lines may omit the name.
    const names = new Map<string, string>()
    const lastIndex = (kind: RoleplayNode["kind"]) => {
        for (let index = stack.length - 1; index >= 0; index--)
            if (stack[index].kind === kind) return index
        return -1
    }
    const append = (node: RoleplayNode) => {
        const parent = stack.at(-1)
        if (parent && "children" in parent) parent.children.push(node)
        else nodes.push(node)
    }
    const addText = (text: string) => {
        if (!text) return
        const parent = stack.at(-1)
        if (parent && "text" in parent) parent.text += decode(text)
        else if (text.trim()) append({ kind: "narration", text: decode(text) })
    }
    const pattern =
        /<(\/?)(character|say|narration|walk|drive|move|action|dialogue|thought|flashback)(?=[\s/>])([^<>]*)>/gi
    let cursor = 0
    for (
        let token = pattern.exec(searchable);
        token && token.index < end;
        token = pattern.exec(searchable)
    ) {
        if (escaped(content, token.index)) continue
        addText(content.slice(cursor, token.index))
        cursor = pattern.lastIndex
        const tag = token[2].toLowerCase()
        // A <say> line is a one-line character group, so it opens and closes like one.
        const kind =
            tag in legacyMoves
                ? "move"
                : tag === "say"
                  ? "character"
                  : (tag as RoleplayNode["kind"])
        const selfClosing = token[3].trimEnd().endsWith("/")
        if (tag === "say" && selfClosing && !token[1]) continue
        if (token[1]) {
            const index = lastIndex(kind)
            if (index >= 0) stack.length = index
            continue
        }
        // Repair an omitted beat close or character close without assigning a new
        // character's actions to the previous character. Keep nesting bounded.
        if (stack.at(-1) && "text" in stack.at(-1)!) stack.pop()
        if (kind === "character") {
            const previous = lastIndex("character")
            if (previous >= 0) stack.length = previous
        }
        if (stack.length >= 24) continue
        const attributes = new Map<string, string>()
        for (const attribute of token[3].matchAll(
            /(?:^|\s)([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
        )) {
            attributes.set(attribute[1].toLowerCase(), decode(attribute[2] ?? attribute[3]))
        }
        const id = attributes.get("id")?.trim()
        const via = legacyMoves[tag] ?? attributes.get("via")?.trim().toLowerCase()
        // Consecutive groups for the same character read as one continuous group. A full
        // group never folds into a quick exchange, so its layout cannot change mid-stream.
        const parent = stack.at(-1)
        const previous = (parent && "children" in parent ? parent.children : nodes).at(-1)
        let node: RoleplayNode
        if (
            kind === "character" &&
            id &&
            previous?.kind === "character" &&
            previous.id === id &&
            (tag === "say" || !previous.compact)
        ) {
            node = previous
        } else {
            node =
                kind === "character"
                    ? {
                          kind,
                          ...(id ? { id } : {}),
                          name:
                              attributes.get("name")?.trim() ||
                              (id && (names.get(id) ?? defaultName(id))) ||
                              "Character",
                          ...(tag === "say" ? { compact: true as const } : {}),
                          children: []
                      }
                    : kind === "flashback"
                      ? { kind, children: [] }
                      : kind === "move" && via
                        ? { kind, text: "", via }
                        : { kind, text: "" }
            append(node)
            if (id && node.kind === "character" && !names.has(id)) names.set(id, node.name)
        }
        if (selfClosing) continue
        stack.push(node)
        if (tag === "say" && node.kind === "character") {
            const line: RoleplayNode = { kind: "dialogue", text: "" }
            node.children.push(line)
            stack.push(line)
        }
    }
    addText(content.slice(cursor, end))
    return nodes
}

// The model names the means of travel freely in `via`; the renderer owns this
// vocabulary, so it can grow without prompt changes. Words that are ambiguous across
// settings (coach, gondola) are left out and fall back to the generic travel icon.
const travelModes = {
    foot: [
        "foot",
        "feet",
        "walk",
        "run",
        "jog",
        "sprint",
        "dash",
        "hike",
        "trek",
        "stroll",
        "wander",
        "sneak",
        "crawl",
        "march",
        "limp"
    ],
    car: ["car", "drive", "automobile", "sedan", "jeep", "suv", "convertible", "limo", "limousine"],
    taxi: ["taxi", "cab", "rideshare"],
    truck: ["truck", "lorry", "van", "pickup"],
    bus: ["bus", "minibus"],
    ambulance: ["ambulance"],
    tractor: ["tractor"],
    caravan: ["caravan", "rv", "camper", "motorhome"],
    bike: ["bike", "bicycle", "cycle", "tandem"],
    motorbike: ["motorbike", "motorcycle", "moped", "dirtbike"],
    scooter: ["scooter", "vespa"],
    wheelchair: ["wheelchair"],
    train: ["train", "rail", "railway", "locomotive"],
    tram: ["tram", "streetcar", "trolley"],
    subway: ["subway", "metro", "underground", "tube"],
    cableCar: ["cablecar", "skilift", "chairlift", "funicular"],
    boat: [
        "boat",
        "sail",
        "sailboat",
        "yacht",
        "canoe",
        "kayak",
        "raft",
        "row",
        "rowboat",
        "dinghy",
        "punt"
    ],
    ship: ["ship", "ferry", "liner", "steamer", "galleon", "frigate", "cruise", "vessel"],
    swim: ["swim", "paddle"],
    dive: ["dive", "submarine", "sub", "scuba", "snorkel"],
    plane: ["plane", "airplane", "aeroplane", "jet", "aircraft", "airliner", "flight"],
    helicopter: ["helicopter", "chopper", "heli"],
    drone: ["drone"],
    wings: ["wing", "fly", "glide", "soar", "griffin", "gryphon"],
    spacecraft: ["rocket", "spaceship", "starship", "shuttle", "spacecraft", "shuttlecraft"],
    ufo: ["ufo", "saucer", "flyingsaucer"],
    magic: ["magic", "teleport", "portal", "spell", "blink", "warp", "apparate"],
    ghost: ["ghost", "phase", "spirit", "astral"],
    climb: ["climb", "scramble", "rappel", "abseil"],
    ski: ["ski", "snowboard", "sled", "sledge", "toboggan"],
    horse: [
        "horse",
        "horseback",
        "pony",
        "steed",
        "mount",
        "stallion",
        "mare",
        "pegasus",
        "mule",
        "donkey",
        "camel"
    ],
    unicorn: ["unicorn"],
    dragon: ["dragon", "wyvern", "drake"],
    carriage: ["carriage", "stagecoach", "wagon", "cart", "buggy", "chariot", "sleigh", "rickshaw"]
} as const satisfies Record<string, readonly string[]>

export type TravelMode = keyof typeof travelModes

const travelModeByWord = new Map<string, TravelMode>(
    Object.entries(travelModes).flatMap(([mode, words]) =>
        words.map((word) => [word, mode as TravelMode] as const)
    )
)

export function travelMode(via: string | undefined): TravelMode | undefined {
    // Tolerate "by car", "cable car", and simple inflections such as "horses",
    // "sailing", "running", "ferries", or "hiked".
    const word = via
        ?.toLowerCase()
        .replace(/^(?:by|on|via)\s+/, "")
        .replace(/[\s-]+/g, "")
    if (!word) return undefined
    const candidates = [
        word,
        word.replace(/ies$/, "y"),
        word.replace(/s$/, ""),
        word.replace(/es$/, ""),
        word.replace(/ing$/, ""),
        word.replace(/ing$/, "e"),
        word.replace(/(.)\1ing$/, "$1"),
        word.replace(/d$/, ""),
        word.replace(/ed$/, "")
    ]
    for (const candidate of candidates) {
        const mode = travelModeByWord.get(candidate)
        if (mode) return mode
    }
    return undefined
}

// Conventional roleplay prose: speech in quotes, actions and thoughts italicised,
// unless the beat already carries its own emphasis.
function beatToText(kind: RoleplayBeatKind, text: string): string {
    const trimmed = text.trim()
    if (!trimmed || kind === "narration") return trimmed
    if (kind === "dialogue") return `“${dialogueText(trimmed)}”`
    return trimmed
        .split(/\n\s*\n/)
        .map((paragraph) => (/[*_]/.test(paragraph) ? paragraph : `*${paragraph.trim()}*`))
        .join("\n\n")
}

export function roleplayNodesToText(nodes: RoleplayNode[]): string {
    return nodes
        .map((node) => {
            if (!("children" in node)) return beatToText(node.kind, node.text)
            // Quick exchanges copy as screenplay lines: Name: “Line.”
            if (node.kind === "character" && node.compact) {
                const lines = node.children
                    .map((child) => ("text" in child ? beatToText(child.kind, child.text) : ""))
                    .filter(Boolean)
                return lines.length ? `${node.name}: ${lines.join(" ")}` : ""
            }
            return `${node.kind === "character" ? node.name : "Flashback"}:\n${roleplayNodesToText(node.children)}`
        })
        .filter(Boolean)
        .join("\n\n")
}

export function roleplayToPlainText(content: string): string {
    return splitRoleplayContent(content)
        .map((segment) =>
            segment.type === "roleplay"
                ? roleplayNodesToText(parseRoleplay(segment.content))
                : segment.content
        )
        .join("")
}

export function dialogueText(text: string): string {
    return text.trim().replace(/^(?:“([\s\S]*)”|"([\s\S]*)")$/, "$1$2")
}
