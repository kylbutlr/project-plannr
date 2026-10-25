# Neon request audit, October 25, 2026

Scope: investigate consumption and reduce unnecessary work while preserving the
existing notification model. No deployment, migrations, production configuration,
compute sizing, suspension settings, or resource deletion is part of this change.

## Evidence and environment

- User-provided Consumption V2 baseline, October 1 through 24 UTC: 24.475 CU-hours
  and approximately 7.72 GB public network transfer. The user observed essentially
  all current-cycle compute on development, `br-tiny-math-ar2pbuta`. These are usage
  measurements, not an avoidable-usage estimate. This audit did not independently
  re-fetch the billing history.
- Refreshed `origin/main`: `1419a65e053dddb36e8c060e55bca1a03c0b04db`.
  GitHub search returned no open PRs; `git ls-remote --heads` returned only `main`.
  Old local feature branches were preserved. Work is isolated on
  `kylebutler/neon-request-efficiency`, without a protected upstream.
- Netlify API, 2026-10-25 23:05 UTC: published deployment
  [`6adb039df8430aa60a17a5ed`](https://app.netlify.com/projects/project-plannr/deploys/6adb039df8430aa60a17a5ed)
  is ready and serves that exact commit from `main`. Live `board.js` (35,614 bytes)
  and `board-client.js` (4,491 bytes) matched checkout bytes before editing.
  This verifies the deployed client code; no live timing trace was available.
- Published site's `DATABASE_URL` hostname matches `PLANNR_DATABASE_HOST` and
  the ignored local configuration. The configured branch label is `development`.
  Only production-context values exist for the six site environment settings.
  The hostname is `ep-still-term-arj4ndmz-pooler.c-4.us-west-2.aws.neon.tech`.
  Credentials were never included in output or source.
- Numeric development/root IDs are sourced from the user's baseline and
  [provisioning documentation](provisioning-status.md). Neon Console required
  sign-in and no Neon Management API credential was available. Therefore the
  hostname-to-numeric-branch mapping was not independently refreshed. Root branch
  `br-spring-fog-ar2mjhqg` was not connected to or queried.
- Netlify allows only `main`; the latest 15 deployments were production-context
  deployments. No active preview database configuration was found. The adapter
  requires the configured origin before executing APIs. A branch URL is not
  independently enabled access. Older deployment runtime settings were not
  individually queried. `allowed_branches` alone does not disable PR previews;
  `skip_prs` is unset. The requested draft PR and commit use `[skip netlify]`,
  following [Netlify's skip-deploy instructions](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/#skip-a-deploy),
  to prevent deployment without changing site settings.
- Read-only PostgreSQL audit at 23:07 UTC against the verified configured host:
  84 tickets, 2 projects, 2 agent records, 2 session records, 1 attempt record,
  178 replay records. Snapshot bytes below are JSON text sizes, excluding PostgreSQL
  protocol overhead, TLS, compression and billing rounding.
- One `pg_stat_activity` snapshot showed only this audit's connection. This rules
  out other connections at that instant, not periodic external clients. The audit
  connection was closed. No migration, fixture import or remote write was run.
- Granola returned no meetings matching Project Plannr. Current behavior and
  requirements came from `PRODUCT.md`, the repo, existing verification docs and
  this request.

Local evidence is retained in ignored `outputs/neon-audit/hosting.json` and
`database.json`. Public report contains only aggregate workspace sizes. Database
contents, cookies, credentials and private tickets are excluded.

## Request-to-database map

All private HTTP requests cross `lib/api.mjs`; local HTTP is `server.mjs`, hosted
HTTP is `netlify/functions/workspace.mjs`. `lib/config.mjs` validates the explicit
host/branch label. It does not independently query Neon to resolve the branch ID.
PostgreSQL is lazy: constructing the pool does not execute a query. The pool has
max 3 clients, a 10-second idle timeout and 15-second connection/statement timeouts.

| Trigger | Request and source | Database work | Automatic frequency / environment |
| --- | --- | --- | --- |
| Startup, sign-in, explicit session retry | `/api/session`, `board.js:checkSession`, `lib/api.mjs` | Anonymous check skips storage; cookie-bearing check reads fresh project/agent/session metadata | Once per action; published site uses configured development host |
| Initial board, explicit refresh, view/filter/search/sort changes, successful creates/project edits/status changes | `/api/board`, `board.js:load`, `lib/workspace.mjs:board` | `postgresStore.readBoard`: metadata + activity + paged tickets/counts + revision aggregate, one repeatable-read snapshot | On demand, no periodic full-board reload |
| Timer, visible-tab return, reconnect after this patch | `/api/changes?project=...`, `board.js:checkChanges` | `readChanges`: fresh auth/project metadata + `sqlChanges` aggregate + hash | 30 seconds while visible and active within 3 minutes; skip during initial load/mutation and after notice |
| Lane sentinel, scroll near end, explicit Retry | `/api/lane`, `board.js:loadLane` | Auth metadata + bounded ticket page/count | User scroll/intersection; per-lane gate prevents overlap; failed lane requires explicit retry |
| Ranked queue Load more | `/api/completed`, `board.js:loadMore` | Auth metadata + up to 21 rows + count, returns up to 20 | On demand; per-page gate |
| Explicit reload-ticket; safe conflict resolution | `/api/tickets/:id`, `board.js`, `board-client.js:createTicketUpdates` | Auth metadata + one ticket | On demand; one bounded safe retry on conflict, never an automatic retry loop |
| Ticket/project changes, claims/renewals, credential management | POST/PATCH `/api/*`, `lib/workspace.mjs:mutate` | Serialized workspace lock, complete state + last 100 audit rows, revision/scope/idempotency validation, changed-row writes and audit in one transaction | User/agent commands; no scheduled renewal loop |
| Sign-in/sign-out | `/auth/login`, `/auth/logout`, `lib/auth.mjs`, `lib/api.mjs` | Full locked state transaction; login throttling, session changes, audit | Explicit actions; no session heartbeat |
| Legacy agents and manual tooling | `/api/state`, `/api/agents`, `agent.mjs`, `lib/agent-command.mjs` | Generic `store.read`: workspace counter + ALL entities, including retry records, + 100 audit rows; response filters private auth/retry data | Explicit one-shot CLI commands; no timer in these clients |
| Shared roadmap client | `scripts/roadmap.mjs`, `lib/planning-client.mjs` | Board/ticket/mutation endpoints with scoped token, 20-second fetch deadline | One request per command, no automatic retry; branch follows configured destination API |
| Worldrawn integration | sibling `worldrawn/scripts/plannr.mjs` | Same hosted board/ticket/claim/note endpoints | One-shot commands, 20-second deadline; no timer. Same published development host |
| App Launchr | sibling `app-launchr/public/catalog-metadata.js` | Opens hosted Project Plannr URL | No independent Project Plannr sync loop found; opened page behaves as web client |
| Onboarding/import/storage checks | `scripts/onboard-project.mjs`, `import-worldrawn-ledger.mjs`, `database-check.mjs`, `migrate.mjs` | Explicit API calls or direct configured DB transactions; some intentionally write fixtures or schema | Opt-in only. Not invoked by build/CI or this audit |
| Local development / packaged server | `server.mjs`, `npm run dev/start/start:local` | Loads local `.env` on startup; configured DB uses same development host, otherwise local file | Server alone has no polling job; connected clients cause requests |
| Demo/private QA fixtures | `scripts/*ui-check-server.mjs` | In-memory only; explicit configuration, never loads `.env` | No Neon access |
| Build, CI, packaging | `scripts/build.mjs`, `.github/workflows/check.yml`, `scripts/package-release.mjs` | Tests use disposable stores; build copies allowlisted assets, no DB initialization | No DB health ping, cron job, service worker, native client or scheduled Netlify function found in this repo |

This source trace cannot enumerate unknown external agents, browser copies, native
wrappers or independently configured monitors. Visible inactive windows retain the
existing 3-minute activity policy. Separate active tabs/windows continue to poll
independently; no cross-tab coordinator or shared authentication cache was added.
Hidden clients stop starting checks; offline clients now skip them explicitly.

## Findings and patch

1. **Unused database egress.** `lib/store.mjs:selectedRead` unconditionally fetched
   100 audit rows for revision, access, lane, completed-history and ticket reads.
   None of those responses uses activity. Make activity opt-in only for initial
   board snapshots. Fresh authorization and repeatable-read consistency remain.
2. **Overlapping background reads.** The old `createReadGate` rejected stale results
   but allowed multiple `/api/changes` requests. Use a single-flight, abortable
   `createChangeGate` in the existing client module. Invalidation on mutations,
   filters, board reload, sign-out, hidden state, offline and page exit cancels
   the obsolete client read. A 30-second deadline releases stalled checks.
   Responses are validated before processing 401, so an obsolete response cannot
   lock a newer board/session. Fetch cancellation is not a guarantee that SQL
   already admitted by the server stops running.
3. **Redundant checks after notification.** Once Updates available is shown, further
   metadata cannot make the notice more useful. Pause until explicit board refresh
   establishes a new token. The board, draft, expanded pages and scroll position
   are untouched. No additional service, migration, database cache or event bus.
4. **Reconnect.** Skip offline reads and check immediately on a visible client's
   online event. Coalesce concurrent visibility/online/timer events. Failures retry
   only at the normal interval. Existing one-safe-retry mutation behavior remains.
5. **Revision query is not constant time.** `lib/board-changes.mjs:sqlChanges` sums
   ticket revisions and counts per accessible project, incorporating project
   revisions/archived state in the hash. It scans matching ticket JSONB. Current
   `EXPLAIN (ANALYZE, BUFFERS)` chose a sequential scan of 269 entities, returned
   84 ticket rows and 2 aggregates, 376 shared-buffer hits, 0 reads; planning
   0.091 ms, execution 2.064 ms in one sample. This does not establish production
   latency percentiles. No index or stored revision counter is justified by this
   sample. A transactional counter would need a separate design/migration review.
6. **Larger amplification to investigate separately.** Replay JSON text totaled
   8,987,089 bytes, tickets 1,400,925 bytes. The generic `load` selects every entity
   for writes and `/api/state`/`/api/agents`, about 10.39 MB before activity and wire
   overhead. Retry responses include complete ticket bodies. This is not browser
   periodic polling, but repeated agent mutations/full-state reads can be costly.
   Do not delete retry records, shorten idempotency retention, rewrite transactions
   or remove legacy API behavior as part of this narrow patch. A follow-up should
   measure endpoint invocation counts, then evaluate specialized authorized reads
   and targeted replay lookup while preserving locking, stale writes and replay
   fidelity. No portion of the 7.72 GB baseline is attributed to it without logs.

## Source locations

- [Database selected reads and board-only activity](../lib/store.mjs#L98),
  [generic full-state transaction](../lib/store.mjs#L58).
- [Revision polling and lifecycle handlers](../board.js#L296),
  [initial loading and cancellation](../board.js#L72),
  [single-flight gate](../board-client.js#L11).
- [Revision aggregate](../lib/board-changes.mjs#L19),
  [authenticated API routing](../lib/api.mjs#L24),
  [workspace selection and mutations](../lib/workspace.mjs#L30).
- [Board SQL](../lib/board-page.mjs), [lane SQL](../lib/lane-page.mjs),
  [scope and session checks](../lib/auth.mjs), [host configuration](../lib/config.mjs),
  [Netlify adapter](../netlify/functions/workspace.mjs).
- [Roadmap client](../lib/planning-client.mjs#L31), [one-shot agent](../agent.mjs),
  [build](../scripts/build.mjs), [CI](../.github/workflows/check.yml).
- [Database regressions](../test/read-efficiency.test.mjs),
  [client regressions](../test/board-client.test.mjs),
  [browser regression](../scripts/verify-polling-browser.js).

## Before/after evidence

| Scenario | Before | After | Evidence / limit |
| --- | --- | --- | --- |
| Successful revision transaction | 5 SQL commands | 4 | Mock pool records real adapter calls: BEGIN, metadata, optional audit, aggregate, COMMIT |
| Revision API JSON body | 82 bytes | 82 bytes | Actual serialization of the API response with the unchanged 64-character token |
| Unused audit JSON per revision/access/page/ticket read | 100 rows, 28,018 bytes at sampled live state | 0 rows, 0 bytes | Live read-only size measurement + adapter regression; excludes wire overhead |
| Database selected metadata JSON | 1,253 bytes | 1,253 bytes | Current project/agent/session rows; still fresh per request |
| Active client, no notice | 120 checks/hour if continuously active | 120 checks/hour if continuously active | 30-second source interval; not a measured hour of production traffic |
| Overlapping visibility events | 2 in-flight fetches | 1 | Real browser with delayed fixture responses |
| Further triggers with Updates available | Continues polling | 0 checks until refresh | Fixture browser checks; first notice still discovered at normal cadence |
| Hidden or idle steady state | 0 checks | 0 checks | Existing visibility/activity policy retained |
| Offline steady state | Attempts at normal cadence while recently active | 0 checks; immediate visible reconnect check | Fixture browser with offline simulation |

At the sampled audit size, eliminating audit reads saves an estimated 3,362,160
JSON-text bytes per continuously active client-hour (120 x 28,018), plus wire
bytes and the removed query. This extrapolation is not billed egress savings.
Pending notices and duplicate suppression yield workload-dependent reductions.
No before/after CU-hour or billed-transfer comparison is available because the
patch is not deployed. Do not apply a percentage to the user's monthly baseline.

## Freshness and correctness tradeoffs

- Initial board and action-triggered refreshes remain immediate and uncached.
  The active 30-second check and 3-minute idle boundary remain. Scheduling/network
  delays mean 30 seconds is an interval, not a strict delivery SLA.
- A pending notice pauses checks until explicit refresh. Discovery is already
  complete; later edits are included by that refresh. Background session-expiry or
  revocation discovery is also deferred during this pause. Every actual private
  request still reauthorizes server-side, and its current 401 locks the client.
  Existing idle/hidden clients already defer such background discovery.
- A stalled revision fetch is aborted at 30 seconds and retried at the next normal
  interval, not immediately. On a slow network this may postpone a notice. Initial
  loads and mutation requests have no new timeout or retry policy.
- No adaptive backoff on unchanged tokens: it would lengthen remote-edit discovery
  for an actively used client. No cached authorization, cross-client token sharing,
  project revision materialization, or longer global interval was introduced.
- Separate clients still produce separate checks. An active client can keep Neon
  awake. [Neon's compute documentation](https://neon.com/docs/manage/endpoints/)
  explains that connection requests reset the suspension timer. Reduced query work
  does not imply proportional CU-hour savings. This patch leaves all sizing and
  suspension settings untouched.

## Validation and rollout

Final checks passed with Node 22.23.1: `npm run check` (109 tests plus the isolated
HTTP acceptance check), `npm run build` (14 allowlisted assets), browser-script
syntax, and `git diff --check`. The first full check had 20 loopback socket
`EPERM` failures in the sandbox; the unchanged suite passed with local-socket
permission. The initial demo UI fixture was stale after the public refresh, so
this audit used the existing private in-memory fixture instead.

The browser pass used Chromium, accelerated time, simulated visibility/offline
state, and a separate session through an HTTP client. It verified active cadence,
idle pause, coalescing, hidden-read abort, reconnect, two-client updates, draft/
page/scroll retention, explicit refresh, local mutation cancellation, stale vs
current 401 behavior and normal-interval failure retry. Three console errors
were the intentionally injected 503/503/401 responses; no script exception
remained in the passing run. This is not physical-window or hosted multi-client
acceptance, and no hour-long live request trace is claimed. Early harness
failures from assumed ticket IDs and focus-induced scrolling were corrected
before the passing run; their logs are preserved.

Fixture session `47742`, PID `45607`, command
`node scripts/auth-ui-check-server.mjs 4208 600000`, repo `project-plannr`, and
Playwright session `plannr-neon`, PID `47482`, were stopped. Both PIDs exited and
port 4208 was verified closed. The task-owned Neon sign-in tab was closed; the
existing user-owned hosted board was left open without a reload.

For future verification, run `npm run check` and `npm run build` with Node 22.13 or newer. The focused
store tests use the actual Postgres adapter with a recording pool and compare
change tokens to board snapshots; real database size/query evidence is separately
identified above. Browser verification uses one private in-memory fixture and an
independent HTTP writer, with no hosted mutations.

For a local rerun, first confirm port 4208 is free, then from this checkout:

```sh
node scripts/auth-ui-check-server.mjs 4208 600000
```

Open http://127.0.0.1:4208 in one task-owned Playwright CLI session, then run:

```sh
playwright-cli -s=plannr-neon run-code --filename scripts/verify-polling-browser.js
playwright-cli -s=plannr-neon close
```

The script refuses another origin and expects the fictional fixture password.
The server binds the exact port and fails if occupied; it has no alternate-port
fallback. Stop with Ctrl+C in its terminal and verify the port is closed. The
fixture expires after ten minutes. All test data is in memory.

After separately authorized review/merge/deployment:

1. Record the prior published deploy ID, current revision API payload/latency,
   invocation counts by endpoint, active-client count and client activity windows.
   Record development and root Consumption V2 metrics separately. Use equal UTC
   windows and comparable workloads; monitoring the Consumption API does not need
   a database keep-alive query. Follow [Consumption V2](https://api-docs.neon.tech/reference/getconsumptionhistoryperprojectv2).
2. Verify Netlify published exactly the reviewed commit and the expected function
   bundle plus both client assets. Preserve the configured database host/origin.
   Do not switch to the root branch or change sizing/suspension settings.
3. Use disposable local data for destructive/mutation regression. On the hosted
   site, inspect initial load and normal requests read-only. For hosted two-client
   mutations, obtain separate authorization for exact disposable fixtures first.
4. Verify one active visible client checks at 30 seconds; hidden/offline/idle
   clients make no periodic requests. Reconnect must check immediately. A pending
   notice must stop checks and retain draft/pages/position. Explicit refresh must
   show remote changes and resume checks. Check current vs obsolete 401 behavior.
5. Compare total request counts, per-endpoint DB JSON/egress, response errors,
   latency and daily branch metrics over a comparable 24-hour window, then several
   days. Record measured changes separately from client-hour extrapolations.
   Billing alone cannot establish the cause without endpoint/client counts.

Rollback requires separate authorization. Restore the prior Netlify deploy
`6adb039df8430aa60a17a5ed` (if still the last known good), or revert the focused
code commit through a reviewed PR and deploy. Reload/reopen clients after saving
or explicitly discarding drafts so they receive the old assets. Recheck sign-in,
board load, mutation and notifications. No schema or data rollback is needed.
Never force-refresh a user's unsaved draft or change database settings to roll back.
