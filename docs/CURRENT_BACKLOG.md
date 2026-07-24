# CURRENT BACKLOG

- MCP feature is lagging behind and cannot use most modern MCP offerings.
- Improve composer styling and effects (thinking of floating composer on the bottom for mobile and keeping docked for desktop).

### Completed:
- Add action bar in SilkScreen for bulk actions. (Added a responsive floating selection toolbar with page-wide selection, archive/restore, delete, and keyboard dismissal.)
- Add upgrade button for free users in model picker.
- Improve audio compression to allow for longer transcripts and fit into the 25mb window. (Audio was being wrongly converted to WAV for no reason which ballooned payload size and subsequently; upload speeds and API allowed payload sizes).
- Check why BYOK does not include total cost data and affects OpenRouter. (Was using wrong response field which did not include BYOK. Switched to correct field)
- Switch detailed costs indicator tooltip to stats for nerds when showing input/output token costs. (Completed and included some polish for the appearance settings screen)
- Add Kimi K3 & Meta Muse Spark 1.1
- Switch mobile model picker to vertical rail.
- Add image comparison mode in SilkScreen.

### Cancelled or Delayed:
- Load only latest messages in chat UI to improve performance and responsiveness. (Not necessary and introduced complications with UI logic. Not feasible for now.)
