# Reusable project onboarding

One shared implementation works for Game, App, and Other projects. Nothing in
the new importer or roadmap client names Worldrawn or assumes a particular
ledger filename. The earlier Worldrawn migration remains a historical adapter.

The matching owner-only import backend was published on October 1, 2026 at
[Project Plannr](https://project-plannr.netlify.app/?view=swimlanes).
[Hosted read-only verification](hosted-board-verification.md) confirmed import
preview without creating a project or ticket. Apply and credential issuance
remain separately approved actions. The offline preview works without a server.

## 1. Prepare a complete manifest

Copy [the example manifest](../examples/project-import.json) into the target
repo and replace all illustrative content. Use `kind: "game"`, `"app"`, or
`"other"`. Keep the same source namespace and each ticket's `sourceId` across
reruns. Projects share the workspace-wide incrementing PLNR ticket IDs, but each
source identity is scoped to its project.

An agent adapts that repo's ledger or roadmap into this JSON contract. Extraction
is deliberately not an automatic guess at arbitrary Markdown: check every
source item, acceptance check, priority, note, evidence link, and standing
requirement against the proposed manifest before applying. Preserve contextual
requirements as reference tickets when needed. Preserve original text in `raw`.
Convert relative Markdown links to immutable source links in descriptions/notes.

Follow [ticket-writing and completion](ticket-writing.md). Each implementation
item must define its outcome, bounded scope, exclusions, acceptance checklist and
verification expectations. When source notes lack criteria, draft them from the
actual approved requirements before import; do not mistake historical progress
for acceptance or invent requirements. Keep unresolved ideas explicitly planning
only. Preserve original wording in `raw` and notes, including historical evidence.

Fields:

- `version`: `1`.
- `project`: name, kind, and optional existing project ID. Name and type must
  match an existing project; archived projects are refused. After a rename,
  update the manifest name and supply the existing ID to prevent another project.
- `source.namespace`: stable lowercase identifier, not a date or random value.
- `source.url`: optional HTTPS source link without credentials.
- `source.revision` and `source.files`: optional full Git commit SHA and up to
  20 repository-relative source filenames. When files are listed, the command
  checks their working contents against that commit before any network request
  and saves their original text in the backup. Use these for ledger migrations.
  They may be omitted to create an empty project or import non-repository notes.
- `tickets`: at most 100 items per manifest. Larger ledgers can use reviewed
  batches with the same namespace and distinct stable IDs.
- Ticket `sourceId`, `title` (up to 120 characters), `raw` (up to 32,000),
  `status` (`next`, `in-progress`, `completed`), and nonnegative integer
  `priority` are required. This numeric field preserves the source's queue rank.
  Optional `priorityLevel` is `P0`, `P1`, `P2`, or `P3`; omitted levels default to
  P2 without altering old import hashes. Level sorts first, then queue rank.
- `description` is optional, up to 4,000 characters. Without one, original text
  is used directly; long original text is preserved in note chunks instead.
- `notes`: optional array of up to 30 notes, each up to 1,800 characters.
  `legacyStatus` and `category` optionally preserve the old terminology.

Status mapping is an explicit planning decision, not fresh QA. Historical
Completed entries have no invented completion timestamp or work claim. Entire
manifests must fit the 512 KiB import request limit; local files are capped at
500,000 bytes to leave room for the request envelope.

## 2. Preview without credentials or writes

From any terminal, substituting the actual repository and manifest paths:

```sh
npm --prefix /Users/kylebutler/Documents/sites/project-plannr run onboard -- \
  --repo /absolute/path/to/project \
  --manifest /absolute/path/to/project/plannr-import.json
```

This prints every proposed source ID, title, state, priority, totals, plan hash,
and verified source filenames. It does not read the live board, sign in, issue
credentials, create files, or change data. Review the full manifest too, not just
the summary. Live collision and concurrency checks happen during an apply.

## 3. Apply with the owner's one-time authorization

Use the existing owner password privately in your terminal. Do not paste it into
chat, put it in command arguments, or give it to the ongoing project agent.
For Bash or Zsh, this reads it without showing it or storing it in shell history:

```sh
read -rs PLANNR_PASSWORD
export PLANNR_PASSWORD
```

Type the password and press Enter. Run the reviewed import:

```sh
npm --prefix /Users/kylebutler/Documents/sites/project-plannr run onboard -- \
  --repo /absolute/path/to/project \
  --manifest /absolute/path/to/project/plannr-import.json \
  --apply
unset PLANNR_PASSWORD
```

The default destination is [Project Plannr](https://project-plannr.netlify.app/?view=swimlanes).
For disposable local verification, pass `--origin http://127.0.0.1:4205` to a
private server with its own configured owner password. Never run a real import
in demo mode; demo IDs and storage are deliberately disposable.

The command signs in through the existing password API, checks CSRF, saves a
live project-only backup, then creates the project and missing tickets in one
transaction. It reads each imported ticket back before reporting verification.
It signs out its own setup session afterward, without closing other sessions.
No database URL is needed in the importing repo.

Existing source IDs with identical imported content are preserved, including
subsequent owner edits. Changed source content, duplicate source keys, matching
unimported titles, archived/type mismatches, and edits between preview and apply
stop the import. No merge or overwrite is guessed. Different namespaces are
different sources, so keep namespaces stable and review coverage carefully.

Backups under ignored `data/onboarding/<operation-id>/` in Project Plannr contain:
the manifest and committed sources, the original project and tickets, the
idempotency key, source-to-PLNR mapping, and the read-back tickets. The directory
is owner-only (700), and each file is owner-readable/writable (600). They exclude
passwords, credentials, sessions, other projects, and the full workspace state.

The command does not automatically retry failed writes. A network timeout can
happen after commit. Keep the backup and inspect the board before rerunning;
stable source keys make a reviewed fresh apply preserve already-imported items.
The saved operation key can also replay an identical API request for 24 hours.

## 4. Optional scoped access for the project agent

This is a separate explicit grant. Before adding `--issue-agent`, ensure the
target repo ignores `.plannr/` in its `.gitignore`, and no `.plannr` files are
already tracked. The command refuses to overwrite any existing `agent.json`.
Existing access, including Worldrawn's, does not need replacement.

```sh
npm --prefix /Users/kylebutler/Documents/sites/project-plannr run onboard -- \
  --repo /absolute/path/to/project \
  --manifest /absolute/path/to/project/plannr-import.json \
  --apply --issue-agent
unset PLANNR_PASSWORD
```

After read-back, it requests one revocable, 30-day credential assigned to only
that project and saves it to the repo's ignored `.plannr/agent.json`, using 700
directory and 600 file permissions. The password is not copied into that file;
the token is never printed. The server stores only its hash.

If setup fails after issuance was attempted, it looks up and revokes only that
operation's uniquely named grant. If that cleanup cannot reach the server, the
command fails and access must be reviewed/revoked through the owner API before
replacement. A failed setup may leave an empty reserved `agent.json`; inspect
the board, backup, and grants before removing that exact file and trying again.
Ticket import can already be committed when credential setup fails.

## 5. Everyday roadmap access, shared across repositories

The reusable command reads only that repo's scoped credential. It does not load
the owner's `.env`, need database access, or silently grant access:

```sh
npm --prefix /Users/kylebutler/Documents/sites/project-plannr run roadmap -- \
  --repo /absolute/path/to/project

npm --prefix /Users/kylebutler/Documents/sites/project-plannr run roadmap -- \
  --repo /absolute/path/to/project backlog

npm --prefix /Users/kylebutler/Documents/sites/project-plannr run roadmap -- \
  --repo /absolute/path/to/project show TICKET_ID
```

`board` includes the active tickets and paginated completed slice. `backlog`
lists Next items in priority order. `show` reads an exact ticket. Explicit
`claim`, `renew`, `release`, and `note` commands require the latest revision:

```sh
npm --prefix /Users/kylebutler/Documents/sites/project-plannr run roadmap -- \
  --repo /absolute/path/to/project note TICKET_ID REVISION "Progress and evidence"
```

The shared client has no `move` or automatic Completed action. Approval to
implement, push, merge, or deploy remains separate. Claims coordinate access,
not permission to start arbitrary work. Expiry/revocation and project access are
checked by the server on every request. This shared command currently requires
the local Project Plannr checkout; it is not a separately published npm package.

For repos alongside Project Plannr in the same parent directory, an optional
`package.json` script makes the everyday command as short as Worldrawn's without
copying the client implementation:

```json
{"scripts": {"roadmap": "node ../project-plannr/scripts/roadmap.mjs --repo ."}}
```

Merge that entry into existing scripts, do not replace them. Then use
`npm run roadmap` or `npm run roadmap -- show TICKET_ID` from the target repo.
If repositories are elsewhere, keep the explicit absolute shared command above
or configure the appropriate shared-checkout path for that machine.

## 6. Retire the old ledger only after review

Open [Project swimlanes](https://project-plannr.netlify.app/?view=swimlanes), check
all imported items and mapping, and confirm the backup. With explicit approval,
remove only the migrated editable ledger and replace repo instructions with the
board link and the shared roadmap commands. Keep implementation documentation,
technical evidence, and backups. Do not keep two editable sources of priority.
The CLI never deletes repository files or pushes/merges/deploys anything.

## Agent handoff prompt

> Integrate this repository with Project Plannr as its authoritative roadmap.
> Read the shared project-onboarding guide and inspect every existing planning
> source. Prepare a version-1 manifest for this game/app/other project, preserving
> each item's source ID, original wording, acceptance checks, status, priority,
> notes, and evidence links. Run the offline preview and show a complete coverage
> mapping. Follow the shared ticket-writing guide: give every implementation item
> bounded scope, exclusions, observable acceptance criteria and verification
> expectations; label unresolved ideas as planning only. Preserve historical
> source text and do not add new gates to completed milestones. Review the coverage
> mapping before applying. Use the shared onboarding command, not a repo-specific
> copy. Obtain explicit approval before importing live items or issuing a
> project-scoped 30-day credential. The owner password must stay private and
> separate from agent access. Back up and verify every imported item before
> requesting permission to remove only the migrated editable ledger. Add the
> board link and shared roadmap commands to repo instructions; preserve technical
> docs and evidence. Do not push, open a PR, merge, or deploy without approval.

## Updating individual checklist steps

After owner authorization, use the same ignored, owner-only scoped credential
and shared command. Read the current ticket, claim or renew it as needed, and
use each returned revision. Item IDs are in `show` output.

```sh
npm run roadmap -- --repo /absolute/project show PLNR-47
npm run roadmap -- --repo /absolute/project checklist-add PLNR-47 REVISION "Review one venue"
npm run roadmap -- --repo /absolute/project checklist-edit PLNR-47 REVISION ITEM_ID "Review the approved venue"
npm run roadmap -- --repo /absolute/project checklist-check PLNR-47 REVISION ITEM_ID
npm run roadmap -- --repo /absolute/project checklist-uncheck PLNR-47 REVISION ITEM_ID
npm run roadmap -- --repo /absolute/project checklist-remove PLNR-47 REVISION ITEM_ID
```

Replace REVISION and ITEM_ID with verified current values. Mutations require an
unexpired claim and project scope; stale revisions fail with no automatic retry.
Checking all steps does not mark the ticket Completed. Owner review remains
separate. Add evidence notes for the checks you perform and explain unfinished
steps. Do not backfill historical completion from comments without verified
evidence and authorization. The UI and backend must be published together
before using these checklist commands against the hosted board.
