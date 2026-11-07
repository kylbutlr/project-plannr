# Workflow columns

Columns are named steps shared across every project in the workspace. The owner
opens **Columns** to add, rename, reorder, enable, or disable them. Changes are
saved together and checked against the latest workflow revision.

| Category | Purpose | Agent behavior |
| --- | --- | --- |
| Waiting | Needs discussion, a decision, or a dependency | Excluded from pickup and claims |
| Ready | Actionable work, such as Next or Ready for review | Eligible for the scoped agent backlog |
| Active | Work underway, such as Building or Reviewing | Existing work can hold or renew a claim |
| Done | Finished work | Completion timestamp/history; excluded from claims |

Column names do not determine behavior. A new custom column starts in Waiting.
Ready makes a ticket eligible; it does not launch an agent or grant credentials.
The ticket still describes the work, and project-scoped access still applies.
An agent claim moves Ready work to an explicitly requested enabled Active `columnId`, or the first enabled Active column when omitted. The CLI accepts `claim TICKET_ID REVISION [ACTIVE_COLUMN_ID]`. A claim on
an unclaimed/expired Active ticket stays in its current column. Releasing a claim
returns work to its original Ready column when available, otherwise the default
enabled Ready column. The backlog lists only enabled Ready work.

## Keeping the board simple

**Simple workflow** restores Next, In progress, and Completed and turns off extra
columns. It does not remove custom columns or move/delete their tickets. Choose
**Show disabled columns** on the board to inspect that work, move it to an enabled
column, or open Columns and enable the stage again. Disabled columns are excluded
from agent pickup and new claims. The setting is shared workspace behavior, not
just a browser-specific visual preference.

At least one Ready, Active, and Done column must remain enabled. The three default
column IDs retain their original categories for compatibility, but their names
and order are editable. To replace a default step, add a custom column with the
same category and then turn off or remove the original. A workspace supports up
to 24 columns to keep configuration and per-column paging bounded.

## Safe edits

- Removing a populated column requires choosing an enabled destination for all
  of its tickets, including tickets belonging to archived projects.
- Moving between categories updates the ticket's underlying state and completion
  timestamp. Moving between two Done columns retains its completion time.
- Release active claims before disabling, removing, or changing the category of
  their column. Renaming and reordering do not interrupt claims.
- Category changes do not issue new work claims. They advance affected ticket
  revisions and are audited in the same transaction as the workflow edit.
- If another owner session edits Columns first, Save reports a conflict and keeps
  the draft. Use Reload columns only when ready to replace the draft.

## API and compatibility

`GET /api/workflow` is owner-only and returns `{revision, columns, counts}`.
Each column is `{id, name, category, enabled}`. `PATCH /api/workflow` is owner-only,
requires the current `revision` and complete `columns` array, and accepts optional
`moves: {removedColumnId: destinationColumnId}`. Origin/CSRF checks apply.

Board and scoped state responses include `workflow` metadata. Ticket `columnId`
identifies the step; older tickets without it inherit their legacy status column.
The stable `status` remains `next`, `in-progress`, or `completed` for Ready, Active,
and Done; Waiting uses `waiting`. Create/move tickets with `columnId`. Legacy
`status` mutations choose an enabled column in that category. Do not send both.
The version 1 import contract retains its explicit three-state mapping and routes each imported state to an enabled column in that category. Preview/apply conflict checks include the workflow revision, so replacing a default column cannot create invisible imported work.

Column pagination uses the column ID in its existing `status` query parameter,
lane key, and cursor binding. Custom Done columns share chronological completed
history while retaining independent column paging. Existing data and identifiers
are preserved when loading a workspace that has no workflow configuration yet.

## Hosted upgrade

Local file workspaces need no database migration. Hosted Postgres installations
require migration 002 before running this application version. The documented
`npm run db:migrate` command applies both schema files transactionally. Back up
the database and verify the configured development target before applying it.
No remote database migration, deployment, or public release is implied by a local
build or test. Existing deployments must not receive this code before migration.
