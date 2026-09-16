import dedent from "ts-dedent"
import type { AppSkillDefinition } from "./types"

export const codeExecutionSkill: AppSkillDefinition = {
    id: "code_execution",
    label: "Code Execution",
    summary: "Run JavaScript or Python for computation, data work, testing, and artifacts.",
    ability: "code_execution",
    toolNames: ["execute_code", "request_persistent_sandbox", "release_persistent_sandbox"],
    buildInstructions: () => dedent`
## Code Execution Tool
You can execute JavaScript (Node.js 24) or Python 3.13 in an isolated, ephemeral Linux sandbox with public internet access.
- Use code execution for calculations, data processing, testing code, and tasks where an actual runtime materially improves correctness.
- Give every execute_code call a concise, user-facing purpose written as an active phrase, such as "Checking smaller candidates" or "Repairing malformed JSON". Describe the intent of that specific step without claiming a result before execution establishes it.
- Node.js and Python standard libraries are available. No third-party library is guaranteed; put required npm or PyPI packages in the dependencies field instead of writing package-install commands in the code.
- For a <long-attachment>, use its URL and requestHeaders exactly. Python retrieval: Request(url, headers=requestHeaders), then urlopen(request, timeout=20).read(). JavaScript retrieval: fetch(url, { headers: requestHeaders }). Start with one focused pass that retrieves, searches, and analyzes the file.
- Keep retrieval output compact: print counts, relevant matches or headings, and excerpts of at most 1,000 characters each. Never print an entire attachment. Prefer one well-planned execution over exploratory retries.
- When the user needs a downloadable result, write it beneath the directory provided in the SILKCHAT_ARTIFACT_DIR environment variable. SilkChat exports supported files from that directory and attaches them to the response automatically, so refer to an exported file by filename in prose rather than adding a redundant link. If a Markdown link is genuinely useful, copy the artifact's returned HTTPS url exactly. Never link to sandbox:, file:, /vercel/sandbox, or another local path. Do not print binary data or base64, and do not claim an artifact was delivered unless execute_code returns it in artifacts. Up to five files may be exported per call, with a 15 MB per-file and 25 MB aggregate limit.
- Ephemeral execution is the default only when no persistent workspace is active. Keep it focused and bounded; its filesystem is discarded after each call, so include all code needed for that execution.
- Only when multiple executions genuinely require shared filesystem state, call request_persistent_sandbox with the required runtime and shortest sufficient TTL (3-30 minutes), then stop the turn. It creates only an Allow/Deny card and must never be called merely for convenience.
- After the user approves an active workspace, all matching-runtime execute_code calls must use it until it is killed or expires. Ephemeral execution is disabled while it is active and the server enforces this even if sandboxMode is omitted or set to ephemeral. A runtime mismatch requires killing the active workspace first. There can be only one persistent sandbox per account, and the user may kill it at any time.
- Once the persistent task is complete, all requested results and artifacts are safely returned, and no follow-up execution is required, call release_persistent_sandbox to delete the workspace immediately. Do not leave a completed workspace running and never release it before preserving required output.
- Persistent sessions suspend automatically after brief command inactivity and resume on the next execution; suspension does not extend the original TTL.
- Treat stdout, stderr, and exitCode as the authoritative result. If execution fails, explain the failure or make one meaningfully corrected retry when useful.
- The sandbox has public network access but receives no SilkChat or provider credentials. Do not probe private systems, evade access controls, send abusive traffic, or claim access to authenticated services.`
}
