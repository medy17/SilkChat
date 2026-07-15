import { afterEach, describe, expect, it, vi } from "vitest"
import {
    downloadFalImage,
    getFalNonImageBillingDisposition,
    verifyFalWebhookSignature
} from "../../convex/fal_webhooks"

const bytesToHex = (bytes: ArrayBuffer) =>
    Array.from(new Uint8Array(bytes))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")

const bytesToBase64Url = (bytes: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(bytes)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "")

describe("fal webhooks", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("downloads fal media requesting identity encoding to reduce decode surface", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(new Uint8Array([1, 2, 3]), {
                status: 200,
                headers: {
                    "content-type": "image/png"
                }
            })
        )
        vi.stubGlobal("fetch", fetchMock)

        await expect(
            downloadFalImage({
                url: "https://v3b.fal.media/files/b/image.png",
                contentType: "image/png"
            })
        ).resolves.toMatchObject({
            bytes: new Uint8Array([1, 2, 3]),
            contentType: "image/png",
            extension: "png"
        })

        expect(fetchMock).toHaveBeenCalledWith("https://v3b.fal.media/files/b/image.png", {
            headers: {
                Accept: "image/png",
                "Accept-Encoding": "identity"
            }
        })
    })

    it("retries a transient body-decode failure before succeeding", async () => {
        const fetchMock = vi
            .fn()
            .mockRejectedValueOnce(new Error("error decoding response body"))
            .mockResolvedValueOnce(
                new Response(new Uint8Array([4, 5, 6]), {
                    status: 200,
                    headers: { "content-type": "image/png" }
                })
            )
        vi.stubGlobal("fetch", fetchMock)

        await expect(
            downloadFalImage({
                url: "https://v3b.fal.media/files/b/image.png",
                contentType: "image/png"
            })
        ).resolves.toMatchObject({
            bytes: new Uint8Array([4, 5, 6]),
            contentType: "image/png",
            extension: "png"
        })

        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("reconciles only Grok safety refusals", () => {
        expect(getFalNonImageBillingDisposition("refusal", "grok-imagine-image")).toEqual({
            status: "failed",
            shouldReconcileUsage: true
        })
        expect(getFalNonImageBillingDisposition("refusal", "grok-imagine-image-pro")).toEqual({
            status: "failed",
            shouldReconcileUsage: true
        })
        expect(getFalNonImageBillingDisposition("refusal", "gpt-5.4-image-2")).toEqual({
            status: "refunded",
            shouldReconcileUsage: false
        })
        expect(getFalNonImageBillingDisposition("error", "grok-imagine-image")).toEqual({
            status: "failed",
            shouldReconcileUsage: false
        })
        expect(getFalNonImageBillingDisposition("unknown", "grok-imagine-image")).toEqual({
            status: "unknown",
            shouldReconcileUsage: false
        })
    })

    it("verifies fal webhook signatures against JWKS public keys", async () => {
        const keyPair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])
        const publicKey = await crypto.subtle.exportKey("raw", keyPair.publicKey)
        const rawBody = JSON.stringify({
            request_id: "fal-request-1",
            status: "OK",
            payload: { images: [{ url: "https://v3b.fal.media/files/b/image.png" }] }
        })
        const requestId = "webhook-request-1"
        const userId = "fal-user-1"
        const timestamp = Math.floor(Date.now() / 1000).toString()
        const bodyHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody))
        const message = [requestId, userId, timestamp, bytesToHex(bodyHash)].join("\n")
        const signature = await crypto.subtle.sign(
            "Ed25519",
            keyPair.privateKey,
            new TextEncoder().encode(message)
        )
        const headers = new Headers({
            "X-Fal-Webhook-Request-Id": requestId,
            "X-Fal-Webhook-User-Id": userId,
            "X-Fal-Webhook-Timestamp": timestamp,
            "X-Fal-Webhook-Signature": bytesToHex(signature)
        })

        await expect(
            verifyFalWebhookSignature({
                rawBody,
                headers,
                getJwksKeys: async () => [bytesToBase64Url(publicKey)]
            })
        ).resolves.toBe(true)

        await expect(
            verifyFalWebhookSignature({
                rawBody: JSON.stringify({ request_id: "fal-request-1", status: "ERROR" }),
                headers,
                getJwksKeys: async () => [bytesToBase64Url(publicKey)]
            })
        ).resolves.toBe(false)
    })
})
