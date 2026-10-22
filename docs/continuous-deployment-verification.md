# Continuous deployment setup and cached-build correction

Verified October 1, 2026 (October 2 UTC).

## Current hosted state

- Existing [Project Plannr site](https://project-plannr.netlify.app/?view=swimlanes),
  ID `eb96a39a-3f26-483b-98a5-a88b15b71139`.
- Connected private repository: [kylbutlr/project-plannr](https://github.com/kylbutlr/project-plannr).
- Production and sole allowed branch: `main`; command `npm run build`, publish
  directory `dist`, functions directory `netlify/functions`.
- Repository deploy key `165117033` is read-only. Webhook `690766531` is active
  and subscribes only to push events. No account-wide GitHub OAuth grant was added.
- All six existing environment variables retain their original modification
  timestamps. No password, database target, migration or ticket changes were made.
- [Clean Git-based build](https://app.netlify.com/projects/project-plannr/deploys/6abf0a05f6037ed41b4eb330)
  published merged `main` commit `e1d72dddea3339dbe1c0d380ec94543cd1bd47f9`.
- Hosted owner verification passed: Secure HttpOnly remembered cookie with
  `Max-Age=2592000`, fresh session restore, all three sorts in both board views,
  initial page bounds, cursor order, totals, and duplicate-free paging. Twenty-four
  additional page requests checked 216 cards across six view/sort combinations.
  Published browser assets matched source. Projects and tickets were unchanged;
  the dedicated verification session was revoked and its cookie then returned 401.

## Cached-build failure and local fix

The first build and a later normal cached build failed at the strict asset
whitelist. A clean-cache build succeeded. The successful deployment's file list
includes Netlify's generated `netlify.toml`, in addition to our eleven browser
assets. No `dist` files are tracked in the repository. Restoring that generated
configuration in `dist` reproduces the same whitelist failure locally.

The focused fix removes only `dist/netlify.toml` when `NETLIFY=true`, after checking
that there are no other unexpected files. It does not whitelist configuration for
publication, remove arbitrary leftovers or change the browser asset list.
Local builds still reject that filename; hosted builds still reject unknown files.

The regression failed on the original script before the fix. Tests also cover a
repeated hosted build and preservation of unexpected files. This source correction
was prepared locally. The complete 92-test suite, isolated HTTP acceptance check, focused
cache regression and eleven-asset build passed. No UI behavior changed, so no new
browser-layout certification is claimed. Kyle subsequently approved publishing and
merging [PR #5](https://github.com/kylbutlr/project-plannr/pull/5), then deleting its
branch. The PR records the final hosted rollout result separately from these
pre-merge checks.

## Hosted rollout gate

After the correction is merged, verify an actual GitHub push webhook delivery
triggers a ready deployment of the exact new `main` commit. Then verify one more
normal cached build succeeds. Configuration and a manually triggered Git build
are not proof of that end-to-end automatic delivery.
