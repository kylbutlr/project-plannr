# Project organization

## Defaults

Project types are disabled unless explicitly configured. Project kind remains
App, Game or Other. The board offers Recent (default) and Alphabetical ordering,
without type selectors in the header or project forms.

Recent uses meaningful project/ticket activity, including retained legacy audit
history. Claim renewals do not affect it. Missing dates sort last; equal dates
use alphabetical order. Project ordering does not change ticket priority or
sorting, hierarchy, checklists, claims, permissions or loaded ticket pages.

## Optional installation-wide types

Set this server environment value, then restart the application or redeploy:

```dotenv
PLANNR_PROJECT_TYPES=[{"id":"client","label":"Client work"},{"id":"internal","label":"Internal"}]
```

An omitted value, blank value or `[]` disables types. The value is a JSON array
of up to 100 objects with unique stable IDs and labels. IDs use a lowercase
letter followed by lowercase letters, digits or hyphens, up to 40 characters.
`all` and `unassigned` are reserved. Labels contain 1 to 60 characters.
Invalid configuration fails startup rather than silently changing assignments.
Do not put secrets in labels: authenticated clients receive this configuration.

When enabled, Manage projects offers these types plus Unassigned. The header
filters every board view and subsequent ticket page. Type sorting follows array
order, alphabetically within each group, with unassigned or retired types last.
Alphabetical always interleaves matching names regardless of type or kind.
These filter/sort choices are remembered in this browser.

## Changing configuration safely

- Rename labels or reorder the array while retaining IDs. Stored assignments
  use IDs, so these changes need no project or ticket rewrite.
- New and legacy projects without an explicit assignment remain Unassigned.
- Removing a type preserves its stored ID. It appears in the Unassigned filter
  until restored to configuration or explicitly reassigned. Its project form
  shows an unavailable, retained selection so saving another field is safe.
- Disabling types hides their controls and ignores old browser filters. It does
  not erase assignments. Re-enabling the same IDs restores their labels.
- Only the owner can assign a configured type or explicitly clear an assignment
  to `null`. Unrelated project edits and archive/restore preserve stored values.
- No migration or bulk update runs. Existing project and ticket IDs stay intact.

## Verification

Use disposable data to check types off, two or more custom types, renamed and
retired IDs, Unassigned, archive/restore, stale writes and scoped access.
Exercise filtering/search/pagination in Swimlanes, Kanban and Ranked queue;
cursors must be rejected after changing filters. Verify Recent/Alphabetical/Type
ordering, browser persistence, dirty project drafts and responsive controls.
Automated coverage lives in `test/project-organization.test.mjs`.
