# Project Plannr

One private planning workspace for games, apps, and other projects. Choose what
comes next, coordinate claimed work, and retain completed tickets and activity.

## Current state

Project swimlanes is the default view. Kanban and Ranked queue share the same
data. Projects support Game, App, and Other types, rename, archive, and restore.
Tickets open in an editable dialog with title, description, status, priority, and
notes. Save/Cancel keeps the board layout intact. Five-minute work reservations
remain available through the agent API, not in the everyday editor.

Priority levels are **P0: Critical**, **P1: High**, **P2: Normal**, and **P3: Low**,
shown with red, amber, teal, and gray badges. Choose a level when adding or editing
a ticket. Swimlane and Kanban **Default** sorting uses P0 first through P3 for
active work and newest completion first for Completed, including later pages.
Choose **Priority** for P0 first in every column, or **Recent** for newest added
active tickets and newest completed tickets. The choice is remembered on this
browser; switching resets column pages. Active priority ties retain the existing
queue rank and ID; Completed priority ties use newest completion. Existing tickets
without a level display P2; no bulk migration or guessed urgency is applied.
Ranked queue sorts active tickets by the same priority order, while its separate
Completed history keeps chronological pagination. See
[sign-in and priority verification](docs/sign-in-priority-verification.md).

**Remember me** is opt-in and stays signed in on that browser for 30 days from
sign-in. Returning or reloading opens the board automatically while the cookie
and server session remain valid. Unchecked sign-ins use a browser-session cookie
with an absolute eight-hour server limit. Sign out revokes that browser's session
immediately; changing the workspace password invalidates existing sessions.
No password or authentication token is stored in browser local storage. Browser
session-restore settings can retain even session cookies, so use Sign out on
shared devices rather than relying on closing a window.

Every Swimlane column loads **5 tickets per project** initially, then automatically
loads 5 more when scrolled near the bottom. Kanban starts with **10 per status**
across the selected projects and loads 10 more. All three status columns scroll
independently, capped at 480 px in Swimlanes and 660 px in Kanban (400 / 560 px
on narrow screens). Loading a page preserves the scroll position and keyboard
focus, with a Load more fallback and an explicit Retry button on failure.
Column headers show total matching counts, not just loaded cards.

Ranked queue keeps its combined 20-ticket Completed page and manual Load more.
Changing views or filters resets pages. **Search all tickets** matches title,
description, and ticket ID across every status, including tickets not yet loaded.
Project swimlanes can be collapsed, with preferences remembered on this device.
Search temporarily expands them; Clear restores the saved preferences.

While the visible board is recently active, a metadata check runs every 30 seconds
and shows **Updates available** for remote changes. It does not replace the board,
reset loaded pages, or overwrite an open draft. Use its Refresh button when ready;
an explicit refresh returns columns to the first page. Returning to a background
tab also checks for updates. Older completions without a recorded date sort
after dated tickets, with ID as a stable tie-breaker. Editing a completed ticket
does not make it newly completed. The browser requests bounded pages for every
status; the legacy agent backlog still includes all active tickets and retains
its completed-only search unless `searchScope=all` is explicitly requested.
See [board refinement verification](docs/board-improvements-verification.md).

The local application now includes durable file storage, a transactional Postgres
adapter, one server-side workspace password, protected APIs, CSRF checks, revocable
project-scoped agent credentials, claim renewal/release, and retry deduplication.
The private workspace starts empty. Example tickets exist only in explicit demo
mode and are not imported repository ledgers.

Worldrawn's 34 POI entries and one planning-reference entry have now been imported
into [the hosted board](https://project-plannr.netlify.app/?view=swimlanes), preserving
stable POI IDs, notes and evidence links. Select Worldrawn. Its existing Test ticket
was left untouched. This is the authoritative roadmap; technical evidence stays
in Worldrawn's repository. Imported statuses record the old ledger, not fresh QA.

**Hosted development workspace:** open [Project Plannr](https://project-plannr.netlify.app).
Use the same workspace password configured locally. Hosted password access,
private API denial, CSRF/origin protection, durable ticket writes, and sign-out
revocation passed September 30, 2026. The published app uses the isolated Neon
development branch, not the production database. The existing Netlify site is now
connected to this repository's `main` with a read-only deploy key and push-only
webhook. The merged sign-in and sorting changes are live. The publish guard handles
Netlify's generated cached configuration without allowing extra browser assets.
See [continuous deployment verification](docs/continuous-deployment-verification.md)
and [the rollout PR](https://github.com/kylbutlr/project-plannr/pull/5) for the
recorded setup checks and final automatic-deployment result. Production database access remains blocked at
this milestone. See [provisioning status](docs/provisioning-status.md) and
[verification evidence](docs/durable-verification.md) for the exact boundary.

## Start and stop

Node.js 20.12 or newer is required. Install the pinned dependencies first:

```sh
cd /Users/kylebutler/Documents/sites/project-plannr
npm ci
```

For the original disposable trial, without sign-in or database access:

```sh
npm run demo
```

Open [Project swimlanes](http://127.0.0.1:4205/?view=swimlanes),
[Kanban](http://127.0.0.1:4205/?view=kanban), or
[Ranked queue](http://127.0.0.1:4205/?view=queue).
Explicit view links override the remembered browser preference.

For the private durable workspace:

```sh
npm run dev
```

Without sign-in configuration, this displays a locked setup screen. Follow
[the credential setup guide](docs/local-setup.md) using the ignored `.env` file.
Without a database URL, private mode uses an owner-readable file under ignored
`data/`. Local storage is locked to one server process. Do not share that file or
remove its lock while a server is using it.

Press **Ctrl+C in that terminal** to stop only this server. If its port is already
occupied, choose another port without stopping other previews. Private mode's
origin must match the chosen port exactly.

## Checks

```sh
npm run check
```

The suite uses disposable loopback servers and temporary files. It does not touch
Neon, other previews, or real ledgers. Tests cover password access, session expiry,
CSRF, persistent throttling, scoped agents, rollback, and the Netlify adapter.
This is not proof of a live deployment. CI installs dependencies with `npm ci`.

For the hosting build:

```sh
npm run build
```

Only twelve whitelisted browser assets are published. Server secrets, local data and
backend source are excluded. See [Netlify setup](docs/netlify-setup.md).

After the **development** connection has been configured, these opt-in commands
apply the additive migration and run real database checks:

```sh
npm run db:migrate
npm run db:check
```

Both commands refuse a missing development target. Migration checks the exact
configured hostname, verifies TLS certificates, and runs transactionally. The
database check removes its own test project, ticket, retry record and temporary
harness session, preserving audit history. Cleanup runs after success or a
normal verification failure; cleanup failures fail the command. Do not run these against
production. Both commands passed against the isolated development branch on
September 30, 2026.

## Agents

For another game, app, or other project, use the shared
[onboarding and ledger-import guide](docs/project-onboarding.md). `npm run onboard`
previews a versioned manifest without credentials or network access. An explicit
apply uses owner sign-in, project-only backups, atomic creation, duplicate guards,
and read-back. Optional `--issue-agent` saves separate scoped access, and
`npm run roadmap -- --repo /absolute/project` uses the same client for any repo.
The matching backend was published on October 1, 2026. Authenticated hosted
import preview, all-ticket search, and bounded paging passed against the existing
development database. See [the publication evidence](docs/hosted-board-verification.md).
Live imports and credential issuance still require explicit approval.

Private agents receive individual, revocable credentials for assigned projects.
The owner password and database URLs are never agent credentials. Issuance
and revocation are owner-only API operations; a management interface is still a
follow-up. See [the API contract](docs/agent-api.md).

Worldrawn's approved local agent access is configured separately from the owner
environment. From [Worldrawn](https://github.com/kylbutlr/worldrawn),
`npm run roadmap` reads the hosted project; `npm run roadmap -- show PLNR-16`
reads the town ticket. See [Worldrawn's access guide](https://github.com/kylbutlr/worldrawn/blob/main/docs/project-plannr.md).
The credential is ignored, owner-readable and expires after 30 days. No live
ticket was claimed during setup; implementation still requires Kyle's approval.

With an agent credential already set in your terminal environment:

```sh
npm run agent -- list
npm run agent -- backlog PROJECT_ID
npm run agent -- show TICKET_ID
npm run agent -- claim PLNR-1 1
npm run agent -- renew PLNR-1 2
npm run agent -- note PLNR-1 3 "Progress note"
```

Set `PLANNR_AGENT_TOKEN` privately, never in command arguments, chat, or Git. Set
`PLANNR_AGENT_ORIGIN` for a different origin. Read the latest ticket revision before
every mutation. Example IDs above are illustrative, not pre-created tickets.
For the disposable demo, explicitly set `PLANNR_MODE=demo` when running the CLI.
Claiming a ticket does not authorize pushes, merges, deployments, or external writes.
The [one-ticket Worldrawn pilot](docs/agent-pilot.md) explains the approval and
evidence handoff. Its automated check uses private-mode in-memory fixtures, not
real credentials, game changes, or imported ledger status.

## Source and design

Source lives in the private [Project Plannr repository](https://github.com/kylbutlr/project-plannr).
The approved charcoal/mint interface and Geist font remain intact. The access
panel uses the same tokens rather than introducing another visual theme.
[App Stylr](https://github.com/kylbutlr/app-stylr/tree/b3ca31ea264d5dd233fd871ac167247f1c306985)
is pinned at the exact 1.2.0 snapshot in [app-stylr.json](app-stylr.json). Its
[license](vendor/app-stylr/LICENSE) is retained; adapters are unmodified.

The favicon uses the pinned Evening base and a three-column board glyph. Run
`npm run icons` to regenerate its 16px/32px PNGs or `npm run icons:check` to verify
them. SVG and PNG assets are self-contained, revisioned and explicitly published.

[Original prototype verification](docs/prototype-verification.md) and
[extraction verification](docs/extraction-verification.md) are historical evidence,
not certification of the current private app or a hosted deployment.
[PRODUCT.md](PRODUCT.md) records the approved direction, while
[the setup plan](docs/setup-plan.md) records remaining release gates.

## Ticket checklists

Open a ticket to add, edit, remove, check, or uncheck individual steps under
Checklist. Save changes persists the whole draft; Cancel discards it. Enter in
New checklist item adds the step without saving the ticket. Typing a new step
and choosing Save changes also includes it. Each ticket supports 100 items of
up to 300 characters, with stable IDs for agent coordination.

Cards show a completed/total count and progress bar in Project swimlanes,
Kanban, and Ranked queue. Checking every step never changes ticket status.
Existing tickets begin with an empty checklist; descriptions, imported source,
and historical notes are preserved without automatic conversion or inferred
completion. No database migration is required.

The [shared roadmap command](docs/project-onboarding.md) supports
`checklist-add`, `checklist-edit`, `checklist-check`, `checklist-uncheck`, and
`checklist-remove`. Agents still need project scope, a current claim, and the
latest ticket revision. See [the checklist API contract](docs/agent-api.md#ticket-checklists)
and [local verification evidence](docs/checklist-verification.md). The UI and
backend must be published together before using these commands on the hosted board.
