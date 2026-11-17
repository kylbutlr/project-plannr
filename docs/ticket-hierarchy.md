# Parent tickets and sub-tasks

A parent represents an overall effort. A same-project sub-task represents an
independently actionable deliverable. Each ticket keeps its own status,
priority, notes and checklist.

Open a parent to create a sub-task or attach an existing eligible ticket. Detach
it there, or change the Parent field on the child. There is one parent per child
and one level of nesting. Self-links, cycles and cross-project links are rejected.
Buttons open linked tickets even when they are outside the loaded board page.
Save or finish drafts before linking or navigating.

Board cards and the parent editor count all completed/total children, including
unloaded history. Checklist progress, child progress and parent status are
independent. Completing children never completes or reopens a parent. Review and
change the parent status explicitly.

Top-level tickets can store an optional HTTPS external reference, without
embedded credentials. The interface links to it without signing in, importing or
synchronizing with another tracker. Existing `radarUrl` data and the `radar` CLI
command remain compatible; the field now accepts any HTTPS tracker.

Relationship operations use the existing scoped API, claims, optimistic
revisions, idempotency and transactional audit. See [agent API](agent-api.md).
Existing tickets remain top-level until explicitly linked; no bulk rewrite or
additional database migration runs.

For verification, use disposable tickets to exercise creation, attachment,
detachment, reparenting, unloaded navigation, progress and manual parent status.
Include invalid links, stale writes, unauthorized reads, draft preservation and
responsive editors. Automated coverage is in `test/ticket-relationships.test.mjs`.
