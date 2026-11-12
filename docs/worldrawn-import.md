# Worldrawn roadmap import

Verified September 30, 2026 against the isolated development database and hosted
[Project Plannr board](https://project-plannr.netlify.app/?view=swimlanes).

## Source and coverage

The authorized [source snapshot](https://github.com/kylbutlr/worldrawn/blob/3d2cd14956779403cc7f089e2dcdc110e2196e93/docs/poi-ledger.md)
contained 34 POI entries. The import added those 34 and one planning-reference
ticket containing the shared direction, Next list, family rules and conventions.
The existing Worldrawn project and Test ticket were preserved.

Idea and Needs polish mapped to Next, In progress stayed active, and Done mapped
to Completed. Those historical statuses are not new acceptance verdicts. No
completion dates or work reservations were invented. POI-017, POI-018 and POI-012
retain the first three priority positions. Other entries retain source order.

Stable POI IDs remain in ticket titles alongside normal generated PLNR IDs.
Descriptions preserve original notes and immutable evidence links. Long entries
continue in ticket notes within the editor limits. Private import metadata also
retains each complete raw source entry and SHA-256 hash. The source document hash
is `64d55096f5ae62029e6398e1a1d3123f560b7fca7eca122e5c197368c74595f6`.

## Safety and recovery

The administrative importer validates all IDs, statuses, project identity and
collisions before one atomic transaction. A repeat import does not overwrite
subsequent board edits. Regression checks cover collision/persistence rollback,
complete coverage, evidence links, description limits and replay preservation.

A fresh database connection checked all 35 records, descriptions, notes, status,
priority and raw source. The hosted board and the long town ticket were inspected
before removing the local ledger. Private before/after exports remain in ignored,
owner-readable `data/import-backups/`; they are not published or committed.
Git history retains the immutable source above. The import command was a one-time
operation against that source checkout, not an ongoing synchronization command.

## Source of truth

Use the hosted Worldrawn project for future planning. Technical evidence and
read-only renderer coverage remain in Worldrawn; do not recreate a local editable
backlog. The private URL does not grant API access to agents. No live credential
was issued during this migration; [scoped access](agent-api.md) is a separate step.
