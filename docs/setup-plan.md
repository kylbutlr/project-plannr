# Project Plannr setup plan

## Approved direction

A personal app on Netlify, publicly reachable but protected by one private
server-side workspace password. No OAuth app, public signup, separate human
accounts, or team-invitation system is required. Agents use separate, revocable
project-scoped tokens, not the owner password or database connection.

One database holds Game, App, and Other project rows. Preserve Project swimlanes
as the default, plus Kanban and Ranked queue. Keep technical implementation
evidence in the respective repositories.

## Implemented locally

1. Persist projects, tickets, notes, priorities, revisions, claims and activity
   through local-file or transactional Postgres storage.
2. Authenticate the workspace owner using the server password and hashed
   eight-hour sessions. Protect private API reads and writes.
3. Enforce browser origin/CSRF checks, persistent login limits, password rotation
   invalidation, sign out and session expiry.
4. Issue/revoke scoped agent credentials, renew/release five-minute work claims,
   reject stale/conflicting writes, and deduplicate retries.
5. Share the protected application interface between local HTTP and Netlify.
   Publish only whitelisted browser assets.

## Release sequence

1. Configure the isolated development connection and local workspace password.
2. Apply the additive migration and verify live persistence, rollback,
   competing claims, retries, and connection-pool restart.
3. Authorize creating/linking a dedicated
   [Netlify project](https://app.netlify.com/) with runtime secrets and an exact
   hosted origin. First hosted verification uses development data.
4. Verify actual hosted login, private API denial, cookies, persistence, agent
   scopes, origin/CSRF, sign out and responsive views.
5. Enable production only after explicit authorization and repeat migration and
   hosting checks against the approved production target.
6. Import selected real ledgers with stable IDs, reviewed mappings and a
   recoverable source snapshot. Declare the board authoritative only after
   Kyle confirms the migration.

A claim coordinates work. It does not grant permission to push, merge, deploy,
publish, or change another external service.

## Deferred

Public signup, billing, complex Jira workflows, bidirectional ledger sync,
automated agent execution, paginated activity history, and a credential
management UI. None is needed to verify the first private workspace.

See [current provisioning](provisioning-status.md),
[local setup](local-setup.md), and [Netlify setup](netlify-setup.md).
