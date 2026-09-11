import type { Meta, StoryObj } from "@storybook/react-vite"
import { MobileSnapCarousel } from "@/components/landing-page/mobile-snap-carousel"
const meta = {
    title: "Available components/Mobile snap carousel",
    render: () => (
        <>
            <p className="mb-4">Resize the preview below 768px to see this mobile-only carousel.</p>
            <MobileSnapCarousel
                items={["Chat", "Images", "Personas"]}
                getKey={(item) => item}
                renderItem={(item) => (
                    <div className="flex h-48 items-center justify-center bg-muted text-xl">
                        {item}
                    </div>
                )}
            />
        </>
    ),
    parameters: {
        docs: {
            description: {
                component:
                    "No current app call site. This retained component provides touch scrolling and pagination on mobile."
            }
        }
    }
} satisfies Meta
export default meta
export const Mobile: StoryObj<typeof meta> = {}
