import { describe, expect, it } from "vitest"
import {
    dialogueText,
    parseRoleplay,
    roleplayToPlainText,
    splitRoleplayContent,
    travelMode
} from "@/lib/roleplay"

describe("roleplay presentation contract", () => {
    it("preserves distinct identities for identical names and repeated identities across groups", () => {
        const nodes = parseRoleplay(
            '<character id="persona" name="Adelle"><dialogue>Hello.</dialogue></character>' +
                '<character name="Adelle" id="adelle-stranger"><thought>Who?</thought></character>' +
                '<character id="persona" name="Adelle"><action>She waits.</action></character>'
        )
        expect(
            nodes.map((node) => (node.kind === "character" ? [node.id, node.name] : null))
        ).toEqual([
            ["persona", "Adelle"],
            ["adelle-stranger", "Adelle"],
            ["persona", "Adelle"]
        ])
        const partial = '<character id="persona" name="Adelle">'
        for (let end = 1; end < partial.length; end++) {
            expect(parseRoleplay(partial.slice(0, end), true)).toEqual([])
        }
        expect(parseRoleplay('<character name="Adelle" data-id="persona"/>')).toEqual([
            { kind: "character", name: "Adelle", children: [] }
        ])
    })
    it("preserves prose around multiple scenes and accepts either wrapper spelling", () => {
        const parts = splitRoleplayContent(
            "Sure.\n<roleplay><narration>Rain.</narration></roleplay>\nLater.\n<roleplay_markup><narration>Sun.</narration></roleplay_markup>\nDone."
        )
        expect(parts.map((part) => part.type)).toEqual([
            "markdown",
            "roleplay",
            "markdown",
            "roleplay",
            "markdown"
        ])
        expect(
            parts.filter((part) => part.type === "markdown").map((part) => part.content)
        ).toEqual(["Sure.\n", "\nLater.\n", "\nDone."])
    })

    it("holds every partial opening tag during streaming, but releases ordinary less-than text", () => {
        for (const tag of ["<roleplay>", "<roleplay_markup>"]) {
            for (let index = 1; index < tag.length; index++) {
                expect(splitRoleplayContent(`Before ${tag.slice(0, index)}`, true)).toEqual([
                    { type: "markdown", content: "Before " }
                ])
            }
            expect(splitRoleplayContent(tag, true)).toEqual([
                { type: "roleplay", content: "", streaming: true }
            ])
        }
        expect(splitRoleplayContent("x < 3", true)).toEqual([
            { type: "markdown", content: "x < 3" }
        ])
        expect(splitRoleplayContent("unfinished <role", false)).toEqual([
            { type: "markdown", content: "unfinished <role" }
        ])
    })

    it("never turns fenced, inline, indented or escaped examples into scenes", () => {
        for (const source of [
            "```xml\n<roleplay>example</roleplay>\n```",
            "~~~xml\n<roleplay>example</roleplay>\n~~~",
            "`<roleplay>example</roleplay>`",
            "    <roleplay>example</roleplay>",
            "\\<roleplay>example</roleplay>",
            '<recipe servings="2">\n<roleplay>example</roleplay>\n</recipe>'
        ]) {
            expect(splitRoleplayContent(source)).toEqual([{ type: "markdown", content: source }])
        }
    })

    it("keeps character ownership, scene activity, legacy movement beats and memories in order", () => {
        const nodes = parseRoleplay(
            '<narration>A truck passes.</narration><character name="Adelle"><walk>She runs.</walk><thought>Go.</thought></character><flashback><character name="Monica"><drive>She drove.</drive><dialogue>Wait.</dialogue></character></flashback>'
        )
        expect(nodes).toEqual([
            { kind: "narration", text: "A truck passes." },
            {
                kind: "character",
                name: "Adelle",
                children: [
                    { kind: "move", text: "She runs.", via: "foot" },
                    { kind: "thought", text: "Go." }
                ]
            },
            {
                kind: "flashback",
                children: [
                    {
                        kind: "character",
                        name: "Monica",
                        children: [
                            { kind: "move", text: "She drove.", via: "car" },
                            { kind: "dialogue", text: "Wait." }
                        ]
                    }
                ]
            }
        ])
    })

    it("reads free-form travel modes, falling back for means without a dedicated icon", () => {
        expect(
            parseRoleplay('<move via=" Horse ">She rides.</move><move>She goes.</move>')
        ).toEqual([
            { kind: "move", text: "She rides.", via: "horse" },
            { kind: "move", text: "She goes." }
        ])
        const cases: [string, ReturnType<typeof travelMode>][] = [
            ["foot", "foot"],
            ["running", "foot"],
            ["hiked", "foot"],
            ["by car", "car"],
            ["buses", "bus"],
            ["ferries", "ship"],
            ["horses", "horse"],
            ["cable-car", "cableCar"],
            ["sailing", "boat"],
            ["flying", "wings"],
            ["wyvern", "dragon"],
            ["teleport", "magic"],
            ["coach", undefined],
            ["hovercraft", undefined]
        ]
        expect(cases.map(([via]) => [via, travelMode(via)])).toEqual(cases)
    })

    it("reads say lines as quick-exchange groups placed between character groups, never inside one", () => {
        const say = (id: string, name: string, text: string) => ({
            kind: "character",
            id,
            name,
            compact: true,
            children: [{ kind: "dialogue", text }]
        })
        expect(
            parseRoleplay(
                '<say id="mara" name="Mara">Brake.</say><say id="rook">I am braking.</say><say id="mara">That is acceleration.</say>'
            )
        ).toEqual([
            say("mara", "Mara", "Brake."),
            say("rook", "Rook", "I am braking."),
            say("mara", "Mara", "That is acceleration.")
        ])
        // A say inside an open group or beat closes them first instead of nesting.
        expect(
            parseRoleplay(
                '<character id="mara" name="Mara"><action>She grips the seat.<say id="rook" name="Rook">Hold on.</say>'
            )
        ).toEqual([
            {
                kind: "character",
                id: "mara",
                name: "Mara",
                children: [{ kind: "action", text: "She grips the seat." }]
            },
            say("rook", "Rook", "Hold on.")
        ])
    })

    it("names the reserved user character You unless the story gives it a name", () => {
        expect(
            parseRoleplay(
                '<say id="user">Like a tennis match?</say><character id="user" name="Kira"><action>Grins.</action></character>'
            ).map((node) => (node.kind === "character" ? node.name : null))
        ).toEqual(["You", "Kira"])
    })

    it("joins say lines to the same speaker without ever folding a full group into an exchange", () => {
        expect(
            parseRoleplay(
                '<say id="rook" name="Rook">One.</say><say id="rook">Two.</say><character id="rook"><action>Shrugs.</action></character><say id="rook">Three.</say>'
            )
        ).toEqual([
            {
                kind: "character",
                id: "rook",
                name: "Rook",
                compact: true,
                children: [
                    { kind: "dialogue", text: "One." },
                    { kind: "dialogue", text: "Two." }
                ]
            },
            {
                kind: "character",
                id: "rook",
                name: "Rook",
                children: [
                    { kind: "action", text: "Shrugs." },
                    { kind: "dialogue", text: "Three." }
                ]
            }
        ])
    })

    it("streams a say line without exposing a partial tag", () => {
        for (const suffix of ["<", "</s", "</say", '<say id="ma']) {
            expect(parseRoleplay(`<say id="rook" name="Rook">Queue forms${suffix}`, true)).toEqual([
                {
                    kind: "character",
                    id: "rook",
                    name: "Rook",
                    compact: true,
                    children: [{ kind: "dialogue", text: "Queue forms" }]
                }
            ])
        }
    })

    it("continues one group for back-to-back beats by the same character", () => {
        expect(
            parseRoleplay(
                '<character id="a" name="A"><action>Nods.</action></character>\n<character id="a" name="A"><dialogue>Yes.</dialogue></character><character name="B"><action>Waits.</action></character><character name="B"><action>Sighs.</action></character>'
            )
        ).toEqual([
            {
                kind: "character",
                id: "a",
                name: "A",
                children: [
                    { kind: "action", text: "Nods." },
                    { kind: "dialogue", text: "Yes." }
                ]
            },
            { kind: "character", name: "B", children: [{ kind: "action", text: "Waits." }] },
            { kind: "character", name: "B", children: [{ kind: "action", text: "Sighs." }] }
        ])
    })

    it("accepts wrapper attributes and either closing spelling, without matching longer tag names", () => {
        expect(splitRoleplayContent('<roleplay scene="1">Rain.</roleplay_markup> After.')).toEqual([
            { type: "roleplay", content: "Rain.", streaming: false },
            { type: "markdown", content: " After." }
        ])
        expect(parseRoleplay("<character-sheet>Stats.</character-sheet>")).toEqual([
            { kind: "narration", text: "<character-sheet>Stats.</character-sheet>" }
        ])
    })

    it("shows complete words without exposing partial inner tags or losing the character", () => {
        const prefix = '<character name="Adelle"><dialogue>Hello'
        for (const suffix of [
            "<",
            "</",
            "</dia",
            "</dialogue",
            "</dialogue>",
            '</dialogue><character name="Mon'
        ]) {
            expect(parseRoleplay(prefix + suffix, true)).toEqual([
                {
                    kind: "character",
                    name: "Adelle",
                    children: [{ kind: "dialogue", text: "Hello" }]
                }
            ])
        }
        for (const suffix of ["<", "</", "</role", "</roleplay"]) {
            expect(splitRoleplayContent(`<roleplay>${prefix}${suffix}`, true)).toEqual([
                { type: "roleplay", content: prefix, streaming: true }
            ])
        }
    })

    it("recovers omitted closes and retains malformed/unsupported content as readable text", () => {
        expect(
            parseRoleplay(
                '<character name="A"><action>Reach.<thought>Hope.<character name="B"><dialogue>Stop.'
            )
        ).toEqual([
            {
                kind: "character",
                name: "A",
                children: [
                    { kind: "action", text: "Reach." },
                    { kind: "thought", text: "Hope." }
                ]
            },
            { kind: "character", name: "B", children: [{ kind: "dialogue", text: "Stop." }] }
        ])
        expect(parseRoleplay("Plain <unknown>words</unknown> &amp; more.")).toEqual([
            { kind: "narration", text: "Plain <unknown>words</unknown> & more." }
        ])
    })

    it("decodes text without treating entities as structure and strips only paired speech quotes", () => {
        expect(
            parseRoleplay(
                '<character name="A &amp; B"><dialogue>&lt;script&gt; &quot;hi&quot;</dialogue></character>'
            )
        ).toEqual([
            {
                kind: "character",
                name: "A & B",
                children: [{ kind: "dialogue", text: '<script> "hi"' }]
            }
        ])
        expect(dialogueText("“She said ‘go’.”")).toBe("She said ‘go’.")
        expect(dialogueText('"Hello"')).toBe("Hello")
        expect(dialogueText('He said "go".')).toBe('He said "go".')
    })

    it("copies readable scenes with attribution and conventional speech and action marks, without rewriting code examples", () => {
        expect(
            roleplayToPlainText(
                'Before\n<roleplay><character name="A"><action>Nods.</action><thought>I *knew* it.</thought><dialogue>“Yes.”</dialogue></character></roleplay>\nAfter'
            )
        ).toBe("Before\nA:\n*Nods.*\n\nI *knew* it.\n\n“Yes.”\nAfter")
        expect(
            roleplayToPlainText(
                '<roleplay><say id="m" name="Mara">Brake.</say><say id="r" name="Rook">I am.</say></roleplay>'
            )
        ).toBe("Mara: “Brake.”\n\nRook: “I am.”")
        const code = "`<roleplay><dialogue>Example.</dialogue></roleplay>`"
        expect(roleplayToPlainText(code)).toBe(code)
    })
})
