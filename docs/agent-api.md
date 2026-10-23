# Agent API contract

The local HTTP server and optional hosted adapter share this API. All workspace
operations require verified identity. Explicit loopback passwordless mode grants
local owner access while preserving the configured origin and CSRF requirement.
Agent credentials remain separate, revocable, and scoped to assigned projects.

## Identity

Owner browsers use the HttpOnly session cookie from password sign-in. Every owner
mutation requires the exact configured Origin and `X-CSRF-Token` returned by
`GET /api/session`. These are not agent credentials.

`POST /auth/login` accepts optional boolean `remember`. `true` sets a 30-day
absolute server expiry and persistent cookie (`Max-Age=2592000`). Omitted or
`false` uses a browser-session cookie and eight-hour absolute server expiry.
Session checks never extend expiry. Cookies are HttpOnly, SameSite=Lax, host-only,
and Secure with the `__Host-` prefix on HTTPS. Sign-out deletes the stored session
and expires its cookie. Workspace password changes invalidate existing sessions.

Agents use `Authorization: Bearer <credential>` with a project-scoped `plnr_`
token issued by the owner. The server stores its SHA-256 hash, never plaintext.
Credentials expire after 30 days, can be revoked immediately, and cannot manage
projects or credentials. Request payload `actor` values do not grant identity.

## Routes

| Route | Method | Required input | Access |
| --- | --- | --- | --- |
| `/api/session` | GET | none | Public, returns access status; no private planning data |
| `/auth/login` | POST | `password`, optional boolean `remember` | Exact Origin, persistent login throttle |
| `/api/state` | GET | none | Owner: all projects. Agent: assigned projects and scoped activity only. |
| `/api/board` | GET | optional `project`, `q`, `view`, `paging` query parameters | Default/agent contract: all active tickets plus 20 completions. Browser `paging=lanes`: 5 per project/status in Swimlanes, 10 per combined status in Kanban; metadata in `lanes`, keyed by JSON `[project,status]`; owner or scoped agent |
| `/api/completed` | GET | optional `project`, `q`, `cursor` | Next 20 matching completed tickets; same filters must accompany the cursor |
| `/api/lane` | GET | `status`, `view` (`swimlanes` / `kanban`), optional `project`, `q`, `sort`, `cursor` | Next 5 or 10 tickets for that column; cursor bound to project/status/view/search/sort, with scope checked on every read |
| `/api/tickets/:id` | GET | none | Latest individual ticket; owner or assigned-project agent |
| `/api/projects` | POST | `name`, `kind` (`game`, `app`, `other`) | Owner only |
| `/api/projects/:id` | PATCH | `revision`, optional `name`, `kind`, `archived` | Owner only |
| `/api/imports/preview` | POST | version-1 `manifest` | Owner with Origin and CSRF; validates collisions and returns project-only backup, source mapping, and expected-state hash |
| `/api/imports/apply` | POST | identical `manifest`, `expectedState` from preview | Owner with Origin and CSRF; atomic project/ticket import, preserves unchanged source IDs and subsequent owner edits |
| `/api/tickets` | POST | `project`, `title`, optional `description`, `priorityLevel` | Owner or assigned-project agent |
| `/api/tickets/:id` | PATCH | `revision`, optional `title`, `description`, `status`, `priorityLevel`, legacy numeric `priority`, `comment`, `checklistChanges` | Owner, or agent with current claim |
| `/api/tickets/:id/claim` | POST | `revision` | Owner or assigned-project agent |
| `/api/tickets/:id/renew` | POST | `revision` | Identity holding an unexpired claim |
| `/api/tickets/:id/release` | POST | `revision` | Identity holding an unexpired claim |
| `/api/agents` | GET | none | Owner; returns metadata, never token hashes or secrets |
| `/api/agents` | POST | `name`, nonempty `projects` ID array | Owner; returns secret once |
| `/api/agents/:id/revoke` | POST | `{}` | Owner only |
| `/auth/logout` | POST | `{}` | Owner browser with Origin and CSRF |

## Concurrency and retries

`priorityLevel` is a string: `P0`, `P1`, `P2`, or `P3` (Critical, High, Normal,
Low). Default is P2. The existing numeric `priority` is retained as a legacy queue
rank so old agents, source hashes, imports, and owner ordering are preserved.
Do not infer urgency from that number or replace it with a P-string. Browser and
shared-agent backlog ordering uses level first, then numeric rank and stable ID.
Imports may optionally supply `priorityLevel`; omitted levels do not change old
source hashes. No existing real tickets are bulk rewritten by this feature.

Claims last five minutes. A competing current claim, stale revision, completed
ticket claim, or expired agent write returns `409`. Re-read before retrying with
the latest revision. Owners can override ticket status; agents cannot modify
another agent's active claim. Archived projects stay readable but not writable.

The owner editor has no claim button. Owner edits do not require a reservation;
agent claims/renewal/release remain API coordination tools. The browser serializes
updates per ticket, applies each returned revision, and discards older refreshes.
After a stale write it retries once only when the fields being changed, status,
and ownership are still unchanged. Genuine conflicts keep the draft and require
review. Server revision checks and audit are not bypassed.

Completed pagination uses completion time descending, then ID descending. Legacy
completed tickets without a timestamp sort last with a stable ID order. Search
matches ID, title, and description literally and case-insensitively. Cursors are
bound to project/search filters, but do not grant access; scope is checked on every
request. Postgres uses scoped SQL with a 21-row lookahead, not a full completed
snapshot. In-memory/file mode bounds responses after reading its local state.
Swimlanes return up to 20 completions per selected active project, with total and
nextCursor metadata keyed by project ID. Each cursor is bound to that project and
search. Fetch more through `/api/completed?project=<id>&q=<search>&cursor=<cursor>`.
Postgres uses one window-partitioned query capped at 21 rows per project, not one
history query per project. Counts and ranking still examine matching history;
this is bounded result loading, not a claim of constant-cost history queries.
The browser now opts into `paging=lanes` on `/api/board`: one window-partitioned
query returns at most 6 rows per project/status for Swimlanes, or 11 per combined
status for Kanban, including one lookahead. Metadata in `lanes` reports totals
and continuation cursors. `/api/lane` returns the next 5 or 10 tickets.
`sort=default` (also used when omitted) sorts active columns by P0 through P3,
then legacy rank and ID ascending; Completed sorts newest completion first.
`sort=priority` puts P0 first in every column, breaking Completed ties by newest
completion. `sort=recent` uses descending numeric ticket sequence for active work
(newest added, not most recently edited) and completion date for Completed.
Undated completions sort last, then stable ID descending. Column cursors include
the level and selected sort; old or differently sorted cursors require a refresh.
The separate `/api/completed` history contract remains chronological. Search
affects every status when `searchScope=all`, as requested by the browser, and
only Completed otherwise. The browser preserves each column's
scroll position, automatically loads near the bottom, and stops automatic retries
on errors until the owner chooses Retry. Existing agents omit `paging=lanes` and
continue receiving every active ticket in their backlog.

The legacy `/api/state` and write transaction still load the complete ticket set;
this change is not a claim that every database operation is paginated.

Send an `Idempotency-Key` of at most 100 letters, digits, underscores, or hyphens
for a state-changing API retry. The key is scoped to authenticated identity.
An identical request replays its original response for 24 hours without adding
another note or activity entry. Reusing it with different input returns `409`.
Credential issuance is an exception: a repeated key returns `409` because the
secret is shown only once, not stored for replay. Revoke a lost credential before
issuing another. Revocation and expiry are checked even for replayed requests.

Postgres validates and mutates under one workspace row lock using the same
checked-out client. Data and activity commit or roll back together. This simple
serialized model is intentional for one private workspace; it is not a claim of
multi-tenant or high-volume scalability. API snapshots show the latest 100 global
activity records, filtered to the caller's scope. Older audit rows remain in the
database; per-project activity-history pagination is not implemented yet.

Requests are JSON objects limited to 12 KB, except exact-ticket PATCH requests
(up to 256 KiB, with checklist batches bounded as below) and owner-only import
preview/apply requests, which allow at most 512 KiB after authentication, owner, Origin, and
CSRF checks. Import routes never grant credentials implicitly. An import status
is the source's recorded planning state, not new QA or a fresh completion date.
The [shared onboarding guide](project-onboarding.md) documents manifests,
backups, exact source checks, duplicate handling, and optional separate grants.
These routes must be deployed before use on a previously published backend.
Unauthorized access returns `401`,
owner-only operations return `403`, unassigned projects/tickets return `404`, and
internal storage failures return a generic `503` without connection strings.

## Coordination boundary

Use the visual board to choose priorities and coordinate work. A claim is not an
agent launcher or permission to push, merge, deploy, publish, or change another
service. Those actions still require Kyle's explicit authorization.
See [the one-ticket pilot](agent-pilot.md) for read-only backlog selection and a
human-approved implementation/evidence handoff.

## Ticket checklists

A ticket can carry `checklist: [{id, text, completed}]`. Missing checklists on
older tickets mean an empty list; original description, notes and import metadata
are never converted automatically. Stable item IDs survive text edits.

PATCH the exact ticket with its latest `revision` and a nonempty
`checklistChanges` array. Each change is one of:

- `{action: "add", text: "Review venue", completed: false}`. Optional `id`
  permits a browser-generated stable ID; otherwise the server assigns one.
- `{action: "update", id: "item-id", text: "Updated step"}`. Supply `text`,
  `completed` (a boolean), or both.
- `{action: "remove", id: "item-id"}`.

Each item has 1 to 300 trimmed characters; IDs are 1 to 64 letters, numbers,
underscores or hyphens. At most 100 items may exist and 200 changes may appear
in a batch, allowing complete replacement by removing then adding. Unknown
fields, duplicate IDs, missing targets and invalid completion values reject the
entire transaction, including any other ticket changes and audit writes.

Checklist mutations use the existing owner Origin/CSRF rules or scoped agent
claim, revision, idempotency and transactional audit rules. Completing a list
does not change status, completion time, ownership or claims. Board and ticket
reads include the stored list; revision changes trigger Updates available.

The owner editor sends only changed items. After a stale revision, a patch with
checklist changes retries once only if the checklist, status, ownership and any
other edited fields remain unchanged. A competing checklist edit leaves that
local draft intact with an explicit reload/discard choice. These API extensions
require publication before hosted use.
