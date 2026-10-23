<img src="assets/app-icon.svg" width="64" height="64" alt="">

# Project Plannr

One project workspace for people and agents.

Project Plannr is a self-hosted planning app for organizing priorities, reviewing
work, and coordinating project-scoped agents. Move between project swimlanes,
Kanban, and a ranked queue while keeping ticket checklists, work claims, and
activity in the same workspace.

[Download releases](https://github.com/kylbutlr/project-plannr/releases) ·
[Self-hosting guide](docs/self-hosting.md) ·
[Agent API](docs/agent-api.md) ·
[Report an issue](https://github.com/kylbutlr/project-plannr/issues)

## Availability

Project Plannr is open-source under the MIT license. Versioned GitHub downloads
include the web interface, server source, setup instructions, file manifest, and
SHA-256 checksums. Run one owner-managed workspace on your own machine or an
explicitly configured private server. No account, subscription, or
maintainer-hosted workspace is required.

| Installation | Requirements | Storage |
| --- | --- | --- |
| Local workspace | Node.js 22.13 or newer | Persistent local file, created on first use |
| Private hosted workspace | Node.js and configured PostgreSQL/HTTPS hosting | Your explicitly configured database |
| Project agents | A running workspace and separately issued credential | Access restricted to assigned projects |

## Highlights

- Organize applications, games, and other projects in three complementary views.
- Create, edit, archive, and restore projects without discarding their tickets.
- Track priorities, ticket checklists, notes, revisions, and completion history.
- Search across loaded and unloaded tickets, with explicit board sorting.
- Keep drafts and expanded pages intact when remote updates arrive; refresh when
  you are ready.
- Give agents revocable project-scoped access and expiring work claims.
- Reject stale writes rather than silently replacing someone else's edits.

## Quick start

Download the latest archive and checksums from Releases. Verify the archive,
extract it into a fresh directory, and open a terminal there. With Node.js
22.13 or newer:

```sh
npm ci --omit=dev
npm run start:local
```

Open [your local workspace](http://127.0.0.1:4205/). This explicit local mode
requires no password or managed database. It binds to loopback and starts with
an empty persistent workspace under `data/`. Stop it with Ctrl+C in the same
terminal.

For a local password, configure `PLANNR_AUTH_MODE=password` and
`PLANNR_PASSWORD` in an ignored `.env`, then run `npm start`. Missing credentials
never select passwordless mode. Hosted access retains server-side password
authentication. See [installation and password modes](docs/self-hosting.md).

### Your first project

1. Open **Manage projects**, add a name, and choose App, Game, or Other.
2. Add a ticket with a clear title and priority.
3. Open it to write the scope, add checklist items, or record a note.
4. Move work between Next, In progress, and Completed. Completing a checklist
   does not silently change the ticket's status.
5. Try Kanban or Ranked queue when you need a different view of the same work.

Archived projects can be restored from Manage projects. Optional demo mode uses
illustrative records and resets on restart; it never imports real repository
ledgers or replaces your saved workspace.

## Make it yours

Workspace preferences save a workspace label, your display name, dark or light
appearance, comfortable or compact spacing, and a default board view in this
browser. Display preferences do not change server identity, audit actors,
project data, or agent permissions. If browser storage is unavailable,
preferences can still apply for the current visit.

Project names and types are owner-managed workspace data. View preferences,
project collapse state, and board sorting stay local to the browser. The
interface uses visible labels, keyboard focus, and native control fallbacks
rather than requiring one browser's custom dropdown behavior.

## Working with agents

The owner issues a separate revocable credential for each agent and its assigned
projects. Keep it out of command arguments, source control, and issue reports.
Agent labels alone never grant access, and agents do not inherit unrestricted
owner access when the local owner selects passwordless mode.

The [agent API guide](docs/agent-api.md) covers scopes, claims, revisions, and
supported operations. [Project onboarding](docs/project-onboarding.md) explains
reviewed imports, project-only backups, source preservation, and read-back
verification. Imports do not delete repository ledgers or guess missing work.

## Privacy, storage, and updates

Projects, tickets, access records, and activity stay on your server. The local
installation does not require analytics, a cloud account, or a remote workspace.
Browser writes still require the configured origin and a CSRF token. Hosted
installations must keep authentication enabled.

Back up `data/` only after stopping its server. Extract updates separately,
install their locked dependencies, and reconnect the existing workspace using
`PLANNR_DATA_FILE`. Keep a stopped-server backup and the prior release until the
upgrade is verified. Do not remove a live process lock to start another server.
See [storage and updates](docs/self-hosting.md).

## Scope and limitations

One owner manages each installation. Project Plannr is not a public signup or
multi-tenant service. It does not provide hosting, automatic updates, or an
agent execution platform. Agents work through scoped credentials and the same
server-enforced revision rules as the owner.

Fresh browser acceptance for the interface refresh remains pending. Automated
checks cover application behavior and packaging; they do not replace rendered
review or validate a user's hosting configuration.

## Development

Use Node.js 22.13 or newer, with disposable workspace fixtures:

```sh
npm ci
npm run check
npm run build
npm run package
```

Checks exercise authentication, scoped access, persistence, claims, stale writes,
imports, and public assets. The build creates the allowlisted browser output;
packaging writes the source/runtime archive, manifest, and checksums under
`releases/`. Neither command publishes or deploys the app. Read
[contributing](CONTRIBUTING.md) and the [changelog](CHANGELOG.md) before a change.

## Design foundation

The interface uses the vendored [App Stylr v1.2.0](https://github.com/kylbutlr/app-stylr/tree/b3ca31ea264d5dd233fd871ac167247f1c306985)
foundation, bundled Geist typography, and the optional native-control recipe
from the pending v1.3.0 refresh. See the [Visual Reference](https://kylbutlr.com/app-stylr)
and [implementation notes](docs/app-stylr-exceptions.md). App Stylr provides the
shared visual values; Project Plannr owns its layout and planning behavior.

## Support and license

Use [GitHub Issues](https://github.com/kylbutlr/project-plannr/issues) for
reproducible bugs and suggestions. Include your version, installation type,
steps, and on-screen error using fictional examples. Never share passwords,
agent tokens, database credentials, private project data, or workspace exports.
See [security reporting](SECURITY.md) for vulnerabilities.

Created by [kylbutlr](https://kylbutlr.com). Available under the [MIT License](LICENSE).
