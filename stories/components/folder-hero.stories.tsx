import type { Meta, StoryObj } from "@storybook/react-vite"
import { FolderHero } from "@/components/folder-hero"
import { demoProject } from "../../.storybook/fixtures"

const meta = {
    title: "Chat/Folder hero",
    component: FolderHero,
    tags: ["autodocs"],
    parameters: {
        docs: { description: { component: "folder-chat.tsx empty folder conversation." } }
    },

    args: { project: demoProject }
} satisfies Meta<typeof FolderHero>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Loading: Story = { args: { project: undefined } }
