# Project Plannr

A self-hosted planning workspace for one owner and their project-scoped agents,
covering applications, games, and other projects. The public source supports
local persistent storage, optional loopback passwords, and explicitly configured
private hosted access. Projects and credentials remain private to each installation.

## Approved direction

- Name: Project Plannr. Directory and intended repository: project-plannr.
- One owner-managed private workspace first; no public signup.
- Project swimlanes by default, plus Kanban and Ranked queue.
- Projects can be added, renamed, classified, archived, and restored.
- Project sorting defaults to Recent, with Alphabetical always available.
  Optional installation-wide types are disabled by default, with configurable
  stable IDs, labels and ordering. When enabled, filter by configured types or
  Unassigned and sort by Type, alphabetically within each group. Preserve saved
  type values when configuration changes. Remember filter/sort in this browser,
  independently from ticket sorting. Claim renewals do not advance recency.
- Next, In progress, and Completed remain the default Simple workflow. The owner can add, rename, reorder, remove, or disable workspace-wide columns, categorized as Waiting, Ready, Active, or Done. New columns start in Waiting. Disabled columns preserve their tickets and are excluded from agent pickup; Show disabled columns exposes them without re-enabling automation. Keep one enabled Ready, Active, and Done column. Populated removals require explicit destinations and active claims must be released before semantic column changes.
- Clicking a ticket opens a focused editor for title, description, status,
  priority, and notes. Agent reservations stay out of the everyday owner UI.
- Priority is P0 (Critical), P1 (High), P2 (Normal), or P3 (Low), color-coded without
  relying on color alone. Existing numeric queue ranks remain tie-breakers, not
  inferred urgency. Existing tickets without a level default to P2.
- All Swimlane status columns use independent 5-ticket pages per project,
  loading 5 more automatically near the scroll end. Kanban uses combined
  10-ticket pages per status, loading 10 more. Columns have bounded height and
  preserve scroll position. Retry and manual loading remain accessible.
- Ranked queue retains its manual 20-ticket Completed history pages.
  All-ticket search covers every status, including unloaded work, in every view.
  Swimlane and Kanban Default sort prioritizes active work and keeps Completed
  newest first. Explicit Priority sorts all columns by P0 through P3; Recent
  sorts active tickets newest added first and Completed newest completed first.
  Remember the choice on this browser and reset pages when it changes.
  Ranked queue's separate Completed history stays newest first.
- Project swimlanes can collapse, with device-local preferences. Search temporarily
  expands projects without changing those preferences.
- Remote changes display an Updates available notice instead of automatically
  replacing the board. Open drafts and expanded pages stay intact until an
  explicit refresh, which resets columns to their first page.
- Preserve the App Stylr charcoal/mint identity, with the user-approved public
  interface refresh: clearer navigation, form flow, comfortable spacing, readable
  displays, and consistent native dropdown controls. Browser-local workspace and
  display names, optional light mode, density, and default view are customizable.
- Remember me is opt-in for 30 days from sign-in on that browser. Otherwise use
  a session cookie with an eight-hour absolute server limit. Restore valid sessions
  on startup; Sign out revokes access immediately without retaining a password.
- Technical implementation notes and evidence remain in project repositories.

## Current boundary

The standalone app has private-mode file/Postgres storage, server-verified owner
sessions, scoped agent credentials, and transactional claims and activity.
Owner access uses one server-side password, not GitHub login or public signup.
Local file storage and explicitly configured hosted PostgreSQL use the same
protected API. Demo mode uses disposable fictional records. Installation-specific
provisioning, import receipts, credentials and live project state do not belong
in the public source. This repository does not configure or describe a shared
maintainer-hosted workspace.

## First durable milestone

Persist planning data and audit history; authenticate the owner server-side; protect
every private API; support project-scoped, revocable agent access; retain stale
write rejection and safe work claims. Move real ledgers only after these gates
are verified. Prefer a small useful system over a Jira feature inventory.

## Ticket checklist behavior

Tickets have individually editable and checkable steps. The owner stages these
with the rest of the ticket draft and commits them through Save changes. Board
cards show completed/total progress in every approved view. Checklist completion
and ticket status remain independent, so owner review can remain pending when
all steps are checked. Existing descriptions and notes are historical content,
not automatically converted completion evidence. Scoped agents can update
individual items through the shared roadmap command under the existing claim,
revision and audit rules.

## Ticket hierarchy

One top-level ticket represents an overall effort and can contain sub-task
tickets in the same project. Each child has at most one parent, with one level
of nesting. Create or attach children in the parent editor; detach there or
change the Parent field on the child. Linked navigation includes unloaded
tickets. Counts include all children and completed history in every board view.
Each ticket retains independent status, checklist, priority and notes. Parent
completion remains an explicit owner decision. A top-level ticket may carry a
manually maintained HTTPS external reference, without automatic synchronization.
Scoped API and agent commands share these rules and the existing concurrency,
claim and audit requirements. Existing tickets are not bulk rewritten.
