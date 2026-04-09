export type ModelBenchmarkCard = {
    key: string
    title: string
    value: number
    displayValue: string
    subtitle?: string
    breakdownLabel?: string
    breakdownValue?: string
}

export type ModelBenchmarkPayload = {
    available: boolean
    retryable?: boolean
    errorCode?: string
    sourceLabel: string
    sourceUrl: string
    fetchedAt: string
    cards: ModelBenchmarkCard[]
}
