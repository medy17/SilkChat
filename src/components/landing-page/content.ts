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
