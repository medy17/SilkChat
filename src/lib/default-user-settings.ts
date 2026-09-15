export const DefaultSettings = (userId: string) => ({
    userId,
    coreAIProviders: {},
    customAIProviders: {},
    customModels: {},
    titleGenerationModel: "gemini-3.1-flash-lite",
    toolCallLimitPerTurn: 3,
    customThemes: [],
    invertSendNewlineBehavior: false,
    telemetryEnabled: true,
    modelRouting: "silkchat" as const,
    imageGenerationDefaults: undefined,
    generalProviders: {
        supermemory: undefined
    },
    customization: undefined,
    responseStyle: undefined,
    onboardingCompleted: false
})
