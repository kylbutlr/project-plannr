# Provisioning status

Verified September 30, 2026. Infrastructure existence, local checks, and hosted
readiness are separate states.

## Source

- Private repository: [kylbutlr/project-plannr](https://github.com/kylbutlr/project-plannr).
- Local checkout is independent of Worldrawn and the source board prototype.
- GitHub's default branch is `main`, created from verified scaffold commit
  `bfe8e8d9c4ab02488eaf24adfe584e32b008df89`. The initial scaffold branch remains
  recoverable; no history was rewritten.
- Persistence, password authentication, Netlify adapter, and independent
  completed-history pagination were pushed to `kylebutler/initial-scaffold` in
  commit [`63cbd5a`](https://github.com/kylbutlr/project-plannr/commit/63cbd5ac14afbd7690f4c9593b1ce45e8ae0cd0a).
- [GitHub CI](https://github.com/kylbutlr/project-plannr/actions/runs/36804070960)
  passed for that commit. No merge to main was performed.
- CI uses pinned official actions and read-only repository permissions.

## Database

- Dedicated project: `morning-rain-52458258`, named Project Plannr.
- Existing production/root branch: `br-spring-fog-ar2mjhqg`.
- Isolated schema-only development branch: `br-tiny-math-ar2pbuta`.
- [Open development](https://console.neon.tech/app/projects/morning-rain-52458258/branches/br-tiny-math-ar2pbuta/).
- Region: AWS US West 2, Oregon. PostgreSQL 18.
- Existing organization is on Launch; no billing settings were changed.

Kyle configured the ignored local .env. Verified owner-only permissions (600),
password configuration, private mode, and the exact development hostname without
displaying secrets. TLS-verified database authentication passed.

Migration version 1 and live Postgres checks passed September 30, 2026: storage,
transaction rollback, competing claims, retry deduplication and persistence
through a fresh connection pool. The original archived verification project and
ticket were removed with Kyle's authorization, along with their retry record.
Original audit history and unrelated records were preserved. The updated check
cleans up its own fixtures instead of archiving them. Production was not targeted.

## Hosting and access

The Netlify CLI is signed in to Kyle's existing account. The dedicated
Project Plannr site is linked to this checkout, site ID
`eb96a39a-3f26-483b-98a5-a88b15b71139` on team `kylbutlr`.
Open [the hosted app](https://project-plannr.netlify.app) or
[the configured deployment](https://app.netlify.com/projects/project-plannr/deploys/6abddde58f3e78f5ab995632).
This is a manual CLI publication, not Git-triggered deployment.

The roadmap import and App Stylr favicon publication are live. Exact deployed
SVG/PNG bytes and MIME types, corrected banner, owner board access and anonymous
API denial were verified. Fifty local tests, HTTP checks, icon determinism and
the ten-asset publishing whitelist passed. [Source PR #1](https://github.com/kylbutlr/project-plannr/pull/1)
targets `main` and has not been merged by this task.

Implemented and published: one server-side password gate, eight-hour owner sessions,
sign out, password-rotation invalidation, durable login throttling, protected
APIs, CSRF checks, scoped/revocable agent tokens, and a Netlify adapter.

No GitHub OAuth app is needed or registered. The earlier registration screenshot
is only an unsubmitted draft, not an active integration. No real agent credential
has been created. Worldrawn's 34 POI entries and one planning reference have been
imported into its existing project. Full source, historical statuses, priorities,
notes and evidence links were verified through a fresh database read and the hosted
editor before the local ledger was removed. The existing Test ticket was preserved.
Private before/after backups remain under the ignored `data/import-backups/` directory.

## Remaining gates

1. Review and prioritize imported Worldrawn tickets in the hosted board.
2. Authorize Git-triggered deployment from the default `main` branch.
   The first publication does not imply a merge to main or automatic deploys.
3. Authorize one project-scoped agent pilot after a real ticket is selected.
4. Production storage enablement remains a separate approval and verification gate.

Hosted checks passed for anonymous API denial, wrong/correct password, secure
cookies, CSRF/origin rejection, ticket writes persisted through a fresh database
pool, all three board APIs, private-file denial, and sign-out revocation. Browser
checks covered sign-in, reload, three views, project management controls, ticket
editor Cancel, and mobile overflow. See the [hosted evidence](hosted-verification.md)
for the exact tested boundary.

See [verification evidence](durable-verification.md) and
[Netlify setup](netlify-setup.md).
