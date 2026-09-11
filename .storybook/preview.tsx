import type { Preview } from "@storybook/react-vite"
import { resetWorkshopFixtures } from "./service-state"
import { WorkshopProviders } from "./WorkshopProviders"
import { useThemeStore } from "../src/lib/theme-store"
import { ThemeProvider } from "../src/components/theme-provider"
import { useEffect } from "react"
import "../src/styles/globals.css"
import "./preview.css"

const preview: Preview = {
    beforeEach: (context) => {
        resetWorkshopFixtures(context.parameters.queryFixtures)
    },
    globalTypes: {
        theme: {
            description: "SilkChat theme",
            toolbar: {
                icon: "circlehollow",
                items: ["light", "dark"],
                dynamicTitle: true
            }
        }
    },
    initialGlobals: { theme: "dark" },
    parameters: { layout: "padded", backgrounds: { disable: true } },
    decorators: [
        function ThemeDecorator(Story, context) {
            useEffect(() => {
                document.documentElement.classList.toggle("dark", context.globals.theme === "dark")
                const state = useThemeStore.getState()
                state.setThemeState({
                    ...state.themeState,
                    currentMode: context.globals.theme === "dark" ? "dark" : "light"
                })
            }, [context.globals.theme])
            return (
                <WorkshopProviders key={context.id}>
                    <ThemeProvider>
                        <Story />
                    </ThemeProvider>
                </WorkshopProviders>
            )
        }
    ]
}

export default preview
