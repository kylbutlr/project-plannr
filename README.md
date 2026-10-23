# Project Plannr

One project workspace for people and agents.

Project Plannr is a self-hosted planning app with project swimlanes, a Kanban board,
and a ranked queue. Keep priorities, ticket checklists, work claims, and activity
in one place while giving each agent access only to the projects it needs.

[Downloads](https://github.com/kylbutlr/project-plannr/releases) ·
[Local setup](docs/self-hosting.md) ·
[Report an issue](https://github.com/kylbutlr/project-plannr/issues)

## Run it locally

Requires Node.js 22.13 or newer. Download and extract the v1.0.0 archive, open a
terminal in its directory, then run:

```sh
npm ci --omit=dev
npm run start:local
```

Open [Project Plannr](http://127.0.0.1:4205/). This explicit local mode needs no
password, account, database service, or hosted deployment. It binds to loopback
and stores an initially empty workspace under `data/`. Stop it with Ctrl+C in the
same terminal. Keep that directory when updating; it contains your workspace.

To use a local password instead, follow [the setup guide](docs/self-hosting.md).
A missing password never silently selects passwordless access. Public hosting
continues to require authentication and database storage.

## What it does

- Organize apps, games, and other projects using Swimlanes, Kanban, or Ranked queue.
- Create, edit, archive, and restore projects; search work across loaded pages.
- Track ticket priorities, checklists, notes, revisions, and completion history.
- Keep open drafts when remote updates arrive; refresh when you are ready.
- Give agents revocable project-scoped credentials, bounded work claims, and a
  shared transaction history. Agent labels alone never grant access.
- Reject stale writes rather than silently overwriting another person's changes.

One owner manages each installation. This is not a public signup service or a
multi-tenant hosted product. The optional demo uses illustrative records and
resets on restart; your local workspace starts empty.

## Agents

The owner issues a separate credential for each agent and its assigned projects.
Keep it in the environment, outside command arguments and source control. Start
with [the agent API](docs/agent-api.md) and [project onboarding](docs/project-onboarding.md).
Existing agent credentials still work when the local owner chooses passwordless
access; agents do not inherit unrestricted owner access.

## Development

```sh
npm ci
npm run check
npm run build
npm run package
```

`npm run package` writes a reviewed source/runtime archive, a file manifest, and
SHA-256 checksums under `releases/`. It excludes workspace data, credentials,
private rollout documents, and historical screenshots. Updates are manual.

The interface uses the vendored [App Stylr](https://github.com/kylbutlr/app-stylr)
foundation with bundled Geist typography and dark semantic roles. Intentional
exceptions are recorded in [the design notes](docs/app-stylr-exceptions.md).

## Privacy and support

Your projects and tickets stay on your server. Back up the data directory only
after stopping its server, and keep backups private. Local passwordless mode is
for the current machine; browser writes still require the configured origin and
a CSRF token. No account, analytics service, or remote workspace is required.

Read [security reporting](SECURITY.md) before sharing a vulnerability. Use
[GitHub Issues](https://github.com/kylbutlr/project-plannr/issues) for reproducible
bugs, with fictional examples and no tokens, passwords, or workspace exports.

Created by [Kyle Butler](https://kylbutlr.com). [MIT license](LICENSE).
