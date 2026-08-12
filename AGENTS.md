## Repo Notes
- Use bun. NO NPM!

- The test command is `bun run test`, NOT `bun test`.

- Do not run a dev server. Assume one is already running unless the user explicitly asks you to start/stop it.

- Much of this app is Auth gated so do not attempt to perform any visual verification using browser MCPs, skills, or tools. It will NOT work. Check your code instead or ask the user to verify once at the END.

- When writing/modifying UI, always use theme based variables. Do not hardcode radius values, use theme.radius.sm/md/lg/xl. IF YOU HARDCODE, YOUR WORK WILL BE AUTOMATICALLY REJECTED.

- Read [MODEL_PROVIDER_GUIDE.md](docs\MODEL_PROVIDER_GUIDE.md) first when tasked with adding or modifying model entries.

- Follow [TEST_WRITING_GUIDE.md](./docs/TEST_WRITING_GUIDE.md) when adding, removing, or refactoring tests.

- Local development uses cloud Convex plus the local image optimizer. The user normally runs:
  ```
  bun run dev
  ```
  This starts Vite and the local image optimizer against the cloud dev deployment. Do not start it yourself unless asked.
- Convex cloud dev does not hot-reload from local files. When backend/schema changes need to reach the cloud dev deployment, run:
  ```
  bun run cloud:dev:push
  ```
- Staging and production deploys must keep Convex and the frontend in sync. Do not push `origin/staging` or `origin/main` directly for deploys unless the user explicitly asks for a manual Git-only push. Use:
  ```
  bun run staging:deploy
  bun run prod:deploy
  ```
  These commands verify the branch/worktree, run typecheck/tests, push the matching Convex deployment, then push the matching Git branch.
- Deployment branches:
  - `staging` deploys to the staging Convex deployment and Vercel preview/staging domain.
  - `main` deploys to production Convex and production Vercel.
