import {
    BrainCircuit,
    Code,
    FileText,
    FileUp,
    Globe,
    Image as ImageIcon,
    Sparkles,
    Users,
    VenetianMask
} from "lucide-react"
import type { ComponentType } from "react"

import {
    ClaudeIcon,
    DeepSeekIcon,
    GeminiIcon,
    OpenAIIcon,
    XAIIcon,
    ZAIIcon
} from "@/components/brand-icons"

export type LandingIcon = ComponentType<{ className?: string }>

export type Provider = {
    name: string
    command: string
    Icon: LandingIcon
}

export type Feature = {
    title: string
    description: string
    Icon: LandingIcon
}

export type UseCase = Feature & {
    checks: string[]
}

export type Testimonial = {
    quote: string
    name: string
    role: string
}

export type GalleryImage = {
    id: string
    // Grid + lightbox source (local asset under /public/gallery).
    img: string
    // Optional larger source for the expanded lightbox. Falls back to `img` when omitted.
    fullImg?: string
    // Natural pixel dimensions. Drive both the masonry tile ratio and the lightbox
    // geometry, so the image never letterboxes regardless of `aspectRatio`'s label.
    width: number
    height: number
    // Short model name shown as the badge on the tile.
    label: string
    // Metadata mirrored from the real Library expanded view.
    prompt: string
    model: string
    aspectRatio: string
    resolution: string
    createdAt: string
}

export const galleryImages: GalleryImage[] = [
    {
        id: "gallery-1",
        img: "/gallery/opt/bioluminescent_jellyfin.webp",
        fullImg: "/gallery/opt/bioluminescent_jellyfin-full.webp",
        width: 1536,
        height: 2048,
        label: "GPT Image 2",
        prompt: "A bioluminescent jellyfish drifting through a midnight ocean, volumetric god rays, hyper-detailed, cinematic, 8k",
        model: "GPT Image 2",
        aspectRatio: "3:4",
        resolution: "2K",
        createdAt: "2026-06-14T09:24:00.000Z"
    },
    {
        id: "gallery-2",
        img: "/gallery/opt/cozy_nook.webp",
        fullImg: "/gallery/opt/cozy_nook-full.webp",
        width: 1184,
        height: 864,
        label: "Nano Banana",
        prompt: "Cozy reading nook in a sunlit Scandinavian apartment, soft morning light, photorealistic, 35mm",
        model: "Nano Banana",
        aspectRatio: "4:3",
        resolution: "1K",
        createdAt: "2026-06-13T17:02:00.000Z"
    },
    // Temporarily trimmed to tighten the grid and peek the next section.
    // Restore (this + surreal_floating below) if the shorter layout doesn't land.
    // {
    //     id: "gallery-3",
    //     img: "/gallery/opt/portrait_wanderer.webp",
    //     fullImg: "/gallery/opt/portrait_wanderer-full.webp",
    //     width: 1728,
    //     height: 2304,
    //     label: "Seedream",
    //     prompt: "Portrait of a wanderer in an iridescent cloak, cinematic rim lighting, seamless studio backdrop",
    //     model: "Seedream 4.5",
    //     aspectRatio: "3:4",
    //     resolution: "2K",
    //     createdAt: "2026-06-12T11:48:00.000Z"
    // },
    {
        id: "gallery-4",
        img: "/gallery/opt/isometric_miniature.webp",
        fullImg: "/gallery/opt/isometric_miniature-full.webp",
        width: 1024,
        height: 1024,
        label: "Nano Banana Pro",
        prompt: "Isometric miniature island with a tiny lighthouse, clay render, soft pastel palette, studio lighting",
        model: "Nano Banana Pro",
        aspectRatio: "1:1",
        resolution: "1K",
        createdAt: "2026-06-11T20:15:00.000Z"
    },
    // Temporarily trimmed to tighten the grid (see note on gallery-3 above).
    // {
    //     id: "gallery-5",
    //     img: "/gallery/opt/city_skyline.webp",
    //     fullImg: "/gallery/opt/city_skyline-full.webp",
    //     width: 2048,
    //     height: 1152,
    //     label: "GPT Image 2",
    //     prompt: "Retro-futurist city skyline at dusk, neon reflections on rain-slick streets, anamorphic lens flare",
    //     model: "GPT Image 2",
    //     aspectRatio: "16:9",
    //     resolution: "2K",
    //     createdAt: "2026-06-10T08:37:00.000Z"
    // },
    // Temporarily trimmed to tighten the grid (see note on gallery-3 above).
    // {
    //     id: "gallery-6",
    //     img: "/gallery/opt/macro_web.webp",
    //     fullImg: "/gallery/opt/macro_web-full.webp",
    //     width: 1200,
    //     height: 896,
    //     label: "FLUX",
    //     prompt: "Macro shot of a dew-covered spiderweb at dawn, shallow depth of field, prismatic refraction",
    //     model: "FLUX 1.1 Pro",
    //     aspectRatio: "4:3",
    //     resolution: "1K",
    //     createdAt: "2026-06-09T14:53:00.000Z"
    // },
    // Temporarily trimmed to tighten the grid (see note on gallery-3 above).
    // {
    //     id: "gallery-7",
    //     img: "/gallery/opt/surreal_floating.webp",
    //     fullImg: "/gallery/opt/surreal_floating-full.webp",
    //     width: 2400,
    //     height: 1792,
    //     label: "Nano Banana 2",
    //     prompt: "Surreal floating mountains above a sea of clouds, matte painting, golden hour, epic scale",
    //     model: "Nano Banana 2",
    //     aspectRatio: "4:3",
    //     resolution: "2K",
    //     createdAt: "2026-06-08T19:09:00.000Z"
    // },
    {
        id: "gallery-8",
        img: "/gallery/opt/painted_fox.webp",
        fullImg: "/gallery/opt/painted_fox-full.webp",
        width: 1024,
        height: 1024,
        label: "Nano Banana 2",
        prompt: "Hand-painted watercolor fox curled in autumn leaves, soft edges, warm tones, paper texture",
        model: "Nano Banana 2",
        aspectRatio: "1:1",
        resolution: "1K",
        createdAt: "2026-06-07T07:41:00.000Z"
    }
]

export const providers: Provider[] = [
    { name: "OpenAI", command: "GPT-5.5", Icon: OpenAIIcon },
    { name: "Claude", command: "Claude 4.6", Icon: ClaudeIcon },
    { name: "Gemini", command: "Gemini 3.1 Pro", Icon: GeminiIcon },
    { name: "xAI", command: "Grok", Icon: XAIIcon },
    { name: "DeepSeek", command: "DeepSeek", Icon: DeepSeekIcon },
    { name: "Z.ai", command: "GLM", Icon: ZAIIcon }
]

export const features: Feature[] = [
    {
        title: "Multi-model mastery",
        description:
            "Switch between GPT-5.4, Claude 4.6, Gemini 3.1 Pro, and dozens more instantly.",
        Icon: BrainCircuit
    },
    {
        title: "Real-time web search",
        description: "Ground chats with current web results for accurate, up-to-date answers.",
        Icon: Globe
    },
    {
        title: "Stunning image generation",
        description:
            "Create and manage images in Library View using Nano Banana, Seedream, FLUX, and more.",
        Icon: ImageIcon
    },
    {
        title: "Smart artifacts",
        description: "Preview code and documents on the fly without switching tabs.",
        Icon: FileText
    },
    {
        title: "Universal import",
        description:
            "Bring existing conversations from ChatGPT, Claude, T3, and other platforms into SilkChat.",
        Icon: FileUp
    },
    {
        title: "Custom personas",
        description:
            "Craft tailored AI personalities with unique prompts and context for specific workflows.",
        Icon: Users
    }
]

export const useCases: UseCase[] = [
    {
        title: "Developers",
        description:
            "Compare answers across models and preview UI components directly in the chat.",
        Icon: Code,
        checks: ["Code refactoring", "Live UI previews", "Complex debugging"]
    },
    {
        title: "Creators",
        description:
            "Brainstorm with sharp models and generate high-quality images from the same workspace.",
        Icon: Sparkles,
        checks: ["High-res image generation", "Ideation and outlining", "Creative feedback"]
    },
    {
        title: "Researchers",
        description:
            "Use web search and file uploads to ground questions in sources and dense documents.",
        Icon: FileText,
        checks: ["Live web grounding", "Document analysis", "Source summarization"]
    },
    {
        title: "Roleplayers",
        description:
            "Build custom personas with deep backstories, consistent voices, and flexible model choices.",
        Icon: VenetianMask,
        checks: ["Deep character prompts", "Consistent persona voice", "Unfiltered model choices"]
    }
]

export const proofItems = [
    "Use internal credits or bring your own keys",
    "Switch models mid-thread",
    "Import chats from other platforms"
]

export const pricingOptions = [
    {
        title: "Free",
        price: "$0",
        cadence: "forever",
        cta: "Start free",
        featured: false,
        description: "Try the workspace with starter credits and your own provider keys.",
        items: [
            "200 Basic Credits each month",
            "Bring your own provider keys",
            "Chat, files, imports, and personas",
            "Upgrade when you need Pro models"
        ]
    },
    {
        title: "Pro",
        price: "$8.99",
        cadence: "per month",
        cta: "Get Pro",
        featured: true,
        description: "Use managed credits for premium models without provider setup.",
        items: [
            "1,500 Basic Credits each month",
            "100 Pro Credits each month",
            "Premium image generation",
            "Keep BYOK for direct provider billing"
        ]
    }
]

export const testimonials: Testimonial[] = [
    {
        quote: "SilkChat replaced three separate subscriptions for me. Having every model in one place is an absolute game-changer.",
        name: "Alex R.",
        role: "Full-Stack Developer"
    },
    {
        quote: "The artifacts feature is insane. I can prototype UI components directly in a chat and see them render live.",
        name: "Priya S.",
        role: "UX Designer"
    },
    {
        quote: "BYOK means I'm in full control of my costs and data. It's the only AI platform I actually trust with sensitive work.",
        name: "Marcus T.",
        role: "Security Consultant"
    },
    {
        quote: "The model selector makes it simple to pick the right tool for the job without splitting work across apps.",
        name: "Nadia K.",
        role: "Research Lead"
    },
    {
        quote: "Importing old chats and keeping them next to new work made SilkChat feel like home on day one.",
        name: "Owen L.",
        role: "Product Engineer"
    },
    {
        quote: "Search, images, files, and personas in one thread is exactly how AI tooling should feel.",
        name: "Maya D.",
        role: "Creative Director"
    }
]
