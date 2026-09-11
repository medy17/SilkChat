import type { Meta, StoryObj } from "@storybook/react-vite"
import { RecipeCard } from "@/components/recipe-card"

const meta = {
    title: "Chat/Recipe",
    component: RecipeCard,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "memoized-markdown.tsx parsed recipe blocks: serving scaling and step timers."
            }
        }
    },
    args: {
        recipe: {
            title: "Quick tomato pasta",
            servings: 2,
            raw: "",
            ingredients: [
                {
                    raw: "200 g pasta",
                    tokens: [
                        {
                            type: "quantity",
                            display: "200 g",
                            value: 200,
                            unit: "g",
                            scalable: true
                        },
                        { type: "text", text: " pasta" }
                    ]
                }
            ],
            steps: [
                {
                    raw: "Boil for 10 minutes.",
                    tokens: [
                        { type: "text", text: "Boil for " },
                        { type: "timer", display: "10 minutes", durationSeconds: 600 },
                        { type: "text", text: "." }
                    ]
                }
            ]
        }
    }
} satisfies Meta<typeof RecipeCard>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
