# Component stories

Stories live here, separate from application code, with `components/` mirroring
`src/components/`. They import production components through `@/components/...`;
they do not copy component implementations.

Run `bun run storybook` and open http://localhost:6006. Use the theme toolbar and
Controls to explore states. Some mobile-only components require a narrow preview.
The SilkChat theme control switches components and their canvas/Docs background
together, using the app's actual theme tokens. Storybook's own interface theme is
independent and does not need to be changed to review components.

When adding a story:

1. Read the component and its actual call sites first. `bun run storybook:usage`
   refreshes `.storybook/usage.json` and reports component modules missing stories.
2. Use the same composition, sizing, labels, and props as the app. For primitives
   that depend on surrounding UI, reuse a composed story showing that real usage.
3. Add useful loading, error, disabled, and populated states where applicable.
   Label retained components with no app usage under **Available components** or
   **Available primitives** instead of inventing an app use case.
4. Import shared fixture data from `.storybook/fixtures.ts`. Query overrides go
   in `parameters.queryFixtures`, keyed by Convex function name. Auth, Convex and
   telemetry adapters are configured only in the workshop's Vite aliases.
5. Keep interactive examples stateful when their parent normally controls them.
   Use theme tokens for styling, including corner radii.

`bun run storybook:check` checks the stories and workshop configuration.
`bun run storybook:test` exercises the shared service boundary and representative
component rendering in jsdom. `bun run storybook:build` builds the static catalog.
These checks do not perform visual regression testing or prove every interaction.

Nonvisual runtime components are documented in `.storybook/story-exclusions.json`.
Storybook configuration and service adapters remain in `.storybook/`; local media
fixtures live in `public/storybook/`.
