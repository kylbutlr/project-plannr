# Local setup

## Private workspace

No OAuth application, GitHub login, or signup is required. The workspace uses
one server-side password, plus separate project-scoped credentials for agents.

Create an ignored local environment file if you have not already made one:

```sh
cd /Users/kylebutler/Documents/sites/project-plannr
test -e .env || cp .env.example .env
chmod 600 .env
```

Open [.env](../.env) locally. Set `PLANNR_PASSWORD` to a unique password-manager
password of 16 to 256 characters. Do not paste it in chat or commit it. Keep
`PLANNR_ORIGIN=http://127.0.0.1:4205` for the default local port.

```sh
npm ci
npm run dev
```

Open [Project swimlanes](http://127.0.0.1:4205/?view=swimlanes),
[Kanban](http://127.0.0.1:4205/?view=kanban), or
[Ranked queue](http://127.0.0.1:4205/?view=queue).
Enter the workspace password on the access screen. Stop with Ctrl+C in the
terminal running this server. If you choose another port, update both
`PROJECT_PLANNR_PORT` and `PLANNR_ORIGIN`.

Without a database connection, private mode uses the ignored owner-readable
`data/workspace.json` file. Only one server can own this file at a time.
The first private workspace is empty, not seeded with illustrative tickets.

## Development database

The Neon resources were verified through the console on September 30, 2026:

- [Project Plannr project](https://console.neon.tech/app/projects/morning-rain-52458258/branches).
- [Isolated schema-only development branch](https://console.neon.tech/app/projects/morning-rain-52458258/branches/br-tiny-math-ar2pbuta/).
- [Existing production/root branch](https://console.neon.tech/app/projects/morning-rain-52458258/branches/br-spring-fog-ar2mjhqg/), do not use for this verification.

Use Connect on the development branch. Copy its pooled connection string into
`DATABASE_URL` in your local .env. Keep
`PLANNR_DATABASE_BRANCH=development` and the exact pooled hostname in
`PLANNR_DATABASE_HOST`. The example file contains the verified pooled hostname.
You may leave `MIGRATION_DATABASE_URL` empty; migration can use the same pooled
connection. A direct URL is optional, with a separately checked host.

Only after the development credentials are configured:

```sh
npm run db:migrate
npm run db:check
npm run dev
```

Migration is additive and transactional. The database check creates one
verification project and ticket, tests rollback, competing claims, retry
deduplication and persistence through a new connection pool, then removes its
test project, ticket, retry record and temporary test session. Its audit history
remains. Cleanup also runs after normal verification failures; if cleanup fails
or the fixture has unexpected user edits, the command fails rather than claiming
success. An abrupt process termination or unavailable database can still prevent
cleanup, so check the reported failure before retrying.
Both commands passed against the isolated development branch on September 30,
2026. Local tests alone are not proof of a live Neon migration. You do not need
to rerun the database check simply to start the preview.

## Password behavior

- HTTPS hosting uses a Secure, HttpOnly, SameSite=Lax `__Host-plannr` cookie.
  HTTP loopback uses a local HttpOnly cookie without Secure.
- Sessions expire after eight hours. Sign out revokes the session in storage.
- Password comparison uses scrypt and timing-safe comparison. Plaintext
  passwords and raw session credentials are not stored in workspace data.
- Changing the server password and restarting/redeploying invalidates existing
  owner sessions. Agent tokens remain independently revocable.
- Failed login attempts persist across server/function restarts. Five failed
  attempts per client address, or 50 total attempts, trigger a 15-minute window.
  A successful login clears that client's failures, not the global budget.
- Browser mutations require the configured Origin and a CSRF token.
- The shared password provides owner access, not separate human identities.
  Keep it to yourself and use scoped tokens for agents.

## Hosting

[Project Plannr](https://project-plannr.netlify.app) is published using the
isolated development database. See [the Netlify setup guide](netlify-setup.md)
and [provisioning status](provisioning-status.md) for the release boundary.
Git-triggered deployment is not configured; production database access remains
blocked. This does not change the local preview commands above.
