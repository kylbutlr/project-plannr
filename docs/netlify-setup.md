# Netlify setup

## Hosted development workspace

Open [Project Plannr](https://project-plannr.netlify.app) or its
[Netlify dashboard](https://app.netlify.com/projects/project-plannr).
The dedicated site is linked to this checkout. Six runtime settings are
configured for the published-site context, including the existing local
workspace password and isolated development database. Do not copy secrets into
source or chat. The repository is connected with a read-only GitHub deploy key and
push-only webhook, with `main` as the production and sole allowed branch.
The publish guard removes only Netlify's generated cached configuration during
hosted builds. [Continuous deployment verification](continuous-deployment-verification.md)
records the setup checks; [PR #5](https://github.com/kylbutlr/project-plannr/pull/5)
tracks the final automatic-deployment and subsequent cached-build results.

The configured deployment is
[`6abf0a05f6037ed41b4eb330`](https://app.netlify.com/projects/project-plannr/deploys/6abf0a05f6037ed41b4eb330),
built from merged commit `e1d72dddea3339dbe1c0d380ec94543cd1bd47f9`
on October 1, 2026 (October 2 UTC). The live sign-in and sorting APIs passed,
including all three sorts, bounded initial pages and 24 additional cursor reads.
No projects or tickets changed. A subsequent cached build failed, so this clean
publication is not proof that future cached automatic builds will pass.

The adapter uses the same protected application interface as the local server.
All `/api/*` and `/auth/*` routes run server-side. Only eleven whitelisted browser
assets are copied into `dist`; .env, database files, tests, backend source, and
project ledgers are excluded. Hosted mode refuses demo mode, HTTP transport,
missing password, and local-file fallback.

The Netlify CLI account and exact site identity were verified September 30,
2026. No production database write has been performed.

## Configuration and future deployments

1. Finish the live development migration and database check in
   [local setup](local-setup.md).
2. The dedicated site is under Kyle's personal Netlify team. Source is in the private
   [Project Plannr repository](https://github.com/kylbutlr/project-plannr).
   repository. Do not connect Worldrawn or publish the repository root.
3. Choose the exact hosted address. Use it as `PLANNR_ORIGIN`, without a trailing
   slash. A different Netlify preview/domain is intentionally rejected.
4. Set runtime environment variables in the
   [Netlify dashboard](https://app.netlify.com/), not in browser code or
   netlify.toml. Where environment scopes are available, include Functions.
5. Deploy only after explicit approval, then verify the actual hosted application.

For an approved manual deployment from this linked checkout:

```sh
npm run check
npm run build
netlify deploy --prod --context production --skip-functions-cache
```

Here `--prod` publishes the site's primary address. It does not enable the Neon
production database. The runtime remains restricted to development storage.

## Build configuration

[netlify.toml](../netlify.toml) sets:

- Build command: `npm run build`.
- Publish directory: `dist`.
- Functions directory: `netlify/functions`.
- Build Node version: 22.
- Function bundler: esbuild.

The function exports routes for `/api/*` and `/auth/*`, with no public static API
response fallback. [The function adapter](../netlify/functions/workspace.mjs)
uses Netlify's trusted context IP for login throttling rather than an incoming
forwarded header.

## Server-side variables

| Variable | Value |
| --- | --- |
| `PLANNR_MODE` | `private` |
| `PLANNR_ORIGIN` | Exact chosen HTTPS origin |
| `PLANNR_PASSWORD` | Your unique 16 to 256 character workspace password |
| `DATABASE_URL` | Development branch's pooled connection string for the first isolated preview |
| `PLANNR_DATABASE_BRANCH` | `development` |
| `PLANNR_DATABASE_HOST` | Exact hostname from that development connection |

Never set secrets under frontend prefixes or embed them in build output.
Do not copy your entire local .env into hosted settings: local port, local file,
and optional migration values are not needed by the runtime.

This milestone deliberately blocks production database targeting. The first
hosted verification must remain isolated on development data. Production
enablement and migration are a separate authorized release gate.

Deploy previews do not inherit permission to access production data. A new
preview origin needs its own configured origin and isolated database/password
settings, otherwise requests fail closed. Avoid enabling preview access for
untrusted branches.

## Hosted acceptance gate

Verify the actual deployment, not just the local adapter:

- Signed-out board and private reads/writes are blocked.
- Correct password opens the board; wrong password is rejected and throttled.
- Cookies are Secure and HttpOnly on HTTPS.
- Project/ticket edits survive reload and a fresh function instance.
- Sign out and session expiry reject stale cookies.
- Browser origin/CSRF checks reject unauthorized changes.
- Agent scope and revocation remain enforced.
- No .env, local data file, backend source, or connection string is public.
- Desktop and mobile login, three board views, and project management work.

Sources: [Netlify Functions API](https://docs.netlify.com/build/functions/api/)
for Request/Response routing and context IP; [Functions environment variables](https://docs.netlify.com/build/functions/environment-variables/)
for runtime scope and redeploy requirements. Environment updates require a new
deployment to take effect.
