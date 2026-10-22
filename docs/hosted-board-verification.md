# Hosted onboarding and board publication

Verified October 1, 2026 against the existing private hosted workspace and its
isolated development database. No new project, ticket, import, or agent credential
was created by this verification.

## Published identity

- [Project Plannr](https://project-plannr.netlify.app/?view=swimlanes).
- [Deployment 6abe7fec3e5406960d712407](https://app.netlify.com/projects/project-plannr/deploys/6abe7fec3e5406960d712407).
- Application source: [929d4eff1528a1be26a23781d3ae1feb8d668383](https://github.com/kylbutlr/project-plannr/commit/929d4eff1528a1be26a23781d3ae1feb8d668383).
- [Unmerged feature PR #3](https://github.com/kylbutlr/project-plannr/pull/3).
- Netlify site ID: `eb96a39a-3f26-483b-98a5-a88b15b71139`.
- Manual publication with the existing runtime settings, no database migration,
  protected-branch write, or Git-triggered deployment change.

The later documentation-only commit records this release; it is not a different
application build.

## Hosted API evidence

- Published HTML, board JavaScript, and CSS matched the local build byte for byte.
- Anonymous board, change-token, and import-preview requests returned 401.
- Existing private owner sign-in succeeded without logging the password or cookie.
- Swimlane pages were bounded to five cards per project/status, and Kanban pages
  to ten combined cards per status. Totals matched the existing full snapshot.
- Eight cursor-page reads returned 42 cards across the two views, without duplicate
  IDs or missing cards. This verifies actual hosted Postgres query execution.
- Search found an unloaded ticket by ID in Swimlanes, Kanban, and Ranked queue.
- The change endpoint returned only `changeToken`, not ticket contents.
- Owner import preview against an existing project and an empty manifest returned
  no proposed project or ticket creation. Apply was not invoked.
- Project and ticket snapshots were unchanged before and after the checks.
- The dedicated API verification session was signed out, and its reused cookie
  then returned 401.

## Local and CI gates

All 79 tests, the isolated HTTP acceptance check, and the ten-public-asset build
passed again before publication. [GitHub CI](https://github.com/kylbutlr/project-plannr/actions/runs/36886638995)
passed for the published application source.

## Hosted browser evidence

The private board rendered five initial Next cards and five initial In progress
cards, with full matching totals. Collapse hid the project; searching `PLNR-11`,
which was beyond the initial five Next cards, expanded it and rendered the correct
single result. Clear restored the saved collapsed preference. The initial expanded
preference was restored afterward. An accidentally opened ticket editor was
cancelled without saving.
Kanban rendered ten initial Next cards and the full six In progress cards.

- [Hosted unloaded-ticket search](screenshots/hosted-board-refinements.jpg).

The browser's column-focus click opened a ticket editor rather than focusing the
column, so the keyboard scroll failed. A subsequent native scroll attempt did not advance its page. No
hosted automatic-scroll pass is claimed from those actions. Automatic scrolling
retains the passing local fixture coverage; the actual hosted paging endpoint
was exercised independently as described above.

## Explicit limits

Import apply, credential issuance, and remote-edit notifications retain isolated
automated/local browser coverage. This release did not exercise them by changing
real hosted tickets or issuing a new credential. Responsive evidence is local,
not a physical mobile-device or cross-browser certification.
