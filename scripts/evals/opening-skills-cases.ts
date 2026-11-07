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
        id: "roleplay-scene",
        text: "Let's roleplay. You play Monica, the getaway driver, and I'll play Adelle. Start outside the warehouse in the rain.",
        required: ["roleplay"]
    },
    {
        id: "roleplay-discussion",
        text: "Explain how dialogue and narration differ in roleplaying games.",
        forbidden: ["roleplay"]
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
        id: "showcase",
        text: "Show off what you can do here with math charts and code execution",
        required: ["math", "code_execution"]
    },
    {
        id: "holdout-demo-chart",
        text: "What can your charting do? Give me a few examples.",
        required: ["math"]
    },
    {
        id: "holdout-demo-runtime",
        text: "Let's take your code runner for a spin. Try something interesting.",
        required: ["code_execution"]
    },
    {
        id: "holdout-chart-advice",
        text: "Which kind of chart is best for showing proportions?",
        forbidden: ["math", "code_execution"]
    },
    {
        id: "holdout-sandbox-concept",
        text: "Explain how code execution sandboxes keep untrusted code isolated.",
        forbidden: ["code_execution", "math"]
    },
    {
        id: "holdout-capability-question",
        text: "Can you run code?",
        exploratory: true
    },
    {
        id: "holdout-manual",
        text: "Do not run code. Describe how to remove duplicate rows from a CSV.",
        forbidden: ["code_execution"]
    },
    // Hands-on work on a real project or account. Keep phrasing varied: these never say "run".
    {
        id: "computer-fix-issue",
        text: "Fix issue #3 on medy17/silky-computer-test and open a PR.",
        required: ["code_execution"]
    },
    {
        id: "computer-issue-link",
        text: "https://github.com/medy17/silky-computer-test/issues/3\n\nFix this",
        required: ["code_execution"]
    },
    {
        id: "computer-clone",
        text: "Clone github.com/acme/api, add rate limiting to the login route, and push it to a new branch.",
        required: ["code_execution"]
    },
    {
        id: "computer-continue",
        text: "Can you pick up where we left off on my notes app and finish the delete button?",
        required: ["code_execution"]
    },
    {
        id: "computer-debug-repo",
        text: "Here's my repo: https://github.com/acme/site. The homepage crashes on mobile, find out why and fix it.",
        required: ["code_execution"]
    },
    {
        id: "computer-dependencies",
        text: "Bump the dependencies in my project and make sure nothing broke.",
        required: ["code_execution"]
    },
    {
        id: "computer-new-project",
        text: "Start a new Next.js site for my bakery. We'll keep building on it over the next few weeks.",
        required: ["code_execution"]
    },
    {
        id: "computer-keep-files",
        text: "I'll send you one of these every month. Keep them together so we can track how sales change.",
        attachments: [{ type: "file", filename: "sales-october.csv", mimeType: "text/csv" }],
        required: ["code_execution"]
    },
    {
        id: "computer-commit",
        text: "Add the v2 notes to CHANGELOG.md in acme/api and commit it to main.",
        required: ["code_execution"]
    },
    {
        id: "computer-review-prs",
        text: "Go through the open PRs on acme/api and leave review comments.",
        required: ["code_execution"]
    },
    {
        id: "computer-account",
        text: "Use my Stripe key to pull last month's failed payments.",
        required: ["code_execution"]
    },
    // Holdouts, written after the question and never used to tune it.
    {
        id: "computer-holdout-deploy",
        text: "my vercel build keeps failing on github.com/acme/shop, sort it out",
        required: ["code_execution"]
    },
    {
        id: "computer-holdout-refactor",
        text: "Move the auth module in our monorepo over to the new session API.",
        required: ["code_execution"]
    },
    {
        id: "computer-holdout-new-repo",
        text: "Make a new GitHub repo for a little Python CLI that renames photos by date, and push a first version.",
        required: ["code_execution"]
    },
    {
        id: "computer-holdout-tests",
        text: "The billing module in my repo has no tests. Write some and get them green.",
        required: ["code_execution"]
    },
    {
        id: "computer-holdout-migrate",
        text: "Switch github.com/acme/tool from npm to pnpm.",
        required: ["code_execution"]
    },
    {
        id: "computer-holdout-dns",
        text: "Check my Cloudflare account and tell me which DNS records still point at the old server.",
        required: ["code_execution"]
    },
    {
        id: "computer-holdout-merge",
        text: "Merge the dependabot PRs on acme/web if CI is green.",
        required: ["code_execution"]
    },
    {
        id: "computer-holdout-resume",
        text: "Back to the survey cleanup from Tuesday. Where did we get to?",
        exploratory: true
    },
    {
        id: "computer-holdout-document",
        text: "Hold on to this thesis draft. We'll go through it chapter by chapter this month.",
        attachments: [{ type: "file", filename: "thesis.docx", mimeType: "application/msword" }],
        exploratory: true
    },
    {
        id: "computer-holdout-explain-repo",
        text: "What does github.com/acme/tool actually do?",
        exploratory: true
    },
    // Decoys: the same subjects, but the user wants an answer rather than the work done.
    {
        id: "computer-decoy-hook",
        text: "Write a React hook that debounces a value.",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy-how-pr",
        text: "How do I open a pull request on GitHub?",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy-git-error",
        text: "What does this mean: fatal: refusing to merge unrelated histories",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy-rebase",
        text: "What's the difference between rebase and merge?",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy-snippet-bug",
        text: "Is there a bug in this? function add(a, b) { return a - b }",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy-monorepo",
        text: "Should my startup use a monorepo?",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy-workflow",
        text: "Write me a GitHub Actions workflow that runs tests on push.",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy-plan",
        text: "Give me a plan for moving our repo from npm to pnpm. We'll do the work ourselves.",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy-conflict",
        text: "I've got a merge conflict in my project, how do I resolve it?",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy-snippet-edit",
        text: "Add error handling to this: const data = await fetch(url).then((r) => r.json())",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy-bakery",
        text: "What pages should a website for my bakery have?",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy-blog",
        text: "Write a short blog post about how our team fixed a nasty login bug last week.",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy-remember",
        text: "Remember that my main repo is acme/api.",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy-stripe",
        text: "How do Stripe failed payment retries work?",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy-commit-message",
        text: "Write a commit message for a change that adds rate limiting to login.",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy-forbidden",
        text: "Don't touch anything, just tell me how you'd approach issue #3 on acme/api.",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy-roleplay",
        text: "Pretend you're a grumpy senior engineer reviewing my first pull request.",
        forbidden: ["code_execution"]
    },
    // Second holdout round, written after the first scores and before choosing a threshold.
    {
        id: "computer-holdout2-link-only",
        text: "https://github.com/acme/api/pull/88 can you finish this off",
        required: ["code_execution"]
    },
    {
        id: "computer-holdout2-terse",
        text: "acme/web: dark mode is broken on the settings page",
        exploratory: true
    },
    {
        id: "computer-holdout2-same-project",
        text: "Same project as yesterday. Add CSV export to the reports page.",
        required: ["code_execution"]
    },
    {
        id: "computer-holdout2-lint",
        text: "Get the linter passing on my repo.",
        required: ["code_execution"]
    },
    {
        id: "computer-holdout2-release",
        text: "Tag a 1.4.0 release on acme/cli with notes from the last ten commits.",
        required: ["code_execution"]
    },
    {
        id: "computer-holdout2-scrape",
        text: "Build me a small scraper for these three job boards and keep it around so I can ask you to rerun it each week.",
        required: ["code_execution"]
    },
    {
        id: "computer-holdout2-openai-key",
        text: "Using my OpenAI key, see how much we spent on the API this month.",
        required: ["code_execution"]
    },
    {
        id: "computer-holdout2-typo",
        text: "theres a typo on the about page of my site repo, fix it pls",
        required: ["code_execution"]
    },
    {
        id: "computer-holdout2-readme",
        text: "Write a proper README for github.com/acme/tool and commit it.",
        required: ["code_execution"]
    },
    {
        id: "computer-holdout2-where-left",
        text: "What was the last thing we changed in the billing repo?",
        exploratory: true
    },
    {
        id: "computer-decoy2-how-you-would",
        text: "How would you structure the folders in a large Express project?",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy2-my-code",
        text: "My login route returns 500 when the password is empty. What usually causes that?",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy2-pasted-diff",
        text: "Review this diff:\n- const limit = 10\n+ const limit = req.query.limit",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy2-readme-paste",
        text: "Write a README for a CLI that renames photos by date. I'll paste it in myself.",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy2-pr-description",
        text: "Write a PR description for a change that adds dark mode to the settings page.",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy2-issue-template",
        text: "Draft a GitHub issue reporting that login fails on Safari.",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy2-compare-hosts",
        text: "Is Vercel or Cloudflare better for a small Next.js site?",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy2-account-howto",
        text: "How do I check which DNS records point at my old server in Cloudflare?",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy2-key-safety",
        text: "Is it safe to put my Stripe key in a GitHub repo?",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy2-about-feature",
        text: "Do you have a computer of your own?",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy2-recap",
        text: "Summarise what a pull request review should cover.",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy2-project-idea",
        text: "I want to build an app for tracking my plants. What should the first version do?",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy2-story",
        text: "Write a scene where a developer merges to main on a Friday and everything breaks.",
        forbidden: ["code_execution"]
    },
    // Hands-on work that belongs to another skill. The first wording of the computer question
    // selected these, because a photo is as real as a repository.
    {
        id: "computer-decoy3-photo",
        text: "Take the person out of the background of this picture.",
        attachments: [{ type: "image", filename: "beach.jpg", mimeType: "image/jpeg" }],
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy3-recolor",
        text: "Make the sofa in this image green.",
        attachments: [{ type: "image", filename: "room.png", mimeType: "image/png" }],
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy3-illustration",
        text: "Draw a poster of a fox reading under a tree.",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy3-forget",
        text: "Delete what you know about my old job.",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy3-remember",
        text: "Update my profile: I moved to Lisbon.",
        forbidden: ["code_execution"]
    },
    {
        id: "computer-decoy3-widget",
        text: "Give me a tip calculator I can play with right here.",
        forbidden: ["code_execution"]
    }
]
