# OAuth Configuration

This app currently uses Better Auth with Google OAuth plus email OTP. Better Auth now runs in Convex, while the app keeps `/api/auth/*` stable by proxying that path to the Convex site URL.

## Required Environment Variables

These belong in the Vercel app environment, or in `.env.local` for local development.

```bash
BETTER_AUTH_SECRET=replace-with-a-stable-secret
VITE_BETTER_AUTH_URL=http://localhost:3000

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

VITE_CONVEX_URL=https://your-convex-deployment.convex.cloud
VITE_CONVEX_API_URL=https://your-convex-deployment.convex.cloud/http
VITE_CONVEX_SITE_URL=https://your-convex-deployment.convex.site
```

## Google OAuth Setup

1. Go to Google Cloud Console.
2. Create or select a project.
3. Open `APIs & Services > Credentials`.
4. Create an OAuth client ID for a web application.
5. Add redirect URIs:
   - local: `http://localhost:3000/api/auth/callback/google`
   - production: `https://your-domain.com/api/auth/callback/google`
6. Add the client ID and secret to your runtime env.

## Local Auth Loop

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_BETTER_AUTH_URL=http://localhost:3000`.
3. Set `VITE_CONVEX_SITE_URL` to your local or deployed Convex site URL.
4. Run:

```bash
bunx convex dev
bun run dev
```

If you need to backfill local legacy auth data, also set `DATABASE_URL` and run:

```bash
bun run local:auth:backfill
```

## Better Auth Notes

The current auth implementation depends on these details:

- `src/lib/auth-server.ts` proxies the app's auth routes to Convex using `VITE_CONVEX_SITE_URL`.
- Better Auth JWTs are issued and validated by Convex, so `/api/auth/convex/jwks` must stay healthy.
  - for local Convex, `VITE_CONVEX_SITE_URL` should usually be `http://127.0.0.1:3211`
- Google client credentials must exist in the Convex environment as well as the app environment used for local development.

## Production Database Note

For Vercel deployments, use a connection string that works from Vercel's runtime. In practice that usually means a Supabase pooler or other Vercel-safe Postgres endpoint rather than a direct host that may fail DNS or network resolution.

## Troubleshooting

### OAuth URL contains `%0D%0A` or Google says the request is malformed

Your OAuth envs likely contain trailing newline characters. Re-save them cleanly in Vercel. The app trims them now, but the source values should still be corrected.

### Sign-in succeeds, then the UI falls back to logged out

Check:

1. `GET /api/auth/get-session`
2. `GET /api/auth/convex/jwks`

If either one fails, Convex session state will not stay consistent.

### Redirect URI mismatch

The callback URL in Google Cloud must match exactly:

- same protocol
- same host
- same path

### Convex auth fails after OAuth looks successful

Check `convex/auth.config.ts` and confirm:

- `VITE_CONVEX_SITE_URL` is correct for the app proxy environment
- the JWKS endpoint at `/api/auth/convex/jwks` returns `200`

If the issuer or JWKS URL is wrong, Convex will reject the Better Auth JWT even if Google sign-in worked.
