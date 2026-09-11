import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { ImportThemeDialog } from "@/components/themes/import-theme-dialog"

const meta = {
    title: "Themes/Import",
    component: ImportThemeDialog,
    tags: ["autodocs"],
    parameters: { docs: { description: { component: "ThemeSwitcher theme import dialog." } } },

    args: {
        open: true,
        onOpenChange: fn(),
        onThemeImported: fn().mockResolvedValue(undefined),
        canImport: true,
        maxImportedThemes: 10
    }
} satisfies Meta<typeof ImportThemeDialog>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const LimitReached: Story = { args: { canImport: false } }
