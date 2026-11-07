# project-plannr v1.3.0 candidate verification

Prepared November 7, 2026. Local release candidate only; no push, merge, tag, public release or deployment was performed for this preparation.

## Verified checks

The candidate includes configurable workflow columns, Simple workflow, onboarding/readiness fixes, and the preserved pinned styling archive. All 123 tests, build, packaging, and the full dependency audit passed. A clean extracted runtime install reported zero vulnerabilities. Fresh packaged-server checks covered an empty file workspace, CSRF, a custom Waiting column, scoped/revocable agent access, rejected waiting claims and stale writes, persisted restart, and password-protected access. README relative targets are present.

## Limits and publication

The HTTP checks used disposable file storage, not personal projects or a fresh hosted PostgreSQL deployment. Existing rendered and hosted acceptance is documented separately. No migration or hosted data change was performed in this release-preparation pass.

No prior public asset is replaced by a locally rebuilt file. Publish a new immutable version only after reviewing the exact candidate, checksums, remaining acceptance and explicit authorization. Screenshots and previews retain their original capture-version provenance.

## Node 22 clean-install compatibility

Hosted npm 10 rejected the symlinked local App Stylr dependency while validating the patched sharp override. The same clean-install error was reproduced in a disposable fixture. Project-local install-links configuration and a regenerated lockfile install that same vendored source as a package, retaining sharp 0.35.5 and leaving all vendored files unchanged. Both Node 22/npm 10 and Node 24 dry-run clean installs pass. The full Node 22 install, all 123 tests, build and packaging passed, followed by a fresh extracted archive installation using npm ci --omit=dev and disposable runtime checks. The configuration is included in the downloadable archive. The unchanged hosted npm ci gate must pass before merge.
