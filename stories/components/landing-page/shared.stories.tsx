import original from "./features-section.stories"
export { PageSection as Playground } from "./features-section.stories"
export default {
    ...original,
    title: "Landing/Shared section elements",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component: "SectionHead and Tile in their actual FeaturesSection composition."
            }
        }
    }
}
