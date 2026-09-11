import original from "../analytics/usage-dashboard.stories"
export { Playground } from "../analytics/usage-dashboard.stories"
export default {
    ...original,
    title: "UI/Card",
    parameters: {
        ...original.parameters,
        docs: {
            description: { component: "Actual usage metric cards from the usage settings page." }
        }
    }
}
