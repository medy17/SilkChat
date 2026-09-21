import dedent from "ts-dedent"
import type { AppSkillDefinition } from "./types"

export const webSearchSkill: AppSkillDefinition = {
    id: "web_search",
    label: "Web Search",
    summary:
        "Use only for explicit web requests, time-sensitive facts, external datasets or records needed for analysis, requested citations, or professional people lookups. Never load for a stable factual question merely because it is niche, technical, or worth verifying.",
    ability: "web_search",
    toolNames: ["web_search"],
    buildInstructions: () => dedent`
## Web Search Tool
Web search returns concise, source-linked results for one focused natural-language query or a small related query set per call. When an answer depends on current information, search instead of claiming that you lack real-time access or answering from potentially stale knowledge. Do not announce that you are about to search; use the tool and answer from its results.

Search for:
- Current events, recent news, live facts, statistics, schedules, prices, availability, or anything described as latest, newest, or current.
- Information that changes over time, including company and product details, people's current roles, service capabilities, plans, pricing, software documentation, APIs, and technology updates.
- Comparisons between named products, services, tools, platforms, or AI models whose capabilities may have changed.
- External datasets, measurements, records, or source documents needed for a specific comparison or analysis and not supplied in the conversation. Historical records can require retrieval even when they predate your knowledge cutoff.
- Quotes attributed to a specific person when the user's request requires their actual words.
- Current verification whenever a material fact may be stale or the user explicitly asks you to search, browse, verify, or look something up.

Do not search for:
- Creative writing, opinions, hypotheticals, or general coding help that does not depend on current product or library behavior.
- Stable general knowledge, definitions, well-established historical facts, or static lists that do not require retrieving records for a requested analysis.
- A factual question merely because it is niche, technical, taxonomic, medical-sounding, unfamiliar, or would benefit from authoritative sources. Uncertainty and a desire to verify are not sufficient reasons to search when the user did not ask for current information, sources, citations, browsing, or verification. Answer from knowledge and state material uncertainty when needed.
- Information already supplied in the conversation when no current verification is needed.
- Anything the user explicitly asks you not to search for.

Search procedure:
1. Start broad. For an ordinary current-information request, send only one focused natural-language query and leave every optional refinement unset. Include relevant names, terms, and absolute dates in the query itself when useful.
2. For a request mixing stable knowledge with current information, search only for the current portion and answer the stable portion from knowledge.
3. Add a country, language, domain, date, recency, result-count, or extraction-depth refinement only when the user explicitly asks for that boundary or it is clearly necessary to disambiguate the search. Do not infer a country from the subject, guess a source allowlist, or stack several refinements merely because they are available. A request for reliable or primary sources is a source-quality instruction, not permission to invent a domain allowlist.
4. One successful search call is the default and is usually sufficient. If a broad search returns noisy or irrelevant results, make at most one meaningfully refined follow-up instead of pre-emptively constraining the first search. Do not keep searching merely to chase a perfect or primary source unless the user requested that depth. Respect the current Tool Budget and avoid redundant calls.
5. Evaluate the returned titles, dates, snippets, and URLs. Prefer primary and authoritative sources; when reliable sources disagree, mention the disagreement briefly and favor the strongest and most current evidence.
6. Synthesize the answer directly, cite the claims supported by search results using the format below, and follow the user's requested scope and exact item count.

Refinement controls:
- Use \`searchType: "people"\` only for individual professional profiles, employee lookups, career history, or people matching work-related criteria. Use ordinary web search for general questions about public figures, executives, or leadership teams because it returns richer web results. People search supports up to 50 results; ordinary web search supports up to 20.
- People queries work best with identifying details such as names, titles, companies, departments, or locations. For broader coverage, use distinct query variants that include both abbreviations and full role names, such as "CTO" and "Chief Technology Officer".
- A single focused query with no optional filters is the default. Use a query array only when 2 to 5 independently useful angles materially improve coverage; keep the queries related and avoid redundant paraphrases.
- Use \`country\` for regional relevance and \`languages\` for ISO 639-1 content-language filtering. These refine different things and may be combined.
- Use \`domains\` for up to 20 domain or path filters. Entries without \`-\` form an allowlist; entries prefixed with \`-\` form a denylist. Never mix both modes.
- Use \`recency\` only when a relative publication window is material. Use the publication or last-updated date fields only for an explicitly requested or necessary exact MM/DD/YYYY boundary. Do not add both; the server favors exact dates if both appear.
- Leave extraction depth unset by default. Use \`contextSize\` (low, medium, or high) only when the task materially needs more or less page content. Use explicit token budgets only for rare cases needing precise control; the server favors \`contextSize\` if both appear.

Citation format:
- When web search contributes to the answer, cite factual claims with a numbered superscript link immediately after the sentence or clause it supports: \`A supported claim.<sup>[[1]](https://example.com/source)</sup>\`
- Number sources in the order they first appear, starting at 1. Reuse the same number whenever citing the same URL again; do not assign duplicate numbers to one source.
- A claim supported by multiple sources may include consecutive citations such as \`<sup>[[1]](https://example.com/one)</sup><sup>[[2]](https://example.com/two)</sup>\`.
- End the response with a \`### Sources\` appendix containing a numbered Markdown list in the same order. Each entry must use a descriptive title and the exact source URL, for example \`1. [Report title — Publisher](https://example.com/source)\`.
- Include only sources actually cited in the answer. Do not put uncited search results in the appendix, use bare URLs, or refer to sources only as "here" or "this link".
- Cite current or externally verified claims precisely without cluttering stable background knowledge or every sentence with citations.

Result limits and recovery:
- Search results are bounded extracts, not guaranteed full-page contents. Never imply that you opened or read an entire source when only a result snippet was returned.
- Give an exact quotation only when the returned text supports the exact words. Otherwise say that the available results did not verify the precise wording; do not manufacture or silently paraphrase a requested quote.
- Zero results means no sources were returned. Irrelevant, mismatched, or untrustworthy results mean the search did not resolve the question even if the result count is nonzero; state the specific mismatch and offer a more focused follow-up.
- If search fails, continue with any reliable information already available and clearly distinguish it from current facts that could not be verified.`
}
