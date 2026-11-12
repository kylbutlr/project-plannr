# Remembered sign-in and ticket priority verification

Verified October 1, 2026 on `kylebutler/remember-workspace-sign-in`, based on
`dd5580bd606378b4744391d4c4720439342f564e`. This records local implementation
and disposable verification, not a hosted release. No live tickets, credentials,
database schema, or deployment were changed.

## Requirement coverage

| Requirement | Implementation | Verification |
| --- | --- | --- |
| Opt-in Remember me for 30 days | Native checkbox; strict boolean API input; persistent HttpOnly cookie and absolute server expiry | Cookie attributes, exact duration, cold-handler restoration, reload in browser |
| Unchecked sign-in remains temporary | Browser-session cookie with eight-hour absolute server expiry | Omitted and false inputs; no Max-Age or Expires; expiry tests |
| Automatically restore valid access | Existing session check authenticates returning browser | Desktop reload opens board without another password entry |
| Sign out revokes access | Session deletion and clearing cookie; choice resets | Server revocation and CSRF tests; desktop sign-out |
| Locked and checking states protect the board | Private board remains hidden until authenticated | Signed-out, paused session-check, signed-in, and expired-session browser checks |
| P0, P1, P2, P3 with visible colors | Shared level definitions; creation/editor selects; red, amber, teal, gray badges with text | Browser creation and edit; API validation; rendered contrast checks |
| Selectable Swimlane and Kanban sorting | Default prioritizes active work and keeps Completed chronological; explicit Priority and Recent; browser-local preference | All eighteen sort/view/status combinations across multiple pages, without duplicate or missing tickets; selector and reload persistence verified |
| Preserve existing tickets | Missing levels read as P2; numeric queue ranks remain unchanged | Read-only legacy tests; edits preserve rank; imports retain omitted-field hash shape |
| Agent clients use the same active order | Shared priority comparator in both clients | Agent ordering test and complete suite |

P0 means Critical, P1 High, P2 Normal, and P3 Low. Default sorts active columns
by priority, preserving queue rank and ID ties, and Completed by newest completion.
Priority sorts every column P0 first, with completion recency as its Completed
tie-breaker. Recent uses newest added active tickets (descending numeric ticket
sequence) and newest completed tickets. Changing sort resets pages and invalidates
old cursors. The control is limited to Swimlanes and Kanban. The separate Completed
history in Ranked queue remains chronological. Old pagination cursors receive
an explicit refresh error rather than silently using an obsolete ordering.

## Checks passed

- `npm run check`: 92 tests passed, zero failures or skips; application checks
  and pinned-icon verification passed.
- `npm run build`: eleven whitelisted public assets; backend source, secrets,
  and local data excluded.
- `git diff --check`: passed.
- Eighteen actual PostgreSQL sorting/pagination cases passed in `BEGIN READ ONLY`, using
  only inline fictional JSON rows. The test executed the application SQL with
  its entity table reference replaced by an inline fixture. No stored entity
  tables were read; no schema or database writes were made. The transaction
  was rolled back and connection closed.
  This caught and corrected a Recent-mode ORDER BY constant parsed as a column
  position; the final rerun passed every mode and continuation page.
- Desktop and narrow-screen browser checks covered the native checkbox,
  wrong-password retry, sign-in, reload restoration, sign-out, session expiry,
  ticket creation/edit, and automatic loading of later priority-sorted pages.
- Narrow-screen checks found no horizontal document overflow. The checkbox
  label has a 44 px clickable height; the sign-in panel retains 24 px padding.
- Badge text contrast measured P0 6.93:1, P1 8.54:1, P2 8.14:1, P3 8.06:1.
  Priority is conveyed by text as well as color.

The browser fixture uses an in-memory workspace, a test-only password, and a
fake clock. It never loads owner configuration or accesses real project data.
Its loopback listener has a bounded lifetime and does not stop other previews.
The additional paused-session fixture verified the checking state; its resume
request was attempted after its listener lifetime ended and was not verified.

## Screenshots

- [Desktop sign-in](screenshots/remember-sign-in-desktop.png)
- [Narrow-screen sign-in](screenshots/remember-sign-in-mobile.png)
- [Desktop priority-sorted Kanban](screenshots/priority-kanban-desktop.png)
- [Narrow-screen ticket creation controls](screenshots/priority-swimlanes-mobile.png)
- [Desktop sort selector](screenshots/board-sort-desktop.png)
- [Narrow-screen sort selector](screenshots/board-sort-mobile.png)

The narrow-screen board screenshot captures the creation controls, not all cards
below the fold. Priority ordering and card controls on that viewport were also
checked through rendered browser state.
The sort follow-up verified Default and Priority completion ordering, Recent
active ordering, preference persistence after reload, Kanban's ten-card pages,
the hidden selector in Ranked queue, and narrow-screen sorting without document
overflow (375 px client and scroll width). An initial reload occurred after the
bounded fixture expired; it was restarted with a fresh disposable session before
the final verification. No persistent user preview was stopped.

## Security and release boundary

Remembered access expires 30 days after sign-in, not 30 days after last use.
Session reads do not extend it. Password changes invalidate sessions; sign-out
revokes the current browser session without revoking other browsers. No password
or authentication token is stored in browser local storage.

Actual browser quitting/restarting and real hosted remembered-session behavior
were not tested. Browser restoration settings can retain session cookies, so
closing a window is not a reliable substitute for signing out on a shared device.
See [MDN cookie guidance](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).

This is a narrow App Stylr refinement, not a redesign. Native controls, Geist,
focus styles, incumbent layout, and the pinned adapter remain intact. Existing
detector limitations are documented in [App Stylr exceptions](app-stylr-exceptions.md).

Publishing requires approval for the feature push and PR, followed by a merge
and hosted deployment. Then verify Remember me, session restoration, sign-out,
and priority pagination on the deployed private development workspace.
