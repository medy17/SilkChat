# CURRENT BACKLOG

- **Add finance tools backed by the Perplexity API.** Give the model dedicated finance tools (e.g. stock/ETF quotes, company fundamentals, market summaries) that call Perplexity's API, so financial questions get current, sourced data instead of stale training knowledge or generic web search. Tools should follow the existing tool registration pattern, return structured results the UI can render as tool cards (see `SPOTLIGHT_SURFACES.md`), and keep the API key server-side.

- **Expand recipe visualisations to regular conversations.** The visual treatments built for recipes (with Brave API) (structured, rich rendering of model output) are useful outside the recipe context too. Make them available in ordinary chats so the model can use them where they help, rather than only inside recipe flows. Reuse the existing recipe components instead of duplicating them, and decide how the model opts in (markup/tool) without cluttering normal replies.
