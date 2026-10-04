"use node"

import { lookup } from "node:dns/promises"
import { request } from "node:https"

export const isPublicImageIPv4 = (address: string) => {
    const octets = address.split(".").map(Number)
    if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
        return false
    const [a, b, c] = octets
    return !(
        a === 0 ||
        a === 10 ||
        a === 127 ||
        a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
        (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
        (a === 203 && b === 0 && c === 113)
    )
}

// Pin the checked DNS address on every redirect. Never fetch arbitrary publisher
// URLs with an unbounded fetch or allow DNS rebinding into the deployment network.
export const fetchVisualImage = (input: string, options: { timeoutMs?: number } = {}) =>
    fetchImage(input, 0, Date.now() + (options.timeoutMs ?? 12_000))

const fetchImage = async (
    input: string,
    redirects: number,
    deadline: number
): Promise<Uint8Array> => {
    const url = new URL(input)
    if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        (url.port && url.port !== "443") ||
        redirects > 3
    )
        throw new Error("Unsupported image URL")
    let dnsTimer: ReturnType<typeof setTimeout> | undefined
    const addresses = await Promise.race([
        lookup(url.hostname, { family: 4, all: true }),
        new Promise<never>((_, reject) => {
            dnsTimer = setTimeout(
                () => reject(new Error("Image lookup timed out")),
                Math.max(1, deadline - Date.now())
            )
        })
    ]).finally(() => clearTimeout(dnsTimer))
    if (!addresses.length || addresses.some(({ address }) => !isPublicImageIPv4(address)))
        throw new Error("Unsupported image host")
    const maxBytes = 12 * 1024 * 1024
    return await new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => req.destroy(new Error("Image download timed out")),
            Math.max(1, deadline - Date.now())
        )
        const req = request(
            url,
            {
                lookup: (_hostname, options, callback) =>
                    options.all
                        ? callback(
                              null,
                              addresses.map((a) => ({ address: a.address, family: 4 }))
                          )
                        : callback(null, addresses[0].address, 4),
                headers: {
                    Accept: "image/*",
                    "Accept-Encoding": "identity",
                    "User-Agent": "SilkChat-ImageSearch/1.0"
                }
            },
            (res) => {
                if (
                    res.statusCode &&
                    [301, 302, 303, 307, 308].includes(res.statusCode) &&
                    res.headers.location
                ) {
                    res.resume()
                    clearTimeout(timer)
                    fetchImage(
                        new URL(res.headers.location, url).toString(),
                        redirects + 1,
                        deadline
                    ).then(resolve, reject)
                    return
                }
                if (
                    res.statusCode !== 200 ||
                    !res.headers["content-type"]?.startsWith("image/") ||
                    Number(res.headers["content-length"] || 0) > maxBytes
                ) {
                    res.destroy()
                    clearTimeout(timer)
                    reject(new Error("Invalid image response"))
                    return
                }
                let size = 0
                const chunks: Buffer[] = []
                res.on("data", (chunk: Buffer) => {
                    size += chunk.length
                    if (size > maxBytes) res.destroy(new Error("Image exceeds download limit"))
                    else chunks.push(chunk)
                })
                res.on("end", () => {
                    clearTimeout(timer)
                    resolve(new Uint8Array(Buffer.concat(chunks)))
                })
                res.on("error", (error) => {
                    clearTimeout(timer)
                    reject(error)
                })
            }
        )
        req.on("error", (error) => {
            clearTimeout(timer)
            reject(error)
        })
        req.end()
    })
}
