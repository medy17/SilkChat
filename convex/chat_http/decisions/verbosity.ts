"use node"

import { choiceProbability, type ChoiceQuestion, type DecisionModel } from "../../lib/decisions"
import type { VerbositySelectionCalibration } from "../../lib/models"
import { DECISION_MODEL } from "../../lib/models/typesafe"
import type { Verbosity } from "../../schema/settings"
import { OPENING_REQUEST_RULES, type DecisionCaller } from "./engine"

type VerbositySelectionModel = DecisionModel & {
    verbositySelection: VerbositySelectionCalibration
}

export type OpeningVerbosity = { level: Verbosity; status: "complete" | "failed" }

type VerbosityOption = "shorter" | "usual" | "longer"

// One decision covers the conversation, so a bare greeting or opener must not
// lock it into short replies. "usual" is the no-change answer.
const VERBOSITY_QUESTION: ChoiceQuestion<VerbosityOption> = {
    type: "choice",
    instructions:
        "Judging from the opening `request`, should replies in this conversation be shorter or longer than a typical, moderately detailed chat answer? Consider the scope of the request and the kind of answer that would serve it best, including any stated preference for brevity or depth. Most requests need the usual length." +
        OPENING_REQUEST_RULES,
    criteria: {
        shorter:
            "Brief replies serve the request best: a quick factual lookup, a simple yes/no or one-step question, a short rewrite, or an explicit request for brevity.",
        usual: "A typical, moderately detailed reply fits; the request gives no clear signal either way; or it is only a greeting or opener with no substantive request yet.",
        longer: "Thorough, in-depth replies serve the request best: a complex explanation, a comprehensive guide or plan, an in-depth analysis or comparison, or an explicit request for depth or detail."
    }
}

export const createVerbosityCaller = ({
    model = DECISION_MODEL
}: {
    model?: VerbositySelectionModel
} = {}): DecisionCaller<{ verbosity: typeof VERBOSITY_QUESTION }, OpeningVerbosity> => ({
    questions: { verbosity: VERBOSITY_QUESTION },
    interpret: (answers) => {
        if (!answers) return { level: "default", status: "failed" }
        const { thresholds } = model.verbositySelection
        const answer = answers.verbosity
        const less = choiceProbability(answer, "shorter")
        const more = choiceProbability(answer, "longer")
        const level =
            less >= thresholds.less && less >= more
                ? "less"
                : more >= thresholds.more
                  ? "more"
                  : "default"
        return { level, status: "complete" }
    }
})

// An explicit setting always wins; unset means Auto, which follows the opening decision.
export const resolveVerbosity = (
    setting: Verbosity | undefined,
    opening: Pick<OpeningVerbosity, "level"> | undefined
): Exclude<Verbosity, "default"> | undefined => {
    const level = setting ?? opening?.level ?? "default"
    return level === "default" ? undefined : level
}
