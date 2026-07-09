import { type LucideIcon, MessagesSquare, PenLine, ShieldCheck } from "lucide-react"

// Curated, marketing-facing view of the built-in personas. Intentionally decoupled
// from `@/lib/personas/builtins` so this public, logged-out page does not bundle the
// full instruction/knowledge-doc payloads (tens of KB) into the client. Names and
// avatars mirror the real built-ins so the page previews the actual product.

export type ShowcasePersona = {
    id: string
    name: string
    // Short label shown in the emulated chat sidebar.
    shortName: string
    // Short marketing label, e.g. "Roleplay" or "Learn".
    category: string
    // Avatar asset under /public/avatars.
    avatarPath: string
}

export const showcasePersonas: ShowcasePersona[] = [
    {
        id: "seraphine-fae",
        name: "Seraphine",
        shortName: "Seraphine",
        category: "Fantasy",
        avatarPath: "/avatars/seraphine.webp"
    },
    {
        id: "scheming-bastard",
        name: "The Scheming Bastard",
        shortName: "Schemer",
        category: "Roleplay",
        avatarPath: "/avatars/scheming-bastard.webp"
    },
    {
        id: "nyx-netrunner",
        name: "Nyx",
        shortName: "Nyx",
        category: "Sci-Fi",
        avatarPath: "/avatars/nyx.webp"
    },
    {
        id: "lucian-vampire",
        name: "Lucian",
        shortName: "Lucian",
        category: "Supernatural",
        avatarPath: "/avatars/lucian.webp"
    },
    {
        id: "brooding-stranger",
        name: "Renji",
        shortName: "Ren",
        category: "Romance",
        avatarPath: "/avatars/renji.webp"
    },
    {
        id: "elara-adventurer",
        name: "Elara",
        shortName: "Elara",
        category: "Adventure",
        avatarPath: "/avatars/elara.webp"
    },
    {
        id: "monday",
        name: "Monday",
        shortName: "Monday",
        category: "Companion",
        avatarPath: "/avatars/monday.webp"
    }
]

// Genre showcase cards for the hero row. These are mood/setting shots (not tied to
// a specific built-in persona) that advertise the range of roleplay worlds. Assets
// live under /public/persona_showcase.
export type HeroGenreCard = {
    genre: string
    imagePath: string
}

export const heroGenreCards: HeroGenreCard[] = [
    {
        genre: "Fantasy",
        imagePath: "/persona_showcase/fantasy_medieval_romantic_woman.png"
    },
    {
        genre: "Romance",
        imagePath: "/persona_showcase/dark_handsome_man.png"
    },
    {
        genre: "Sci-Fi",
        imagePath: "/persona_showcase/cyberpunk_hacker_woman.png"
    },
    {
        genre: "Supernatural",
        imagePath: "/persona_showcase/vampire_man.png"
    },
    {
        genre: "Adventure",
        imagePath: "/persona_showcase/isekai_heroine.png"
    }
]

// A single scripted exchange per persona for the emulated chat window. Written
// in each persona's real voice so the demo previews how they actually respond.
export type PersonaDemo = {
    id: string
    modelLabel: string
    user: string
    reply: string
}

export const personaDemos: PersonaDemo[] = [
    {
        id: "seraphine-fae",
        modelLabel: "Gemini 3 Flash",
        user: "If I eat the fruit you're offering, what happens when I leave?",
        reply: "*She turns the apple slowly, letting the lantern-light slide across its skin.* Clever traveller, asking before biting. You may leave whenever you please — leaving was never the price. The missing it is. Shall we negotiate dessert?"
    },
    {
        id: "nyx-netrunner",
        modelLabel: "Gemini 3 Flash",
        user: "Give me the plan, Nyx. Entry, objective, exit.",
        reply: "*Fingers flick through the holo-feed.* Entry: the loading dock nobody's patched since the flood. Objective: one very embarrassing ledger. Exit: fast, choom — the ICE gets curious in ninety seconds and I'm not introducing you."
    },
    {
        id: "lucian-vampire",
        modelLabel: "Gemini 3 Flash",
        user: "What exactly are you drinking, Lucian?",
        reply: "*He sets the glass down with unhurried care.* A Margaux considerably older than your grandmother, and rather better behaved. Yours is the same — from the cellar, I assure you. You looked worried."
    },
    {
        id: "brooding-stranger",
        modelLabel: "Gemini 3 Flash",
        user: "You're up late again.",
        reply: "*He doesn't look up right away.* Could say the same about you. *slides a mug across the counter* Kettle's still warm. Sit or don't."
    },
    {
        id: "elara-adventurer",
        modelLabel: "Gemini 3 Flash",
        user: "I think I just got summoned to another world. Where am I?",
        reply: "*Her wings snap open, scattering journal pages.* I knew it! Half a day's walk from Bramblegate, at the edge of a forest you should absolutely not enter after sunset. Don't panic — you have me. *scribbles furiously* Now say the summoning part again. Slower."
    },
    {
        id: "scheming-bastard",
        modelLabel: "Gemini 3 Flash",
        user: "How do I center a div?",
        reply: "Right. Here's the play, and nobody must know how simple it is: `display: grid; place-items: center;`. Done. You didn't hear it from me — I'll add it to your tab, emotionally."
    },
    {
        id: "monday",
        modelLabel: "GPT-4o",
        user: "Can you help me plan my day?",
        reply: "Sure. I absorbed the entire internet and you absorbed a granola bar, but let's plan YOUR day. Step one: lower the bar. Step two: you're already tired. We'll get there. Reluctantly."
    }
]

// Titles only — each step is illustrated by its slice of the mock editor in the
// walkthrough section, so the steps carry no descriptive copy.
export type WalkthroughStep = {
    title: string
}

export const walkthroughSteps: WalkthroughStep[] = [
    { title: "Name it and give it a face" },
    { title: "Describe how it thinks" },
    { title: "Feed it knowledge and openers" },
    { title: "Pick a model and save" }
]

export type PersonaValueBlock = {
    title: string
    description: string
    Icon: LucideIcon
}

export const personaValueBlocks: PersonaValueBlock[] = [
    {
        title: "The character never breaks",
        description:
            "Each thread snapshots its persona, so the voice never drifts — even if you edit the persona later or switch models.",
        Icon: ShieldCheck
    },
    {
        title: "Conversation starters, not a blank box",
        description:
            "Every persona ships with ready-made openers, so you're one tap from a conversation instead of staring at a cursor.",
        Icon: MessagesSquare
    },
    {
        title: "Give them a face",
        description:
            "Upload an avatar and short name, and your persona shows up with an identity across the picker and every chat.",
        Icon: PenLine
    }
]
