import type { Meta, StoryObj } from "@storybook/react-vite"
import { PersonaAvatar } from "@/components/persona-avatar"

const meta = {
    title: "Personas/Avatar",
    component: PersonaAvatar,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "chat.tsx empty persona chat. Compact avatars also appear in the persona selector and thread rows."
            }
        }
    },
    args: {
        name: "Writing Coach",
        rounded: "full",
        className: "size-16 border-2 border-border shadow-sm"
    }
} satisfies Meta<typeof PersonaAvatar>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Compact: Story = { args: { className: "size-7", rounded: "xl" } }
export const Image: Story = {
    args: { avatarKind: "builtin", avatarValue: "/storybook/sample.svg" }
}
