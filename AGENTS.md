# Project Plannr agent instructions

Read README.md and PRODUCT.md before implementation. This is a hosted private
development application using an isolated database branch. Preserve the approved views and
project management. Do not turn illustrative Worldrawn or Track Forgr tickets
into claims about actual project state.

## Safety and release

- Follow [ticket-writing and completion](docs/ticket-writing.md) for every new or
  edited Project Plannr ticket. Require bounded scope, explicit acceptance
  checklists, exclusions and proportionate verification before implementation.
  Preserve imported history and distinguish planning/reference entries from
  implementation-ready work. Do not invent new gates for completed milestones.

- Preserve the source prototypes and all real project ledgers.
- Never deploy the unauthenticated in-memory API to public hosting.
- Do not expose database credentials or agent secrets in browser code or logs.
- Hosted private APIs require server-side authentication and authorization.
- Verify signed-out, checking, signed-in, expired-session, and sign-out behavior
  before shipping authentication. Do not add cosmetic login controls.
- Agent tokens must be revocable and project-scoped. Actor strings are not auth.
- Preserve optimistic concurrency and transactional audit for persistent writes.
- Keep account creation, remote repositories, pushes, deployments, migrations,
  credential grants, and real ledger imports behind explicit user authorization.
- Git author and committer must both be Kyle Butler <kyle@sdg.la> before a commit.
- Run npm run check and scoped browser verification after relevant changes.
- Report what passed, what remains demo-only, and what was not tested.

## App Stylr

Use the exact vendored source revision in app-stylr.json. Keep semantic roles,
Geist, focus states, responsive controls, and dark default. Adapters stay
unmodified. Preserve the incumbent layout unless Kyle requests a redesign.
Record exceptions in docs/app-stylr-exceptions.md. Creator handle is kylbutlr.
