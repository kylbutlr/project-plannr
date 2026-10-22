# Board refinements verification

October 1, 2026. Source verification uses disposable local demo data, not real
tickets or a hosted database. This document does not certify a deployment.

## Scope and coverage

| Requested outcome | Implementation | Final evidence |
| --- | --- | --- |
| Search every status, including unloaded tickets | Browser opts into `searchScope=all`; memory and SQL filter ID, title and description before paging | Seven new regression tests include hidden matches in all three views. Browser found the fifteenth active fixture and oldest completed fixture without loading preceding pages |
| Remember collapsible project swimlanes | Device-local project ID preferences, semantic Expand/Collapse buttons, focus restoration, no observers on hidden columns | Collapse persisted through reload. Search expanded both projects temporarily; Clear restored the collapsed project. Hidden columns stayed at their initial 5 cards |
| Discover remote changes without disrupting work | Authenticated `/api/changes` returns a revision fingerprint; browser polls metadata, never replaces the board in the background | Second-session status edits produced a notice. An open draft remained unchanged. A separate scrolled column kept 10 cards and scrollTop 765.5 before and after notification |
| Retain independent bounded pagination | Existing 5-per-project / 10-combined pages, cursor filters now also bind search scope | All prior paging tests pass. Browser End loaded 5 more in one column, leaving other visible and hidden columns at 5 |
| Explicit refresh applies updates | Notice button uses existing Refresh semantics, with first-page reset explained beside it; a 404 for an archived selected project falls back to All projects | Notice cleared; updated status appeared; loaded column returned to 5. Archived-project fallback was inspected in source, not exercised in browser QA |
| Keep agent authorization and backlog behavior | Default agent reads retain all active work and completed-only search; change checks use scoped projects | Tests reject anonymous/other-project reads and revoked agents, preserve legacy active counts, and detect scoped agent claims and notes |

Drag-to-reorder priorities remains deferred. No real tickets, credentials,
infrastructure settings, or vendored App Stylr assets were changed.

## Checks

- `npm run check`: 79 tests plus isolated HTTP acceptance checks passed.
- `npm run build`: ten whitelisted public assets, no environment/backend files.
- `git diff --check`: passed.
- Impeccable detector: only the existing Geist font warning, retained under the
  approved [App Stylr exception](app-stylr-exceptions.md).
- SQL query contracts verify bound search values, bounded page reads and scoped
  revision aggregation. They are mocks, not a live PostgreSQL execution claim.

The first sandboxed full test run could not bind loopback sockets. The complete
suite then passed with the approved disposable-server execution permission.

## Browser evidence

Desktop verification used the in-app browser's actual 1280px viewport. The
viewport override was ignored. Mobile verification therefore used a disposable
same-origin embedded document, 390px outer width and 375px usable width after the
scrollbar, with the application's actual responsive CSS and interactions. It
reported no horizontal overflow and 400px Swimlane caps. This is responsive
rendering evidence, not physical-device or touch-browser QA.
An optional Control+Home screenshot navigation failed in the embedded document;
no alternate native shortcuts were sent. The mobile search/results capture was
already saved, and a final DOM read confirmed Clear restored the collapsed state.

Only the disposable demo fixture allows same-origin framing for this test.
The private local server and hosted application retain `frame-ancestors 'none'`.

- [Desktop notice and collapsed project](screenshots/board-improvements-desktop.jpg)
- [Search result from oldest completed history](screenshots/board-improvements-search.jpg)
- [Narrow-viewport search and results](screenshots/board-improvements-mobile.jpg)

## Release boundary and operational cost

The change fingerprint aggregates ticket counts and revision sums per accessible
project, plus project revisions. It does not rely on the last 100 activity rows,
send full tickets, or mutate data. PostgreSQL computes the aggregate in SQL;
this still scans matching ticket metadata and is not a constant-time check.
Initial board data and its fingerprint share one repeatable-read transaction.

Polling occurs every 30 seconds only while visible and active within the last
three minutes; returning to the tab also checks. Failed background reads retry
on the next interval. Authentication failures lock the board. Filter changes,
mutations and sign-out invalidate stale notifications. Refresh is explicit and
resets pages; notifications alone do not reset them or overwrite drafts.

Publication and hosted database smoke verification are documented separately in
[the October 1 hosted verification](hosted-board-verification.md). The local
fixture evidence above remains the coverage for remote-edit notices and narrow
layouts; those are not claimed as hosted multi-session or physical-device tests.
