# Self-hosting Project Plannr

## Local access without a password

Use Node.js 22.13 or newer and a fresh release directory:

```sh
npm ci --omit=dev
npm run start:local
```

Open http://127.0.0.1:4205. `start:local` explicitly selects
`PLANNR_AUTH_MODE=none`. The server binds to 127.0.0.1. It rejects a public origin
or a Netlify runtime in this mode. Origin and CSRF checks remain in place.

## Optional local password

Copy `.env.example` to `.env` only if the destination does not exist. Select
`PLANNR_AUTH_MODE=password` and set `PLANNR_PASSWORD` to a unique 16–256 character
password. Keep the file owner-readable and run `npm start`. The browser retains
only a revocable session cookie, not your password. Remove the password setting
before explicitly switching to passwordless access.

## Storage and updates

Without `DATABASE_URL`, data is stored in `data/workspace.json`, with an exclusive
process lock and atomic writes. Stop the server with Ctrl+C before backing up or
moving this directory. Do not remove a lock until you have confirmed its server
has exited. The app never silently chooses another port or another data file.

Extract upgrades into a separate directory, install their locked dependencies,
then point `PLANNR_DATA_FILE` at your existing workspace. Keep a stopped-server
backup and the previous release until you have verified the upgrade.

## Hosted installations

The existing HTTPS/Netlify adapter requires the workspace password and an
explicitly configured PostgreSQL host. Passwordless local access does not weaken
that adapter. Do not expose the demo API to a network. Advanced PostgreSQL
configuration remains explicit and must match the configured host.

## Release scope

One owner per installation. No hosted account is provided. There is no automatic
update service. Review the source and configuration before adding a reverse
proxy or connecting agents. The GitHub release includes source, browser assets,
server code, and setup instructions; npm installs the pinned runtime dependencies.
