# One-ticket Worldrawn agent pilot

The local integration is prepared and tested with private-mode in-memory
fixtures. No real project, ticket, credential, or Worldrawn code is created or
changed by that check. That simulation is not proof of live access. Separately,
the hosted Worldrawn-scoped credential and local roadmap reads are now verified;
no live ticket has been claimed or implemented by this setup.

## Start with one real ticket

1. Open [Project swimlanes](https://project-plannr.netlify.app/?view=swimlanes) and choose one
   small Worldrawn ticket. Its description should contain the scope and discrete
   acceptance checks. Worldrawn's ledger migration is complete; use its hosted
   tickets rather than restoring a second editable tracker. Technical evidence
   remains in [the Worldrawn repository](https://github.com/kylbutlr/worldrawn).
2. Give an agent access to only the Worldrawn project through the owner-only
   [credential API](agent-api.md). Issuing a real credential requires explicit
   authorization; never give it the owner password or database URL. A credential
   management UI is not implemented yet.
3. Set the token privately in the agent's environment as `PLANNR_AGENT_TOKEN`,
   and set `PLANNR_AGENT_ORIGIN` to the exact loopback or HTTPS origin. Do not
   paste tokens in chat, command arguments, tickets, or Git. The CLI does not
   load the owner's `.env` or silently issue a credential.
4. From the Project Plannr directory, read the project backlog and exact ticket:

   ```sh
   npm run agent -- backlog PROJECT_ID
   npm run agent -- show TICKET_ID
   ```

   Substitute the real IDs shown by the board/API. Backlog lists Next tickets in
   project priority order. These read-only commands do not select or start work.
5. Kyle approves that exact ticket's implementation. The agent claims its latest
   revision, performs only the authorized scope, and renews before five minutes
   elapse while it is active:

   ```sh
   npm run agent -- claim TICKET_ID REVISION
   npm run agent -- renew TICKET_ID REVISION
   ```

   Use the latest returned revision or re-read with `show`. A 409 is a review
   boundary, not permission to force a change. Do not keep a background agent
   or renewal running without authorization.
6. Record concise progress and final evidence:

   ```sh
   npm run agent -- note TICKET_ID REVISION "Ready for review. Scope: ... Tests: ... Evidence: ... Remaining: ..."
   ```

   Include actual file/preview/commit links and distinguish verified tests from
   unverified behavior. Leave the ticket In progress for Kyle's review. Do not
   automatically mark it Completed or call expired ownership a completion.
7. Kyle reviews and sets Completed in the board. If the work is paused instead,
   explicitly release the current claim with `release TICKET_ID REVISION`; this
   returns the ticket to Next. A claim never authorizes a push or deployment.

## Acceptance for the first live pilot

- Agent sees only its assigned project and honors the chosen priority.
- Exact scope is approved before the first work claim or game edit.
- Another active agent cannot take the same ticket; stale revisions fail closed.
- Progress and real evidence appear on the same visual ticket.
- Completed remains a human review decision for this pilot.
- Original ledgers and unrelated projects remain unchanged.

Run `npm run check` for the isolated simulation. A real ticket selection, claim,
implementation and evidence-write round trip remain pending Kyle's approval.
