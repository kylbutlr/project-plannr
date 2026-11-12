# Hosted development verification

Verified September 30, 2026. Open
[Project Plannr](https://project-plannr.netlify.app/?view=swimlanes).

## Published identity

- Personal Netlify team: `kylbutlr`.
- Site: `project-plannr`, ID `eb96a39a-3f26-483b-98a5-a88b15b71139`.
- [Configured deployment](https://app.netlify.com/projects/project-plannr/deploys/6abdc19bf379c4f2d9badca6).
- [Application source commit](https://github.com/kylbutlr/project-plannr/commit/63cbd5ac14afbd7690f4c9593b1ce45e8ae0cd0a).
- [Passing GitHub CI](https://github.com/kylbutlr/project-plannr/actions/runs/36804070960).
- Storage: isolated Neon development branch `br-tiny-math-ar2pbuta`.
- Manual CLI publication, not a main merge or Git-triggered deploy.

The first static/function publication occurred before the environment request
was accepted. Its function failed closed. Six runtime values were then verified
and the configured deployment above was published. Password and database URL
were transferred directly from the ignored local environment without logging
them, embedding them in assets, or passing them as command-line arguments.
Values apply only to the published-site deployment context. Preview origins
remain rejected by the exact-origin guard.

## Acceptance evidence

| Requirement | Actual hosted check |
| --- | --- |
| Signed-out private data and writes blocked | State GET and project POST returned 401 |
| Password verified server-side | Wrong password returned 401; configured password returned 200 |
| Secure sessions | Hosted response set Secure, HttpOnly, SameSite=Lax cookie; browser reload retained sign-in |
| Browser write protection | Invalid CSRF token and wrong Origin each returned 403 without creating a project |
| Durable project and ticket writes | Uniquely named verification project and ticket created through HTTPS; note read through a fresh TLS-verified Postgres connection pool |
| Three views | Swimlanes, Kanban, and Ranked queue APIs included the saved fixture; all three rendered in browser with the existing owner's ticket |
| Private files excluded | `.env`, data file, backend module, and server source returned 404; published board script contained neither configured secret |
| Sign out revokes access | Logout followed by reuse of its cookie returned 401; browser sign-out removed private content |
| Preserve existing work | Existing Worldrawn project and `PLNR-3` test ticket remained present; editor opened and was cancelled without saving |
| Responsive shell and board | Hosted desktop and 390 by 844 mobile inspected; mobile document width matched viewport at 390 px |

The disposable hosted fixture was removed through exact identity/revision checks.
Its project, ticket, and session were deleted, not archived. Audit history and the
monotonic ticket counter were retained. No real roadmap tickets were imported,
and no agent credential was issued.

## Screenshots

- [Hosted desktop board](screenshots/hosted-board-desktop.png).
- [Hosted mobile board](screenshots/hosted-board-mobile.png).
- [Hosted mobile sign-out screen](screenshots/hosted-login-mobile.png).

## Local and CI gates

The current application passed 45 Node tests, the separate disposable demo
integration check, the seven-asset build, staged-secret comparison, and Git
whitespace checks. CI passed on Node 22 for the deployed source commit.
The first sandbox-only run could not bind loopback test servers; the authorized
run passed without changing test expectations.

## Explicit limits

- No production database enablement or migration.
- No real agent pilot, credential issuance, or ledger migration.
- Hosted throttling budgets, eight-hour time expiry, password rotation, and
  agent scope/revocation have automated local adapter coverage, not separate
  live hosted end-to-end checks in this run.
- Populated-history pagination has local HTTP, SQL, and desktop/mobile browser
  fixture coverage. The owner's hosted Completed lane is empty, so no live
  populated-history paging claim is made.
- Physical mobile devices and other browser engines were not tested.
- Git-triggered deployment still needs a reviewed release branch and repository
  linkage. Future pushes alone do not update the hosted app.
