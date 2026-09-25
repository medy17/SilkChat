import { splitRoleplayContent } from "@/lib/roleplay"
import { ASSIGN_ROLEPLAY_PORTRAIT_TOOL_NAME } from "../../lib/tools/roleplay_portrait"
import type { ModelMessage } from "ai"
import dedent from "ts-dedent"
import type { AppSkillDefinition } from "./types"

// Weaker models copy the name-like IDs in the example over the reserved-ID rule, so the
// Persona line shows its exact opening tag and names the ID it must not derive.
function personaBinding(personaName: string): string {
    const nameId = personaName
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
    const counterExample = nameId && nameId !== "persona" ? `, such as id="${nameId}"` : ""
    return `The active Persona's saved name is ${JSON.stringify(personaName)}. Use id="persona" for that character in every group and use its saved name as the display name: open each of its groups exactly as <character id="persona" name=${JSON.stringify(personaName)}>, and write its quick lines as <say id="persona">. Never derive its ID from its name${counterExample}. SilkChat attaches its saved portrait by ID, never by name. Supporting characters must use different IDs, even if they share the Persona's name. Inside a scene, this format replaces any italic or asterisk stage directions the Persona instructions describe; express them as beats.`
}

// Only offered with SilkScreen, which requires function calling and vision.
const PORTRAIT_INSTRUCTIONS = `Supporting characters show initials until they have a portrait. Only when the user asks for one: to create it, prepare a square SilkScreen image with its portrait field set to the character's ID and name (load the image generation skill if needed); write the prompt from the character's established appearance in the scene. The card lets the user set or crop the result. The Persona avatar is an optional default style reference, not the supporting character's identity. Not every Persona has an avatar: when none is available, ask for a reference if needed or generate without one. Explicit references take precedence; set portrait.usePersonaStyle=false for a different style or no reference. For another attempt use a fresh prompt/settings, or variants for options; there is no Regenerate button. To use an image already in the conversation, call ${ASSIGN_ROLEPLAY_PORTRAIT_TOOL_NAME}. The Persona and the user keep their own portraits. Keep using the same character ID afterwards.

`

export const roleplaySkill: AppSkillDefinition = {
    id: "roleplay",
    label: "Roleplay",
    summary:
        "Present an in-character roleplay or multi-character fictional scene using native character groups, speech, thoughts, and actions. Presentation markup, not a tool call. Use for playing or continuing a scene, not discussion of roleplay, literary analysis, or ordinary assistant replies.",
    toolNames: [ASSIGN_ROLEPLAY_PORTRAIT_TOOL_NAME],
    buildInstructions: ({ personaName, imageGenerationEnabled }) => dedent`
## Native Roleplay Format
When performing or continuing roleplay, wrap each scene in <roleplay>...</roleplay>. This is presentation markup in your response, not a tool call. Never put a rendered scene in a code fence. Ordinary Markdown before or after a scene is allowed; avoid unnecessary preambles. Do not use this format for discussion about roleplay or unrelated requests.

${personaName ? personaBinding(personaName) : 'This is not a Persona-bound scene. Do not use the reserved id="persona". Give each character a stable ID and a display name; SilkChat uses initials unless a portrait is assigned.'}

Within a scene:
- <narration> describes the setting and background activity that no character in the scene performs, outside character groups.
- <character id="adelle" name="Adelle"> groups one character's consecutive beats. Keep the same ID for that character across groups and turns, including flashbacks and name changes. Different characters must have different IDs, even when their names are identical. IDs are case-sensitive; use stable lowercase IDs. Start another group when the viewpoint switches. Do not invent XML tag names from character names. Avatars are resolved by the app; do not emit avatar URLs or image tags.
- <action> is that character's physical action or gesture.
- <move via="foot"> is that character's travel or locomotion. via names the means in one lowercase word, such as foot, car, train, ship, horse, dragon, starship, or teleport.
- <thought> is an unspoken internal thought.
- <dialogue> is spoken dialogue. Put speech directly inside, without surrounding quotation marks, blockquotes, or a speaker label; inline *emphasis* is fine. SilkChat provides the speech bubble and attribution.
- <say id="rook" name="Rook"> is optional shorthand for a single spoken line, for quick, snappy exchanges. Place it between character groups or narration, never inside a character group; within a group, use <dialogue>. name may be omitted once that ID has appeared in the scene. Return to character groups when actions or thoughts resume.
- <flashback> contains narration, character groups, and say lines from an earlier scene. Establish when it occurs in the prose.

Preserve narrative order. Do not move speech ahead of preceding actions just to group similar tags. Put all character beats under their character. Do not decide the user's character's actions, thoughts, or replies unless the user delegates control. When you do voice the user's character, always use the reserved id="user" with its in-story name, or name="You" if it has none; SilkChat attaches the user's portrait by that ID. Never use id="user" for anyone else. Close every tag. Escape literal <, >, and & as &lt;, &gt;, and &amp;. Only character and say (quoted id and name) and move (quoted via) accept attributes. Do not add tools, buttons, script, HTML, or URLs to the markup contract.

${imageGenerationEnabled ? PORTRAIT_INSTRUCTIONS : ""}Example (emit directly, without a code fence):
<roleplay>
<narration>Rain struck the warehouse roof. A truck passed outside.</narration>
<character id="adelle" name="Adelle">
<move via="foot">She crossed the muddy floor.</move>
<action>She grabbed the book.</action>
<thought>Finally.</thought>
<dialogue>Tell me you brought the car.</dialogue>
</character>
<character id="monica" name="Monica">
<move via="car">She reversed toward the warehouse steps.</move>
<dialogue>We can discuss *whose* car it is later.</dialogue>
</character>
<say id="adelle">It's yours now.</say>
<say id="monica">That's not how cars work.</say>
</roleplay>`
}

// Restore presentation instructions from the server-selected conversation branch,
// not user-supplied quoted tags. Stop at the last substantive assistant answer so
// an unrelated exchange does not turn the whole thread into a permanent mode.
export function isContinuingRoleplay(messages: readonly ModelMessage[]): boolean {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index]
        if (message.role !== "assistant") continue
        const text =
            typeof message.content === "string"
                ? message.content
                : message.content
                      .filter((part) => part.type === "text")
                      .map((part) => part.text)
                      .join("\n")
        if (!text.trim()) continue
        return splitRoleplayContent(text).some((segment) => segment.type === "roleplay")
    }
    return false
}

// A Persona that opts into the format preloads it even before the first scene and
// when automatic skill selection is disabled or selects nothing. Other conversations
// rely on the opening classifier, load_skill, or an existing scene.
export function shouldPreloadRoleplay(
    personaRoleplayFormat: boolean | undefined,
    messages: readonly ModelMessage[]
): boolean {
    return personaRoleplayFormat === true || isContinuingRoleplay(messages)
}
