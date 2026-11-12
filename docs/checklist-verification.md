# Ticket checklist verification, October 7, 2026

Local feature branch: `kylebutler/ticket-checklists`, based on verified
`origin/main` at `829dcc1`. The hosted board, database and real ticket contents
were not changed. No migration, push, PR, merge or deployment was performed.

## Request coverage

The user requested individually added and checkable steps on every ticket, plus
quick visual progress as ticket scope grows. Preflight reviewed this complete
request, repository AGENTS.md, README.md, PRODUCT.md, ticket editor, board views,
workspace API, storage, scoped roadmap command and tests. Final QA repeated the
mapping below. PLNR-47 motivated the feature; it was not rewritten or completed.
There is no separate originating implementation ticket with additional AC.

| Requirement | Implementation | Final verification |
| --- | --- | --- |
| Add checklist items to a ticket | Ticket editor's Checklist section, stable item IDs | Add item, Enter-to-add and Save with pending new text exercised in Chrome |
| Check individual steps independently | Native labeled checkboxes | Mouse check/uncheck and keyboard Space, 4/4 complete without status change |
| Maintain growing scope | Edit text, remove individual rows, 100-item/300-character bounds | Edit/remove on desktop and mobile; 100-item HTTP batch and limit tests |
| Quick visual progress | Completed/total text and native progress bar on shared ticket card | Swimlanes, Kanban and Ranked queue inspected at desktop and mobile widths |
| Preserve drafts and other work | Existing Save/Cancel workflow and optimistic concurrency | Cancel restored original items; Save survived reload; competing remote edit kept local draft |
| Keep roadmap current through agents | Five shared checklist commands | End-to-end scoped credential claim/add/edit/check/uncheck/remove test |
| Preserve old tickets and owner review | Missing list means empty; no Markdown conversion or automatic status change | Legacy ticket tests, empty editor and status independence tested |
| Persist and audit safely | Existing transaction, revision, idempotency and JSON ticket storage | File-store close/reopen, replay, rollback, CSRF, scope and expired-claim tests |

## Exact browser review

Chrome, connected sdg.la profile, disposable fixture at
`http://127.0.0.1:4208/?view=swimlanes`, also using `?view=kanban` and
`?view=queue`. Served repository source directly. Started only
`scripts/ui-check-server.mjs`, which never reads .env or connects to Neon.
The signed-in hosted browser tab and its open ticket editor stayed untouched.
All edits used synthetic TF-DEMO tickets in memory.

Reviewed at 1440 x 1080 and 390 x 844 CSS pixels, then reset the temporary viewport.
Screenshots show one representative synthetic 3/4-complete list. Mobile editor
upper/lower captures overlap and together show all checklist controls.

- [Editor, desktop](screenshots/checklist-editor-desktop.jpg)
- [Editor, mobile upper section](screenshots/checklist-editor-mobile-top.jpg)
- [Editor, mobile lower section and Save/Cancel](screenshots/checklist-editor-mobile.jpg)
- [Swimlanes, desktop](screenshots/checklist-board-desktop.jpg)
- [Swimlanes, mobile](screenshots/checklist-board-mobile.jpg)
- [Kanban, desktop](screenshots/checklist-kanban-desktop.jpg)
- [Kanban, mobile](screenshots/checklist-kanban-mobile.jpg)
- [Ranked queue, desktop](screenshots/checklist-queue-desktop.jpg)
- [Ranked queue, mobile](screenshots/checklist-queue-mobile.jpg)
- [Conflict recovery prompt](screenshots/checklist-conflict-desktop.jpg)

Verified browser interactions: add, edit, remove, mouse toggle, keyboard toggle,
Enter-to-add without submission, empty-item error, Save including pending new text,
Cancel, reload persistence, empty legacy editor, all three board views, and
full-checklist completion preserving Next status. The owner can keep a ticket
open while its steps are done.

For concurrency, an API edit changed one step in the disposable fixture while a
browser draft was open. Save showed the conflict prompt. DOM input-value inspection
confirmed `My unsaved review draft` remained intact. Choosing Use latest ticket
and discard my draft then showed `Another remote review requirement`.

No document or card horizontal overflow was measured at the reviewed widths.
Mobile document width was 375 with a 390 viewport, accounting for the scrollbar;
card client width equaled scroll width. Captured browser warnings/errors were empty.
This is Chrome evidence, not Safari or screen-reader certification.

## Automated verification and review

Node 22.23.1. `npm run check`: 100 tests pass, plus syntax, icon checks and the
workspace integration check. `npm run build`: 12 explicitly whitelisted public
assets; no environment files or backend source published. `git diff --check` passes.

Focused coverage is in [checklist tests](../test/ticket-checklist.test.mjs),
[workspace tests](../test/workspace.test.mjs),
[browser coordination tests](../test/board-client.test.mjs),
[shared roadmap tests](../test/project-onboarding.test.mjs) and
[publish whitelist tests](../test/build.test.mjs).

The initial sandbox run could not bind loopback test servers. Rerunning with
loopback permission exposed one test-setup error: an initial file-store seed was
not yet persisted. The test now explicitly persists before reopening; the final
complete suite passes. These were validation-environment/test-setup findings.

Impeccable detector ran once on changed UI files. Its sole warning was the
pre-existing Geist font, explicitly required by this repository's pinned
App Stylr contract. No replacement font or redesign was introduced. A fresh
Impeccable finish reviewer opened all nine UI captures and both review copies:
`disposition: ship`, no material fixes. The review covers this inherited-world
extension, with no approved comp, new visual identity or formal concept round.
A final source-only correction collects controls after adding pending text, so
newly rendered checklist rows are also disabled while saving. Browser Save and
full checks were repeated after that correction. The fresh documenter confirmed
final behavior documentation and built-source parity, correcting the README
asset count and narrowing the API retry wording to checklist-changing patches.
No system drift or new design files were introduced.

## Publication and remaining boundaries

No real database round trip or hosted checklist QA was performed. Existing
Postgres storage already writes complete ticket JSONB, including this list, so
no schema migration is needed. Local file persistence is tested. Owner cookie,
Origin/CSRF, scoped claim, revision, replay and audit protections remain in use.

Publish UI and backend together after Kyle approves the remote release actions.
The single disposable preview remains open at port 4208 for owner review. Its
data resets when that preview is stopped; it is not durable project progress.
Then verify the hosted feature and explicitly authorize a PLNR-47 checklist
backfill using current evidence. Preserve its description and historical notes;
keep completion gaps and owner-review status visible. Checking steps alone must
not close the grouped ticket.
