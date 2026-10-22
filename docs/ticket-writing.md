# Ticket writing and completion

Every implementation ticket needs a bounded definition of done before work starts.
Project Plannr is the authoritative planning source for games, apps and other
projects. Keep technical evidence in the relevant repository, not a second backlog.

## Required description

```md
## Outcome
Describe the observable benefit delivered by this milestone.

## Scope
- Do a specific change to a named surface or system.

## Out of scope
List related work that does not block this milestone.

## Acceptance criteria
- [ ] A discrete, observable outcome with an unambiguous pass/fail condition.
- [ ] The relevant interaction and failure/empty state work as specified.
- [ ] Existing behavior explicitly placed in scope remains intact.

All Checklist items are expected to be marked Completed. Any item left incomplete
must include a brief reason why.

## Verification
Name the affected routes or reproducible fixtures and the checks appropriate to
this change. Record the build and evidence against each criterion at closeout.
```

Use a few specific criteria, not vague instructions such as "improve quality" or
"continue polishing." Counts, numerical targets, platform coverage and new
features must come from approved scope or verified project requirements. Do not
invent them to make a ticket look complete. Dependencies identify an existing
ticket and its owning outcome rather than duplicating another ticket's scope.

## Planning and imports

- An unresolved idea is a planning ticket, explicitly not ready for implementation.
  Its deliverable is an approved, bounded specification. Separate proposed feature
  expectations from the criteria for finishing that planning task.
- Imported progress notes are historical context, not current acceptance criteria.
  Preserve source text, metadata, evidence and comments while adding explicit scope.
- Reference tickets document standing requirements. They are not delivery tasks
  and should say so rather than carrying an artificial feature completion gate.
- Do not reopen completed tickets or add new requirements to their accepted scope.
  If documenting historical acceptance, label it retrospective and attribute the
  evidence. Put additional implementation work in an approved follow-up.

## Before work and at closeout

Read the complete live ticket, comments, linked requirements and references before
implementation, then repeat that coverage check during final QA. Map each criterion
to implementation and verification evidence. A code check does not prove rendered
behavior, and a screenshot does not prove an untested interaction.

Use proportionate checks agreed up front. Do not turn a bounded feature into an
open-ended performance project or add new closeout gates after review. Record
unverified checks and explicit user-approved exclusions honestly. User acceptance
can establish the reviewed result, but must not be presented as an agent-run test.
Completion requires each criterion to pass or be explicitly removed from scope
with approval. Status changes, comments, imports and remote publication still
require the applicable user authorization.

## Native checklist progress

After the checklist feature is published, keep individually verifiable steps in
the ticket editor's Checklist section. The board then shows completed/total
progress without opening notes. Keep the description's outcome, boundaries and
reference requirements intact. Existing Markdown criteria are not converted or
marked complete automatically.

Check a step only when its evidence passes or the owner explicitly accepts the
reviewed result. Preserve the source and explain any incomplete steps in notes.
Checking every item does not change ticket status; the owner still reviews the
whole definition of done before moving the ticket to Completed.
