# project-plannr v1.3.0 candidate verification

Prepared November 7, 2026. Local release candidate only; no push, merge, tag, public release or deployment was performed for this preparation.

## Verified checks

The candidate includes configurable workflow columns, Simple workflow, onboarding/readiness fixes, and the preserved pinned styling archive. All 123 tests, build, packaging, and the full dependency audit passed. A clean extracted runtime install reported zero vulnerabilities. Fresh packaged-server checks covered an empty file workspace, CSRF, a custom Waiting column, scoped/revocable agent access, rejected waiting claims and stale writes, persisted restart, and password-protected access. README relative targets are present.

## Limits and publication

The HTTP checks used disposable file storage, not personal projects or a fresh hosted PostgreSQL deployment. Existing rendered and hosted acceptance is documented separately. No migration or hosted data change was performed in this release-preparation pass.

No prior public asset is replaced by a locally rebuilt file. Publish a new immutable version only after reviewing the exact candidate, checksums, remaining acceptance and explicit authorization. Screenshots and previews retain their original capture-version provenance.
