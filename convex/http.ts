import { corsRouter } from "convex-helpers/server/cors"
import { httpRouter } from "convex/server"
import { getFile, uploadFile, uploadReferenceImage } from "./attachments"
import { authComponent, createAuth } from "./auth"
import { chatGET } from "./chat_http/get.route"
import { chatPOST } from "./chat_http/post.route"
import { chatDELETE } from "./chat_http/stop.route"
import { falImageWebhook } from "./fal_webhooks"
import { uploadImportSource } from "./import_jobs_http"
import { lemonSqueezyWebhook } from "./lemon_squeezy_http"
import { UPLOAD_POLICY_HEADER } from "./lib/file_constants"
import { uploadPersonaAvatar, uploadPersonaDoc } from "./persona_uploads"
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

// File upload route
cors.route({
    path: "/upload",
    method: "POST",
    handler: uploadFile
})

cors.route({
    path: "/upload/reference",
    method: "POST",
    handler: uploadReferenceImage
})

cors.route({
    path: "/upload/persona-avatar",
    method: "POST",
    handler: uploadPersonaAvatar
})

cors.route({
    path: "/upload/persona-doc",
    method: "POST",
    handler: uploadPersonaDoc
})

cors.route({
    path: "/import-upload",
    method: "POST",
    handler: uploadImportSource
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
