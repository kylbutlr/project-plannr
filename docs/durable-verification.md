# Private workspace verification

Initial local evidence, recorded September 30, 2026. This document preserves
the earlier verification sequence and counts. The newer
[hosted verification](hosted-verification.md) records the published application
and current 45-test run; earlier statements below about missing deployment or
CI describe the state at those historical checkpoints, not the current state.

## Requirement coverage

| Approved outcome | Implementation | Verification |
| --- | --- | --- |
| One personal password, no OAuth/signup | lib/config.mjs, lib/auth.mjs, board.js | Correct/wrong password, rotation, malformed inputs; desktop/mobile browser login |
| Private API reads and writes | lib/api.mjs, lib/workspace.mjs | Anonymous API denial; agent/owner scope and CSRF denial |
| Secure sessions, expiry and sign out | lib/auth.mjs, shared API | HTTPS Secure/HttpOnly cookie adapter checks, eight-hour expiry, server revocation; browser sign out clears board |
| Login throttling survives instances | Stored attempt records, serialized writes | Per-address/global budgets, new handler over same store, expiry and spoofed forwarded IP checks |
| Durable planning data and audit | lib/store.mjs, migration | File restart, owner-only permissions, concurrent file lock; live development migration, Postgres rollback, claims, retry deduplication and fresh-pool persistence passed |
| Project-scoped collaboration | lib/workspace.mjs, agent.mjs | Credential hash, project access denial, revocation/expiry, claim conflict/renewal/release |
| Retry safety and stale-write protection | Transactional revisions and idempotency records | Original-response replay, conflicting retry rejection, single-use credential issuance |
| Preserve three views and project management | prototype.html, board.js, board.css | Prior demo view verification, current authenticated project/ticket creation and reload; no redesign |
| Netlify hosting preparation | netlify.toml, function adapter, build script | Request/Response adapter regressions, local function packaging, whitelisted public assets with secret fixtures excluded |

The final regression run includes 26 Node tests plus the separate disposable
demo integration check. Dependency audit reports zero vulnerabilities.
The function packages successfully through the installed Netlify CLI. Git diff
whitespace checks pass. No current CI run or hosted runtime is implied.

## Browser evidence

Chrome, normal desktop viewport and an emulated 390 by 844 mobile viewport.
The disposable UI harness uses memory storage and a test-only password, not a
real owner credential or Neon connection.

- [Desktop password screen](screenshots/password-access-desktop.png).
- [Signed-in project and ticket](screenshots/password-board-desktop.png).
- [Mobile sign-out screen](screenshots/password-access-mobile.png).

Observed wrong-password message, cleared password input, successful login,
project/ticket creation, authenticated reload, and sign out removing private
content. Mobile document width was 390 px at a 390 px viewport, with 24 px panel
padding and a 44 px password field. No horizontal overflow was observed.

Session expiry was exercised through HTTP regressions, not by waiting eight
hours in the browser. Physical mobile devices, other browser engines, and the
actual hosted login remain untested. Initial checking hides the board in HTML;
the transient checking frame was not captured separately.

The Impeccable skill preserved the approved App Stylr identity for the access
panel. Detector warnings and the optional product metadata migration are
recorded in [design exceptions](app-stylr-exceptions.md).

## Unverified at the initial local checkpoint

- Login/session/throttle and agent enforcement against the live database through
  an actual HTTP or hosted application. Those paths have local adapter tests;
  the live storage check uses a temporary direct harness session.
- Actual Netlify project linking, environment values, HTTPS deployment, private
  API denial, public asset exposure and preview isolation.
- Production database setup or migration. Configuration blocks that target.
- Real agent credential issuance, a credential management UI, and any real
  ledger import. API token behavior is tested with disposable credentials only.

## Live development evidence

Kyle configured credentials locally. The environment file is ignored by Git and
has permissions 600. Configuration validation confirmed the previously verified
development host without exposing passwords or connection strings.

The restricted execution environment could not resolve database DNS or bind
temporary test servers. Retrying with approved network/loopback permissions
resolved those restrictions. A read-only check confirmed TLS-verified database
authentication and no existing application schema before migration.

`npm run db:migrate` passed with schema version 1. `npm run db:check` passed for
live storage, transactional rollback, competing claims, retry deduplication and
persistence through a new connection pool. It left one archived verification
project, its ticket and audit history, and removed its own temporary session.
Production was not targeted. All 21 local tests, the separate demo integration
check and the six-asset build also passed in this turn.

Netlify account status was verified again. The checkout remains unlinked;
no site creation, deployment, source push or production migration was performed.

## Verification fixture cleanup

Kyle authorized removal of `Storage verification e8cfcb35`. A fresh read confirmed
project ID `5e6540e3-dcd8-4d31-83f7-88e8ae7565e6`, archived revision 2, one test
ticket `PLNR-1` at revision 3, and no linked agents. Exact identity/revision checks
guarded deletion of that project, ticket and associated retry record. Read-back
confirmed removal, preservation of the original audit entries and unrelated
projects/tickets, and an unchanged monotonic ticket counter. These test records
were deleted, not hidden or archived again; audit is retained, not a full backup.

`scripts/verify-storage.mjs` now owns the check's fixture lifecycle. Its finally
cleanup removes only the current run's project, ticket, project-scoped retry
records and temporary session, preserving audit and ticket numbering. Unexpected
project changes, extra tickets or linked agents block cleanup. Cleanup failures
fail the command instead of being silently swallowed. Normal test failures still
run cleanup; abrupt termination or loss of database access can prevent it.

Five new regression tests cover exact scope, unrelated-data and audit retention,
repeat cleanup, success, partial failure, cleanup refusal and cleanup-error
reporting. The complete 26-test suite, demo integration check and public-assets
build passed after the change. No browser layout or public API was changed.

The updated `npm run db:check` also passed against the isolated Neon development
branch. It exercised a new connection pool and verified removal of its own
project, ticket, retry record and temporary session before reporting success.

## Process safety

The current password UI harness closes its own server after five minutes.
The two older disposable preview processes on 4209 and 4210 were not stopped
without exact user approval. No user-owned application or preview was closed.

Follow [local setup](local-setup.md) and [Netlify setup](netlify-setup.md) for the
remaining gates.
