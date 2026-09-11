import type { RecipeVisual } from "../src/lib/recipe-visuals"
export async function searchRecipeVisuals(): Promise<RecipeVisual[]> {
    return [
        {
            id: "local-sample",
            title: "Local image fixture",
            thumbnailUrl: "/storybook/sample.svg",
            sourceUrl: "/storybook/sample.svg",
            source: "Storybook"
        }
    ]
}
