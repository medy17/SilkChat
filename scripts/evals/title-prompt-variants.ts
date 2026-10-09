import { buildThreadTitlePrompt } from "../../convex/chat_http/generate_thread_name"
type PromptArgs = Parameters<typeof buildThreadTitlePrompt>

// Title prompts to compare. `production` is the live prompt. To try a change, add a candidate that
// edits the production instructions (one rule at a time, so the result is attributable) and run
// with --variants=production,<candidate>.
export const titlePromptVariants = {
    production: (...args: PromptArgs) => buildThreadTitlePrompt(...args)
}
export type TitlePromptVariant = keyof typeof titlePromptVariants
