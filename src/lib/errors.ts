export type ErrorType =
    | "bad_model"
    | "bad_request"
    | "unauthorized"
    | "forbidden"
    | "not_found"
    | "rate_limit"
    | "offline"

export type Surface = "chat" | "auth" | "api" | "stream" | "database"
export type ErrorCode = `${ErrorType}:${Surface}`

export type ErrorVisibility = "response" | "log" | "none"

/**
 * A cheaper/larger-context model the backend determined would accept this
 * thread, offered as a one-click switch on a context-limit error.
 */
export type SuggestedModel = {
    id: string
    name: string
}

/**
 * Machine-readable detail attached to a chat error so the client can render a
 * specific, actionable message (e.g. "out of Pro credits") instead of a generic
 * "something went wrong" block.
 */
export type ChatErrorDetail =
    | {
          kind: "credits_exhausted"
          bucket: "pro" | "basic"
          used?: number
          limit?: number
          remaining?: number
      }
    | {
          kind: "plan_required"
          requiredPlan: "free" | "pro"
          currentPlan?: "free" | "pro"
          feature?: "chat" | "image" | "tool"
      }
    | {
          kind: "context_limit_exceeded"
          limitType: "hosted" | "model"
          estimatedTokens: number
          limitTokens: number
          modelId: string
          canUseByok?: boolean
          /** Cheaper/larger models that would accept this thread, if any. */
          suggestedModels?: SuggestedModel[]
      }

export const visibilityBySurface: Record<Surface, ErrorVisibility> = {
    database: "log",
    chat: "response",
    auth: "response",
    stream: "response",
    api: "response"
}

export class ChatError extends Error {
    public type: ErrorType
    public surface: Surface
    public statusCode: number
    public cause?: string
    public detail?: ChatErrorDetail

    constructor(errorCode: ErrorCode, cause?: string, detail?: ChatErrorDetail) {
        super()

        const [type, surface] = errorCode.split(":")

        this.type = type as ErrorType
        this.cause = cause
        this.detail = detail
        this.surface = surface as Surface
        this.message = getMessageByErrorCode(errorCode)
        this.statusCode = getStatusCodeByType(this.type)
    }

    public toResponse() {
        const code: ErrorCode = `${this.type}:${this.surface}`
        const visibility = visibilityBySurface[this.surface]

        const { message, cause, detail, statusCode } = this

        if (visibility === "log") {
            console.error({
                code,
                message,
                cause
            })

            return Response.json(
                { code: "", message: "Something went wrong. Please try again later." },
                {
                    status: statusCode,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                        "Access-Control-Allow-Headers":
                            "Content-Type, Authorization, X-Requested-With"
                    }
                }
            )
        }

        return Response.json({ code, message, cause, detail }, { status: statusCode })
    }
}

/** Shape of the JSON body returned by {@link ChatError.toResponse} for visible errors. */
export type ParsedChatError = {
    code: string
    message: string
    cause?: string
    detail?: ChatErrorDetail
}

/**
 * The AI SDK surfaces a failed chat request as an `Error` whose `message` is the
 * raw response body. Parse that back into the structured payload the backend
 * sent so the UI can render a specific reason. Falls back to a plain-text error
 * when the body is not our JSON contract.
 */
export function parseChatError(error: unknown): ParsedChatError | null {
    if (!error) return null

    const raw = error instanceof Error ? error.message : typeof error === "string" ? error : ""

    if (!raw) return null

    try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === "object" && typeof parsed.message === "string") {
            return parsed as ParsedChatError
        }
    } catch {
        // Not JSON — treat the whole message as the human-readable error.
    }

    return { code: "", message: raw }
}

export function getMessageByErrorCode(errorCode: ErrorCode): string {
    if (errorCode.includes("database")) {
        return "An error occurred while executing a database query."
    }

    switch (errorCode) {
        case "bad_request:api":
            return "The request couldn't be processed. Please check your input and try again."

        case "unauthorized:auth":
            return "You need to sign in before continuing."
        case "forbidden:auth":
            return "Your account does not have access to this feature."

        case "rate_limit:chat":
            return "You have exceeded your maximum number of messages for the day. Please try again later."
        case "not_found:chat":
            return "The requested chat was not found. Please check the chat ID and try again."
        case "forbidden:chat":
            return "This chat belongs to another user. Please check the chat ID and try again."
        case "unauthorized:chat":
            return "You need to sign in to view this chat. Please sign in and try again."
        case "offline:chat":
            return "We're having trouble sending your message. Please check your internet connection and try again."

        case "bad_model:api":
            return "The model you selected does not exist. Please select a different model and try again."

        default:
            return "Something went wrong. Please try again later."
    }
}

function getStatusCodeByType(type: ErrorType) {
    switch (type) {
        case "bad_request":
            return 400
        case "unauthorized":
            return 401
        case "forbidden":
            return 403
        case "not_found":
            return 404
        case "rate_limit":
            return 429
        case "offline":
            return 503
        default:
            return 500
    }
}
