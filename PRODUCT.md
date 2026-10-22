# Project Plannr

Kyle's private visual planning workspace for multiple games, applications, and
other projects. Independent project agents should read the same priorities and
work ownership as Kyle, without maintaining separate editable ledgers.

## Approved direction

- Name: Project Plannr. Directory and intended repository: project-plannr.
- One owner-managed private workspace first; no public signup.
- Project swimlanes by default, plus Kanban and Ranked queue.
- Projects can be added, renamed, classified, archived, and restored.
- Next, In progress, and Completed remain the simple workflow.
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
- Preserve the approved App Stylr dark interface, not a redesign.
- Remember me is opt-in for 30 days from sign-in on that browser. Otherwise use
  a session cookie with an eight-hour absolute server limit. Restore valid sessions
  on startup; Sign out revokes access immediately without retaining a password.
- Technical implementation notes and evidence remain in project repositories.

## Current boundary

The standalone app has private-mode file/Postgres storage, server-verified owner
sessions, scoped agent credentials, and transactional claims and activity.
Owner access uses one server-side password, not GitHub login or public signup.
Local password and Netlify adapter checks pass, including denial paths. The Neon
development migration and live storage checks passed September 30, 2026. The private
repository and isolated Neon branches exist. The password-protected Netlify app
is published using the development database. Worldrawn's 34 POI entries and one
planning reference were imported with full source preservation and read-back
verification. One approved 30-day Worldrawn-scoped local agent credential is
configured. No production database enablement has been made. Explicit demo mode keeps
the original illustrative tickets separate from private data.
See docs/provisioning-status.md for the infrastructure boundary.

## First durable milestone

Persist planning data and audit history; authenticate Kyle server-side; protect
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
