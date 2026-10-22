# Standalone extraction verification, September 30, 2026

## Scope

Project Plannr 0.1.0 local scaffold at http://127.0.0.1:4205/, extracted from
Worldrawn prototype commit 8dd764e. No new hosted app, authenticated session,
database, agent credential, remote repository, or real ledger import was created.

## Checks

- Node.js v20.20.2. `npm run check` passed syntax checks and isolated HTTP/API
  regressions: root page, all four CSS/JS/font assets, project creation/editing,
  stable ticket links, archive/restore, stale writes, invalid changes, competing
  claims, and mutation-origin guard. Its own disposable server used port 4207
  and was stopped by the test script.
- Initial sandbox restrictions prevented localhost binding. The same checks
  passed with authorized local-server access; this was not a code regression.
- The browser displayed Project Plannr and selected Project swimlanes by default.
  Kanban and Ranked queue each retained all six illustrative tickets and updated
  the URL to their named view. Returning to swimlanes preserved the same data.
- Manage projects opened with Game, App, and Other choices and rename/archive
  controls. Desktop and 390 x 844 captures were inspected. Narrow-width document
  overflow was false. Temporary browser viewport override was reset afterward.
- Existing App Stylr reference URLs both redirected to its current reference
  homepage. The inherited exact pinned adapter and fonts were preserved rather
  than treating that redirect as evidence of a separate rendered style guide.
- Worldrawn source and its original prototype were not modified.

## Evidence

- [Board](screenshots/board.png)
- [Desktop project management](screenshots/desktop.png)
- [Narrow project management](screenshots/mobile.png)

These are extraction checks, not hosted-security, comprehensive accessibility,
long-session, or full feature certification. Demo state still resets on restart.

## Separate Worldrawn production smoke

GitHub confirmed PR 17 merged. Later revert and revert-of-revert commits appeared
on main; the restored main d21ae542 and original merge 0b703e8c have identical
source tree 5a8aa038c935f9fb48df73df7092573cfa4ab530. No branch mutation was performed.

https://worldrawn.netlify.app/ opened the game. Its menu reported generator
underworld-4, save envelope 2, and created/playing version 0.5.0-preview.1 for the
disposable smoke world. The save status reported successful browser saving and
no game console errors were captured. This confirms production startup/version,
not a full gameplay or performance pass. Netlify completion was reported by Kyle;
the latest restored commit's full CI was not certified in this check.
