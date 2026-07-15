# OAuth Configuration

This app uses Better Auth with Google OAuth. Better Auth runs in Convex, while the app exposes `/api/auth/*` by proxying that path to the Convex site URL.

## Required Environment Variables

Auth secrets belong in the Convex environment, while `VITE_CONVEX_*` values belong in the app/Vercel environment. For local development, put the needed values in `envs/.env.local`.

```bash
BETTER_AUTH_SECRET=replace-with-a-stable-secret
VITE_BETTER_AUTH_URL=http://localhost:3000

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

VITE_CONVEX_URL=https://your-convex-deployment.convex.cloud
VITE_CONVEX_API_URL=https://your-convex-deployment.convex.site
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

1. Copy `.env.example` to `envs/.env.local`.
2. Set `VITE_BETTER_AUTH_URL=http://localhost:3000`.
3. Set `VITE_CONVEX_SITE_URL` to your local or deployed Convex site URL.
4. Run:

```bash
bunx convex dev
bun run dev
```

## Better Auth Notes

The current auth implementation depends on these details:

- `src/lib/auth-server.ts` proxies the app's auth routes to Convex using `VITE_CONVEX_SITE_URL`.
- Better Auth JWTs are issued and validated by Convex, so `/api/auth/convex/jwks` must stay healthy.
  - for local Convex, `VITE_CONVEX_SITE_URL` should usually be `http://127.0.0.1:3211`
- Google client credentials must exist in the Convex environment as well as the app environment used for local development.

## Troubleshooting

### OAuth URL contains `%0D%0A` or Google says the request is malformed

Your OAuth variables likely contain trailing newline characters. Re-save the source values without surrounding whitespace.

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
