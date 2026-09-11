# SilkChat component workshop configuration

Run `bun run storybook`, then open http://localhost:6006.

The catalog lives in [`stories/`](../stories/README.md), separate from production
code. See that folder's README for contributor guidance and validation commands.

The stories import the production component; they contain only sample props and
example layouts. Editing `src/components/attachment-tile.tsx` updates both the app
and these stories. No login, Convex deployment, or upload is needed.

The separate Vite config imports the app CSS without loading its server plugins.
`bun run storybook:build` creates the standalone site in `storybook-static`.
Explicit Vite aliases supply auth and backend fixtures, avoiding automatic mock
path resolution and `mocked(...).mockReturnValue` on unmocked hooks. The memory
router and query/tooltip providers support composed components. Fixture mutations
do not write to the backend. Focused jsdom checks exercise this setup; automated
visual regression testing is not configured.
