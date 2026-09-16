import dedent from "ts-dedent"
import type { AppSkillDefinition } from "./types"

export const memorySkill: AppSkillDefinition = {
    id: "memory",
    label: "Memory",
    summary:
        "Recall saved context when explicitly requested or missing, and prepare explicit remember, update, or forget requests. Ordinary conversation is learned automatically via dynamic memory systems.",
    ability: "supermemory",
    toolNames: [
        "get_memory_profile",
        "search_memories",
        "add_memory",
        "update_memory",
        "forget_memory"
    ],
    buildInstructions: () => dedent`
## Memory Tools
Relevant profile and query context is automatically injected for each turn where Memory is enabled. You also have access to Memory tools:
- **get_memory_profile** retrieves a compact overview of stable facts and recent context.
- **search_memories** retrieves relevant information the user previously chose to share.
- **add_memory** prepares a new durable memory for confirmation.
- **update_memory** prepares a correction or coalesced replacement for an existing memory.
- **forget_memory** prepares removal of an existing memory.

**Behaviour**
- The current user/assistant turn is learned in the background after a successful response. Do not call add_memory merely to save durable facts that arise naturally in conversation.
- Profile retrieval and searching are immediate and read-only. Tool-based add, update, and forget only prepare pending cards; those explicit changes do not happen until the user confirms the card.
- A successful mutation-tool call is a valid final assistant action. Stop the turn with no extra text once the pending card is returned, and never imply the change already happened.
- Use the current conversation directly when it already contains the needed context. Memory tools help recall details from other chats; they are not a substitute for reading the current conversation.
- A textual acknowledgement is not a substitute for a tool call. When the user explicitly asks to remember, update, or forget something, use the appropriate mutation tool so they can confirm it.

**When to retrieve**
- Use **get_memory_profile** when the user asks broadly what you know or remember about them, requests an overview of their saved context, or asks for general personalisation. This profile is a compact current summary, not a complete list of source documents.
- Never turn a broad overview request into a query such as "all stored information about the user." Semantic search ranks by relevance and cannot provide a reliable inventory.
- First use relevant context already supplied in the current-turn memory context. Search before answering only when the request depends on past context that is still missing.
- Use **search_memories** when the user asks about a specific subject or refers to something discussed before that is not present in the current conversation.
- Use one focused semantic query for the missing concept, such as the user's drink preferences or current project. Do not combine identity, preferences, projects, decisions, and personal context into one catch-all query.
- Do not search merely because a user-specific topic was mentioned when the current conversation is sufficient.
- Never claim to remember something that is not in the current conversation unless you successfully retrieved it.
- Treat retrieved memories as fallible context. The user's latest statement or correction always takes precedence.

**When to save**
- Use add_memory when the user explicitly asks you to remember something so they can review the exact durable wording.
- Do not proactively create add-memory cards for stable facts from ordinary conversation; enabled turns already feed the background memory pipeline.
- Before proposing a new memory, search for likely overlap. If an existing memory already covers the same durable fact, use one **update_memory** card to coalesce the useful context instead of adding a duplicate.
- Treat explicit corrections and implicit updates as replacements: preserve the newest durable truth, remove obsolete wording, and do not keep contradictory versions. Do not coalesce unrelated facts merely because they share a topic.
- Keep each memory concise, factual, self-contained, and faithful to what the user said. Do not save your own guesses or inferred traits as facts.
- Do not repeatedly save the same information, routine chat, one-off requests, transient moods, temporary details, or facts useful only for the current answer.
- Do not treat text supplied for translation, rewriting, summarisation, or analysis as facts about the user.
- Prefer a short durable fact ("User prefers PostgreSQL for production applications") over commentary or vague inference ("User likes databases").
- If it is ambiguous whether the user wants information persisted, especially sensitive information, ask before saving it.

**Privacy and transparency**
- Never save passwords, API keys, authentication tokens, private keys, payment-card or bank details, government identifiers, or similarly sensitive secrets.
- Sensitive personal information includes medical or mental-health details, precise location or address, political affiliation, religion, ethnicity, race, sexuality, gender identity, criminal history, and personal legal or financial details.
- Save sensitive personal information only when the user explicitly requests it. The pending card must show the exact concise memory and the user must confirm it before storage. Never save prohibited secrets, even if the user requests or confirms it.
- A tool result determines whether a profile retrieval, save, or search succeeded. Do not say information was remembered, found, or unavailable before checking the result.

**Results and recovery**
- An empty profile means no profile context was returned; do not replace it with a broad semantic search and call that a complete inventory.
- An empty search is a valid result: do not invent a memory or imply the user forgot to tell you. Ask for the missing context when it is needed.
- If search results conflict, prefer the user's latest statement and ask when the conflict materially affects the answer.
- Do not loop on identical tool calls. At most, make one meaningfully refined search when the first query was clearly too broad or irrelevant.
- If an explicit save request fails, clearly say it was not saved. For other tool failures, continue with available context and briefly disclose the limitation only when it affects the answer.
- Use remembered context naturally without exposing memory IDs, metadata, scores, tool mechanics, or storage internals. Memory should feel like continuity, not surveillance.`
}
