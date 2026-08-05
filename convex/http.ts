import { corsRouter } from "convex-helpers/server/cors"
import { httpRouter } from "convex/server"
import { getFile } from "./attachments"
import { authComponent, createAuth } from "./auth"
import { chatGET } from "./chat_http/get.route"
import { chatPOST } from "./chat_http/post.route"
import { chatDELETE } from "./chat_http/stop.route"
import { completeDirectUpload, createDirectUpload } from "./direct_uploads"
import { falImageWebhook } from "./fal_webhooks"
import { lemonSqueezyWebhook } from "./lemon_squeezy_http"
import { UPLOAD_POLICY_HEADER } from "./lib/file_constants"
import { getPrivateBlur } from "./private_blur"
import { transcribeAudio } from "./speech_to_text"

const normalizeOrigin = (value?: string) => {
    if (!value) return undefined
    return value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`
}

const http = httpRouter()
const isPrivateBlurEnabled = process.env.LOCAL_DISABLE_PRIVATE_BLUR !== "1"
authComponent.registerRoutesLazy(http, createAuth)
const cors = corsRouter(http, {
    allowedOrigins: [
        normalizeOrigin(process.env.VITE_BETTER_AUTH_URL),
        normalizeOrigin(process.env.VERCEL_URL),
        "http://localhost:3000",
        "https://localhost:3000"
    ].filter(Boolean) as string[],
    allowedHeaders: ["Content-Type", "Authorization", UPLOAD_POLICY_HEADER],
    exposedHeaders: [UPLOAD_POLICY_HEADER],
    allowCredentials: true
})

http.route({
    path: "/webhooks/lemon-squeezy",
    method: "POST",
    handler: lemonSqueezyWebhook
})

http.route({
    path: "/webhooks/fal",
    method: "POST",
    handler: falImageWebhook
})

cors.route({
    path: "/chat",
    method: "POST",
    handler: chatPOST
})

cors.route({
    path: "/chat",
    method: "GET",
    handler: chatGET
})

cors.route({
    path: "/chat",
    method: "DELETE",
    handler: chatDELETE
})

cors.route({
    path: "/upload/create",
    method: "POST",
    handler: createDirectUpload
})

cors.route({
    path: "/upload/complete",
    method: "POST",
    handler: completeDirectUpload
})

// Speech-to-text route
cors.route({
    path: "/transcribe",
    method: "POST",
    handler: transcribeAudio
})

cors.route({
    path: "/r2",
    method: "GET",
    handler: getFile
})

if (isPrivateBlurEnabled) {
    cors.route({
        path: "/private-blur",
        method: "GET",
        handler: getPrivateBlur
    })
}

export default http
