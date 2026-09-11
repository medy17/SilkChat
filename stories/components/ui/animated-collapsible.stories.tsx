import original from "../renderers/web-search-ui.stories"
export { Playground, Searching, Failed } from "../renderers/web-search-ui.stories"
export default {
    ...original,
    title: "UI/Animated Collapsible",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component:
                    "The web search renderer uses AnimatedCollapsible to reveal search results inside assistant messages."
            }
        }
    }
}
