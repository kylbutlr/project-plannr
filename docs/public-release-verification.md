# Public release verification, 2026-10-22

## Verification and limits

The actual extracted download passed all 103 tests and its build with a clean dependency install. Checks covered password and passwordless access, CSRF/origin enforcement, file persistence, stale writes, claims, and passwordless onboarding with separately scoped agent access. File manifest and SHA-256 are attached. Source review findings were fixed and re-reviewed.

Fresh browser visual acceptance remains pending because Browser Use rejected authority over a stale error page. No existing hosted workspace, real project ledger, or credentials were changed during validation. This is a single-owner installation, not a multi-tenant hosted service. Updates are manual.

Publication preparation retains the existing repository and history at Kyle's explicit request. A pattern scan of all blobs reachable from the release candidate and origin/main found no credential matches after checking one blank-setting false positive. This is pattern-based evidence, not a guarantee that arbitrary historic content is non-sensitive. Historical screenshots and rollout notes remain in the repository by request.

No agent-owned preview server remains running.
