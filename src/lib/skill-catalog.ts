import type { SkillCategory, StoreSkill } from "@/components/skills/skill-types"

// The store's shelves. The store's own rankings lean toward coding agents, so these are
// picked and ordered by hand for a chat app. A skill earns a place by adding something a
// model doesn't already do unprompted: a file format, a craft method, or a niche. It also has
// to work in a chat, so nothing here needs its scripts, a local tool, or another agent, and
// none repeats a built-in skill or persona. Each entry was checked against its repository;
// the descriptions are ours, shortened from the skill's own.

const skill = (repo: string, path: string, name: string, description: string): StoreSkill => ({
    repo,
    path,
    name,
    description,
    curated: true
})

const ANTHROPIC = "anthropics/skills"
const STORY = "danjdewhurst/story-skills"
const WONDELAI = "wondelai/skills"
// One author's library, filed by subject several folders deep.
const WYNIA = "jwynia/agent-skills"
const WYNIA_FICTION = "skills/creative/fiction"

const inSkills = (repo: string, name: string, description: string) =>
    skill(repo, `skills/${name}`, name, description)

const wynia = (folder: string, name: string, description: string) =>
    skill(WYNIA, `${folder}/${name}`, name, description)

export const SKILL_CATALOG: SkillCategory[] = [
    {
        id: "documents",
        title: "Documents",
        skills: [
            inSkills(ANTHROPIC, "docx", "Create, read, and edit Word documents."),
            inSkills(ANTHROPIC, "pdf", "Read, fill in, merge, and split PDF files."),
            inSkills(ANTHROPIC, "xlsx", "Build and fix spreadsheets with working formulas."),
            inSkills(ANTHROPIC, "pptx", "Create and edit PowerPoint presentations."),
            inSkills(ANTHROPIC, "doc-coauthoring", "Write a long document together, step by step.")
        ]
    },
    {
        id: "fiction",
        title: "Fiction",
        skills: [
            wynia(
                `${WYNIA_FICTION}/application`,
                "flash-fiction",
                "Tighten stories under 1,500 words."
            ),
            inSkills(STORY, "scene-craft", "Plan a scene's structure, subtext, and opening."),
            wynia(
                `${WYNIA_FICTION}/character`,
                "character-arc",
                "Work out how a character changes, and why."
            ),
            inSkills(
                STORY,
                "genre-craft",
                "Meet the conventions of mystery, romance, horror, and more."
            ),
            wynia(
                `${WYNIA_FICTION}/structure`,
                "key-moments",
                "Build a story around its emotional high points."
            ),
            inSkills(
                "jamesrochabrun/skills",
                "kids-book-writer",
                "Write picture books and rhymes for ages 2 to 9."
            )
        ]
    },
    {
        id: "verse-comedy-music",
        title: "Verse, comedy, and music",
        skills: [
            inSkills(STORY, "verse-craft", "Write poems that scan, from sonnets to limericks."),
            wynia(
                "skills/creative/humor",
                "joke-engineering",
                "Work out why a joke falls flat and fix it."
            ),
            skill(
                "joelborellis/Screenplay-mockumentary",
                ".claude/skills/screenplay",
                "mockumentary-screenplay",
                "Write mockumentary scenes in screenplay format."
            ),
            wynia(
                "skills/creative/music",
                "lyric-diagnostic",
                "Find what's off in a lyric's rhyme, stress, or imagery."
            ),
            wynia(
                "skills/creative/music",
                "musical-dna",
                "Describe an artist's sound without naming them."
            ),
            skill(
                "bfollington/terma",
                "plugins/tsal/skills/strudel",
                "strudel",
                "Compose live-coded music to play in the browser."
            )
        ]
    },
    {
        id: "worlds-games",
        title: "Worlds and games",
        skills: [
            wynia(
                `${WYNIA_FICTION}/worldbuilding`,
                "systemic-worldbuilding",
                "Trace how one change reshapes a whole world."
            ),
            wynia(
                `${WYNIA_FICTION}/worldbuilding`,
                "belief-systems",
                "Design religions and the institutions around them."
            ),
            wynia(
                `${WYNIA_FICTION}/worldbuilding`,
                "settlement-design",
                "Lay out cities and towns that grew over time."
            ),
            wynia(
                `${WYNIA_FICTION}/worldbuilding`,
                "language-evolution",
                "Give a world language families and dialects."
            ),
            wynia(
                `${WYNIA_FICTION}/application`,
                "interactive-fiction",
                "Make choices matter in a branching story."
            ),
            wynia(
                "skills/tech/game-development/design",
                "abstract-strategy",
                "Design a board game with no luck in it."
            )
        ]
    },
    {
        id: "research",
        title: "Research",
        skills: [
            inSkills(
                "K-Dense-AI/scientific-agent-skills",
                "peer-review",
                "Review a paper or grant the way a referee would."
            ),
            wynia(
                "skills/general/research/verification",
                "claim-investigation",
                "Take a viral claim apart and check each piece."
            ),
            skill(
                "sliday/genealogy-research",
                "",
                "genealogy-research",
                "Trace a family tree from records and scans."
            ),
            wynia(
                "skills/general/writing/analysis",
                "blind-spot-detective",
                "Find what a piece of non-fiction leaves out."
            ),
            wynia(
                "skills/general/analysis",
                "technology-impact",
                "Weigh what a new technology changes, and for whom."
            )
        ]
    },
    {
        id: "design",
        title: "Design",
        skills: [
            inSkills(ANTHROPIC, "frontend-design", "Design interfaces that don't look templated."),
            inSkills(ANTHROPIC, "canvas-design", "Compose posters and artwork as PNG or PDF."),
            inSkills(
                ANTHROPIC,
                "algorithmic-art",
                "Make generative art in p5.js with adjustable settings."
            ),
            skill(WONDELAI, "web-typography", "web-typography", "Choose, pair, and set typefaces."),
            inSkills(ANTHROPIC, "theme-factory", "Apply one color and type theme throughout.")
        ]
    },
    {
        id: "odds-and-ends",
        title: "Odds and ends",
        skills: [
            skill(
                "blader/humanizer",
                "",
                "humanizer",
                "Rewrite AI-sounding text so it reads like a person."
            ),
            skill(
                WONDELAI,
                "negotiation",
                "negotiation",
                "Prepare for a negotiation, from salary to contracts."
            ),
            wynia("skills/general/ideation", "naming", "Name a product, a place, or a character."),
            wynia(
                `${WYNIA_FICTION}/application`,
                "sleep-story",
                "Write a story meant to send someone to sleep."
            ),
            wynia(
                "skills/general/communication",
                "speech-adaptation",
                "Rework written text to be heard, not read."
            ),
            inSkills(
                "rhavekost/author-toolkit",
                "narrative-nonfiction",
                "Shape a memoir or self-help book around a story."
            )
        ]
    }
]
