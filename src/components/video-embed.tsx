"use client"

import {
    SPOTLIGHT_CARD_CLASS,
    SPOTLIGHT_ICON_BUTTON_CLASS,
    SpotlightHeader
} from "@/components/renderers/spotlight-frame"
import { cn } from "@/lib/utils"
import type { KnownVideo } from "@/lib/video-references"
import { canonicalYouTubeUrl, formatVideoTime } from "@/lib/youtube-video"
import { ExternalLink, Play } from "lucide-react"
import { createContext, useContext, useState } from "react"

export const KnownVideosContext = createContext<ReadonlyMap<string, KnownVideo>>(new Map())

// Widescreen first; older videos only have the letterboxed 4:3 still.
const THUMBNAILS = ["hq720", "hqdefault"] as const

export const VideoEmbed = ({
    id,
    start,
    title
}: {
    id: string
    start?: number
    // Heading written by the model; the video's own title is the fallback.
    title?: string
}) => {
    const video = useContext(KnownVideosContext).get(id)
    const [playing, setPlaying] = useState(false)
    const [thumbnail, setThumbnail] = useState(0)
    const [thumbnailLoaded, setThumbnailLoaded] = useState(false)

    // Only videos returned by a search in this conversation are shown.
    if (!video) return null

    const name = video.title || title || "Video"
    const details = [
        video.channel,
        video.duration,
        start ? `Starts at ${formatVideoTime(start)}` : undefined
    ]
        .filter(Boolean)
        .join(" · ")
    const tryNextThumbnail = () => setThumbnail((current) => current + 1)

    return (
        <section className={cn("not-prose", SPOTLIGHT_CARD_CLASS)}>
            <SpotlightHeader
                className="pt-3.5"
                title={<span className="block truncate">{title || name}</span>}
                description={details || undefined}
                action={
                    <a
                        href={canonicalYouTubeUrl(id, start)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Watch on YouTube"
                        className={cn("inline-flex", SPOTLIGHT_ICON_BUTTON_CLASS)}
                    >
                        <ExternalLink className="size-4" aria-hidden="true" />
                    </a>
                }
            />
            <div className="p-5 pt-4">
                <div className="relative aspect-video overflow-hidden rounded-[var(--radius-md)] bg-muted">
                    {playing ? (
                        <iframe
                            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0${start ? `&start=${start}` : ""}`}
                            title={name}
                            className="absolute inset-0 size-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            // YouTube refuses to play embeds that send no referrer.
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                        />
                    ) : (
                        // The player loads only on request, so nothing from YouTube but a
                        // still runs in the page until the user presses play.
                        <button
                            type="button"
                            aria-label={`Play ${name}`}
                            className="group absolute inset-0 flex size-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                            onClick={() => setPlaying(true)}
                        >
                            {thumbnail < THUMBNAILS.length && (
                                <img
                                    key={thumbnail}
                                    src={`https://i.ytimg.com/vi/${id}/${THUMBNAILS[thumbnail]}.jpg`}
                                    alt=""
                                    className={cn(
                                        "absolute inset-0 size-full object-cover transition-[opacity,transform] duration-300 group-hover:scale-[1.03]",
                                        thumbnailLoaded ? "opacity-100" : "opacity-0"
                                    )}
                                    loading="lazy"
                                    decoding="async"
                                    referrerPolicy="no-referrer"
                                    onLoad={(event) => {
                                        // A missing size answers with a 120px placeholder.
                                        if (event.currentTarget.naturalWidth <= 120)
                                            tryNextThumbnail()
                                        else setThumbnailLoaded(true)
                                    }}
                                    onError={tryNextThumbnail}
                                />
                            )}
                            <span className="spotlight-glass relative flex size-12 items-center justify-center rounded-[var(--radius-lg)]">
                                <Play className="size-5 fill-current" aria-hidden="true" />
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </section>
    )
}
