import original from "../landing-page/image-gallery-section.stories"
export { PageSection as Playground } from "../landing-page/image-gallery-section.stories"
export default {
    ...original,
    title: "Library/Landing masonry",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component:
                    "Actual landing gallery, including its production image assets and hover behavior."
            }
        }
    }
}
