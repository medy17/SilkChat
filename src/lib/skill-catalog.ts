import type { SkillCategory, StoreSkill } from "@/components/skills/skill-types"

// The store's shelves. The store's own rankings lean toward coding agents, so these are
// picked and ordered by hand for a chat app. Each entry was checked against its repository;
// the descriptions are ours, shortened from the skill's own.

const skill = (repo: string, path: string, name: string, description: string): StoreSkill => ({
    repo,
    path,
    name,
    description,
    curated: true
})

const ANTHROPIC = "anthropics/skills"
const MARKETING = "coreyhaines31/marketingskills"
const SCIENCE = "K-Dense-AI/claude-scientific-skills"
const SUPERPOWERS = "obra/superpowers"
const WONDELAI = "wondelai/skills"

const inSkills = (repo: string, name: string, description: string) =>
    skill(repo, `skills/${name}`, name, description)

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
        id: "writing",
        title: "Writing",
        skills: [
            inSkills(MARKETING, "copywriting", "Write or rewrite copy for a web page."),
            inSkills(MARKETING, "copy-editing", "Tighten and proofread existing text."),
            inSkills(ANTHROPIC, "internal-comms", "Status reports, updates, and announcements."),
            skill(WONDELAI, "made-to-stick", "made-to-stick", "Make an idea easy to remember."),
            inSkills(
                MARKETING,
                "content-strategy",
                "Decide what to write about, and in what order."
            )
        ]
    },
    {
        id: "research",
        title: "Research",
        skills: [
            inSkills(SCIENCE, "literature-review", "Survey the published work on a question."),
            inSkills(SCIENCE, "citation-management", "Find, check, and format references."),
            inSkills(MARKETING, "customer-research", "Run or make sense of customer research."),
            inSkills(SCIENCE, "peer-review", "Review a paper or grant the way a referee would."),
            inSkills(
                MARKETING,
                "competitor-profiling",
                "Research what competitors charge and claim."
            ),
            inSkills(
                SCIENCE,
                "hypothesis-generation",
                "Turn observations into testable hypotheses."
            )
        ]
    },
    {
        id: "data",
        title: "Data",
        skills: [
            inSkills(
                SCIENCE,
                "exploratory-data-analysis",
                "Profile a dataset and report what stands out."
            ),
            inSkills(
                SCIENCE,
                "statistical-analysis",
                "Pick the right test, run it, and explain it."
            ),
            inSkills(SCIENCE, "matplotlib", "Plot publication-quality charts."),
            inSkills(SCIENCE, "polars", "Query tables too big for a spreadsheet."),
            inSkills(MARKETING, "ab-testing", "Plan an A/B test and read its result.")
        ]
    },
    {
        id: "design",
        title: "Design",
        skills: [
            inSkills(ANTHROPIC, "frontend-design", "Design interfaces that don't look templated."),
            skill(WONDELAI, "web-typography", "web-typography", "Choose, pair, and set typefaces."),
            skill(
                WONDELAI,
                "refactoring-ui",
                "refactoring-ui",
                "Fix a design with practical rules."
            ),
            inSkills(ANTHROPIC, "canvas-design", "Compose posters and artwork as PNG or PDF."),
            inSkills(ANTHROPIC, "theme-factory", "Apply one color and type theme throughout.")
        ]
    },
    {
        id: "coding",
        title: "Coding",
        skills: [
            inSkills(
                SUPERPOWERS,
                "systematic-debugging",
                "Find the root cause before changing code."
            ),
            inSkills(SUPERPOWERS, "test-driven-development", "Write the failing test first."),
            inSkills(SUPERPOWERS, "writing-plans", "Break a change into small, checkable steps."),
            inSkills(ANTHROPIC, "mcp-builder", "Build Model Context Protocol servers."),
            skill(
                "vercel-labs/agent-skills",
                "skills/react-best-practices",
                "vercel-react-best-practices",
                "Performance rules for React and Next.js."
            )
        ]
    }
]
