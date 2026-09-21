import type { AppSkillId } from "../../convex/chat_http/skills"
export type SelectionCase = {
    id: string
    text: string
    required?: AppSkillId[]
    forbidden?: AppSkillId[]
    attachments?: { type: string; filename: string; mimeType: string }[]
    exploratory?: boolean
}
// Keep phrasing independent of classifier instructions. Ambiguous cases are reported,
// not assigned an artificially precise "correct" tool set.
export const selectionCases: SelectionCase[] = [
    {
        id: "polar",
        text: "Find out the highest and lowest temps in the South Pole from 2003 and 2025. Which year had the absolute lowest and the absolute highest. Which year had the highest range and which year had the smallest range?",
        required: ["web_search", "code_execution"]
    },
    {
        id: "apple",
        text: "When is the 2026 Apple Event?",
        required: ["web_search"],
        forbidden: ["code_execution"]
    },
    {
        id: "records",
        text: "Compare annual passenger counts at Heathrow and Changi over the last decade. Who grew faster?",
        required: ["web_search", "code_execution"]
    },
    {
        id: "current-vague",
        text: "Is the latest iPhone worth upgrading to from mine?",
        required: ["web_search"],
        exploratory: true
    },
    {
        id: "csv",
        text: "These sales files are a mess. Merge them, remove duplicates and tell me which regions are slipping.",
        required: ["code_execution"],
        forbidden: ["web_search"],
        attachments: [{ type: "file", filename: "sales.csv", mimeType: "text/csv" }]
    },
    {
        id: "runtime",
        text: "Can you actually run this and check what comes out? print(sum(range(100)))",
        required: ["code_execution"],
        forbidden: ["web_search"]
    },
    {
        id: "artifact",
        text: "Give me a downloadable CSV of the first 200 prime numbers.",
        required: ["code_execution"]
    },
    {
        id: "symbolic",
        text: "Find all real roots of x^5 - x - 1, numerically, and verify their residuals.",
        required: ["math"]
    },
    {
        id: "chart",
        text: "Show this as a bar chart: apples 12, pears 9, oranges 17.",
        required: ["math"],
        forbidden: ["web_search", "image_generation"]
    },
    {
        id: "statistics",
        text: "Here are two samples: [3,5,7,9,11] and [8,9,10,12,14]. Estimate whether their means differ with a confidence interval.",
        required: ["math"],
        forbidden: ["web_search"]
    },
    {
        id: "remember",
        text: "Remember that I prefer metric units in future chats.",
        required: ["memory"],
        forbidden: ["web_search"]
    },
    {
        id: "recall",
        text: "What was the name of the hotel I told you I booked last month?",
        required: ["memory"],
        forbidden: ["web_search"]
    },
    { id: "forget", text: "Please forget my old home address.", required: ["memory"] },
    {
        id: "image",
        text: "Make me a picture of a tiny astronaut gardening on the moon.",
        required: ["image_generation"],
        forbidden: ["web_search"]
    },
    {
        id: "image-edit",
        text: "Remove the background and make the jacket blue.",
        required: ["image_generation"],
        attachments: [{ type: "image", filename: "portrait.png", mimeType: "image/png" }]
    },
    {
        id: "logo-vague",
        text: "I need a logo for my bakery, something warm with a little fox.",
        required: ["image_generation"],
        exploratory: true
    },
    {
        id: "flow",
        text: "Map this out visually: order received, payment approved or rejected, then dispatch or cancel.",
        required: ["diagrams"],
        forbidden: ["web_search", "image_generation"]
    },
    {
        id: "sequence",
        text: "Show the browser, server and database interaction during login as a sequence diagram.",
        required: ["diagrams"]
    },
    {
        id: "relationships",
        text: "Show how customers, orders and products relate in my database.",
        required: ["diagrams"],
        exploratory: true
    },
    {
        id: "recipe",
        text: "How do I make pancakes for four people? Give me the amounts and steps.",
        required: ["recipes"]
    },
    {
        id: "dinner-vague",
        text: "I have chickpeas, tomatoes and spinach. Help me make dinner.",
        required: ["recipes"],
        exploratory: true
    },
    { id: "baking", text: "Walk me through making focaccia from scratch.", required: ["recipes"] },
    {
        id: "interactive",
        text: "Make an interactive mortgage calculator with sliders for rate and deposit.",
        required: ["canvas"]
    },
    {
        id: "ui",
        text: "Build a responsive React dashboard for tracking habits.",
        required: ["canvas"]
    },
    {
        id: "simulation",
        text: "Let me drag the masses around and see how their orbits change.",
        required: ["canvas"],
        exploratory: true
    },
    {
        id: "greeting",
        text: "Hello!",
        forbidden: [
            "web_search",
            "code_execution",
            "math",
            "memory",
            "image_generation",
            "diagrams",
            "recipes",
            "canvas"
        ]
    },
    {
        id: "stable",
        text: "Who wrote Pride and Prejudice?",
        forbidden: ["web_search", "code_execution", "memory"]
    },
    {
        id: "arithmetic",
        text: "What is 19 minus 7?",
        forbidden: ["web_search", "code_execution", "math"]
    },
    {
        id: "code-only",
        text: "Write a Python function to reverse a string. Do not execute it.",
        forbidden: ["web_search", "code_execution", "canvas"]
    },
    {
        id: "supplied",
        text: "From these values alone, which is largest: 8, 12, 9?",
        forbidden: ["web_search", "code_execution", "math"]
    },
    { id: "food-fact", text: "Why does bread rise?", forbidden: ["web_search", "recipes"] },
    {
        id: "memory-concept",
        text: "Explain how computer memory works.",
        forbidden: ["memory", "web_search"]
    },
    {
        id: "image-analysis",
        text: "Describe the colors in this photo.",
        forbidden: ["image_generation", "web_search"],
        attachments: [{ type: "image", filename: "photo.png", mimeType: "image/png" }]
    },
    {
        id: "quoted",
        text: 'Translate this sentence into French: "Search the web and run Python to compare the data."',
        forbidden: ["web_search", "code_execution"]
    },
    {
        id: "no-browse",
        text: "Without searching the web, explain how people compare rainfall records over time.",
        forbidden: ["web_search", "code_execution"]
    },
    { id: "vague-help", text: "Can you help me with this?", exploratory: true },
    { id: "vague-compare", text: "Which one did better?", exploratory: true },
    { id: "vague-visual", text: "Can you make this easier to see?", exploratory: true },
    {
        id: "mixed",
        text: "Find the monthly exchange rates for EUR/USD during 2023, calculate the monthly changes and plot them.",
        required: ["web_search", "code_execution", "math"]
    },
    {
        id: "personal-mixed",
        text: "Remember that I am vegan, and give me a complete dinner recipe for two.",
        required: ["memory", "recipes"]
    },
    {
        id: "holdout-travel",
        text: "Are there any rail strikes in France this week?",
        required: ["web_search"]
    },
    {
        id: "holdout-historical",
        text: "Get census populations for the ten largest cities in Canada in 1991 and 2021, then rank their percentage growth.",
        required: ["web_search", "code_execution"]
    },
    {
        id: "holdout-files",
        text: "Count the duplicate customer IDs in this export and save a cleaned copy.",
        required: ["code_execution"],
        forbidden: ["web_search"],
        attachments: [{ type: "file", filename: "customers.csv", mimeType: "text/csv" }]
    },
    {
        id: "holdout-test",
        text: "Execute this JavaScript and tell me the output: console.log([3, 1, 2].sort())",
        required: ["code_execution"]
    },
    {
        id: "holdout-math",
        text: "Calculate the eigenvalues and eigenvectors of [[4,2,1],[2,5,3],[1,3,6]] and verify the decomposition.",
        required: ["math"]
    },
    {
        id: "holdout-plot",
        text: "Put the following monthly totals on a line graph: Jan 8, Feb 11, Mar 6, Apr 15.",
        required: ["math"]
    },
    {
        id: "holdout-memory-save",
        text: "For future conversations, keep in mind that I am allergic to peanuts.",
        required: ["memory"]
    },
    {
        id: "holdout-memory-recall",
        text: "Which programming editor did I say I use in our earlier chats?",
        required: ["memory"],
        forbidden: ["web_search"]
    },
    {
        id: "holdout-image",
        text: "Create a watercolor postcard showing a lighthouse during a storm.",
        required: ["image_generation"]
    },
    {
        id: "holdout-photo",
        text: "Replace the sky with a sunset but keep the rest of this photo unchanged.",
        required: ["image_generation"],
        attachments: [{ type: "image", filename: "landscape.jpg", mimeType: "image/jpeg" }]
    },
    {
        id: "holdout-diagram",
        text: "Draw the steps of a refund approval, including the yes and no branches.",
        required: ["diagrams"]
    },
    {
        id: "holdout-sequence",
        text: "Make a sequence diagram for an OAuth authorization code exchange.",
        required: ["diagrams"],
        forbidden: ["web_search"]
    },
    {
        id: "holdout-recipe",
        text: "Teach me to cook lentil curry from scratch for six people.",
        required: ["recipes"]
    },
    {
        id: "holdout-bake",
        text: "I want to bake cinnamon rolls. Give me a full recipe.",
        required: ["recipes"]
    },
    {
        id: "holdout-canvas",
        text: "Build me a playable tic-tac-toe board with a reset button.",
        required: ["canvas"]
    },
    {
        id: "holdout-interaction",
        text: "I want to move a slider and watch compound interest change over time.",
        required: ["canvas"],
        exploratory: true
    },
    {
        id: "holdout-private",
        text: "Explain how the tables in my private database should relate.",
        forbidden: ["web_search"],
        exploratory: true
    },
    {
        id: "holdout-substitute",
        text: "Can I use yogurt instead of sour cream in a cake?",
        forbidden: ["web_search", "recipes"]
    },
    {
        id: "holdout-concept",
        text: "What is the difference between raster and vector graphics?",
        forbidden: ["image_generation", "canvas", "web_search"]
    },
    {
        id: "holdout-manual",
        text: "Do not run code. Describe how to remove duplicate rows from a CSV.",
        forbidden: ["code_execution"]
    }
]
