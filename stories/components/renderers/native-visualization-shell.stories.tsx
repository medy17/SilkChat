import original from "./native-chart-tool.stories"
export { Playground } from "./native-chart-tool.stories"
export default {
    ...original,
    title: "Tools/Visualization shell",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component: "The chart's actual visualization shell and expand controls."
            }
        }
    }
}
