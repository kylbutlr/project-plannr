# Automatic column loading

Verified October 1, 2026 against disposable memory fixtures. No hosted board,
real tickets, owner credentials, or Neon database were accessed or changed.

## Request coverage

| Requirement | Implementation | Verification |
| --- | --- | --- |
| Swimlanes start at 5, then add 5 per column | `paging=lanes`, project/status cursors and `/api/lane` | All six columns initially held 5. Next, In progress and Completed each reached 10 independently. |
| Kanban starts at 10, then adds 10 | Combined status pages across selected projects | All three started at 10. Scrolling Next added exactly 10, leaving the others at 10. |
| Bound column height, independent overflow | Swimlanes 480 px, Kanban 660 px; mobile 400 / 560 px | Measured DOM heights, overflow and independent scroll positions on desktop and narrow screens. No mobile document-width overflow. |
| Automatic loading | Local scroll-end observer and scroll listener, duplicate-request gate | Keyboard End triggered loading without clicking Load more, including mobile Kanban. |
| Recovery and accessible controls | Status/loading text, focusable regions, Load more / Retry, focus restoration | Injected one 503. Further scrolling did not retry; explicit Retry loaded the next 5 and cleared the error. Keyboard region focus survived automatic append. |
| Correct completion and reset | Deduplication, end cursor, view/filter invalidation | Final column reached 17 of 17 unique tickets with no more button. Project filter and Refresh reset pages and scroll positions. Status change refreshed counts and re-enabled controls. |

Before editing, the browser and API inspection confirmed that only Completed
was paginated, at 20 per project. The same requirements were checked again
after implementation using the table above.

## Automated checks

- `npm run check`: 72 tests passed, plus the isolated HTTP integration checks.
- `npm run build`: 10 whitelisted public assets; backend and environment files excluded.
- `git diff --check`: passed.
- New coverage includes every-status paging, priority/time ties, null completion
  dates, cursor/filter validation, sign-in/agent scope, independent page gates,
  bounded SQL contracts and unchanged legacy agent backlogs.
- Browser console error check returned no errors.
- The UI detector reported only the existing Geist font warning. Retaining the
  approved App Stylr font is documented in `app-stylr-exceptions.md`.

The SQL adapter was tested through query-contract fixtures, not against live
Postgres. Its window counts/ranking still examine matching tickets; bounded
responses do not imply constant-cost database queries. File mode still reads
local state. Ranked queue and existing agent reads retain their earlier contracts.

## Evidence

- [Desktop columns](screenshots/infinite-columns-desktop.jpg)
- [Mobile Kanban](screenshots/infinite-columns-mobile.jpg)

Fixtures contain example tickets only, including intentionally long IDs to
exercise wrapping. Fixture servers have bounded lifespans and do not load `.env`.
Publication and a hosted-database smoke check remain separate gates.
