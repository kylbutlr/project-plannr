# Private project board trial verification

Verified locally on 2026-09-30. This is disposable prototype evidence, not a
production acceptance verdict or an authoritative game roadmap.

## Observed checks

- Node syntax checks passed for server.mjs, board.js and agent.mjs.
- Browser ticket creation, detail opening, notes, status selection, game filtering,
  next-priority action and all three layout switches were exercised.
- The CLI list read browser-created and browser-edited tickets from the same state.
- Two concurrent HTTP clients attempted the same revisioned claim. Exactly one
  succeeded with HTTP 200; the other returned 409. A subsequent stale PATCH also
  returned 409, preserving the successful owner's state.
- Desktop 1440px and mobile 390px viewport captures were inspected for A, B and C.
  No horizontal page overflow was observed. Temporary viewport overrides were reset.
- The independent finish reviewer found activity hidden behind a disclosure. A
  visible latest actor/action line was added above the board. All six captures
  were refreshed; the reviewer scored that finding resolved with no visible
  regression from the fix.
- Root DESIGN.md, its sidecar, PRODUCT.md and the pinned CSS adapter are unchanged.

## Project management extension

- Browser creation of an App project, ticket creation within it, renaming and
  changing its type to Other, archive and restore were exercised. The ticket
  remained linked, disappeared from active views on archive, and returned on
  restore. Empty project swimlanes appeared immediately after creation.
- All three named views were exercised at desktop 1440px and mobile 390px.
  Ranked queue remained selected when navigating to the bare board URL;
  Project swimlanes was subsequently restored as the preview preference.
  A fresh browser with no preference starts with Project swimlanes.
- Mobile management and view screenshots showed no horizontal page overflow.
  Temporary viewport overrides were reset.
- check.mjs passed stable project/ticket IDs, rename/type editing, archive and
  restore, archived ticket write rejection, duplicate names, stale revisions,
  invalid-update atomicity, competing claims and cross-origin write rejection.
  Its own isolated server was stopped in the script's finally block.
- Independent finish review returned `ship` for this scoped prototype extension,
  with no material fixes. The single detector run could not resolve the virtual
  /tokens.css route; token/padding findings were checked against source and
  rendered captures. Geist remains the pinned interface typeface.

## Boundaries

- Drag-and-drop exists in source but was not exercised in the browser. Status
  selects provide the verified alternate path.
- No full keyboard, screen-reader, cross-browser, load or security audit occurred.
- In-memory state resets on server restart. Actor names are demo labels, not auth.
- No database, public account, hosted deployment or game-ledger migration occurred.
- Durable real planning use remains unvalidated. Kyle selected Project swimlanes
  as the default and retained both alternate views.

## Captured evidence

Review images live in ../../.impeccable/review/game-roadmap/: desktop.jpg,
swimlanes.jpg, queue.jpg, mobile.jpg, mobile-swimlanes.jpg and mobile-queue.jpg.
They are review evidence only, not shipping artwork.

Updated generic-board evidence lives in ../../.impeccable/review/project-board/:
desktop-swimlanes.png, desktop-kanban.png, desktop-queue.png,
desktop-projects.png, mobile-swimlanes.png, mobile-kanban.png, mobile-queue.png,
and mobile-projects.png. The screenshots include synthetic Notebook App work.
