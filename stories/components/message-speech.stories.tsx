import type { Meta, StoryObj } from "@storybook/react-vite"
import { MessageSpeech } from "@/components/message-speech"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Chat/Speech playback",
    component: MessageSpeech,
    args: {
        message: {
            id: "speech-demo",
            role: "assistant",
            parts: [{ type: "text", text: "A sample response ready for speech playback." }]
        },
        threadId: "storybook-thread"
    },
    decorators: [
        (Story) => (
            <SidebarProvider className="min-h-0">
                <div className="relative h-[70vh] w-full">
                    <Story />
                </div>
            </SidebarProvider>
        )
    ]
} satisfies Meta<typeof MessageSpeech>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
