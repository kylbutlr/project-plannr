import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {workspace} from '../lib/workspace.mjs';
import {audit, hash} from '../lib/auth.mjs';

// Internal verification lifecycle only. This is not a public deletion API.
export async function cleanupVerificationFixture(store, {project, ticketId, ticketRevision, sessionId}) {
  return store.transact(state => {
    if (project) {
      if (!project.id || !project.name?.startsWith('Storage verification ')) throw Error('Refusing an unidentified verification target.');
      const saved = state.projects.find(row => row.id === project.id);
      if (saved && (saved.name !== project.name || saved.kind !== 'other' || project.revision !== undefined && saved.revision !== project.revision)) throw Error('Refusing cleanup: verification project changed.');
      const tickets = state.tickets.filter(row => row.project === project.id);
      if (tickets.some(row => row.id !== ticketId || ticketRevision !== undefined && row.revision !== ticketRevision || row.title !== 'Verify durable transactions' || row.comments?.some(note => note.text !== 'Idempotent verification note'))) {
        throw Error('Refusing cleanup: unexpected work exists in the verification project.');
      }
      if (state.tickets.some(row => row.id === ticketId && row.project !== project.id) || state.agents.some(row => row.projects.includes(project.id))) {
        throw Error('Refusing cleanup: verification target has unrelated references.');
      }
      const hadFixtures = Boolean(saved || tickets.length);
      state.projects = state.projects.filter(row => row.id !== project.id);
      state.tickets = state.tickets.filter(row => row.project !== project.id);
      state.replays = state.replays.filter(row => row.project !== project.id);
      if (hadFixtures) audit(state, {id: 'verification', name: 'Database verification'}, ticketId || project.name, 'removed storage verification fixtures', project.id);
    }
    if (sessionId) state.sessions = state.sessions.filter(row => row.id !== sessionId);
    // Keep audit history and the monotonic ticket counter. Never reuse IDs.
  });
}

export async function verifyStorage(openStore, config) {
  if (config.mode !== 'private' || !config.authConfigured) throw Error('Private verification configuration is required.');
  let store = openStore(), project, ticket;
  const raw = randomUUID(), sessionId = hash(raw), stamp = Date.now();
  const headers = {cookie: `${config.secure ? '__Host-plannr' : 'plannr_session'}=${raw}`, origin: config.origin, 'x-csrf-token': hash(`${raw}:csrf`)};
  const run = (path, method, body, extra = {}) => workspace(store, config).mutate(path, method, body, {...headers, ...extra});
  try {
    await store.transact(state => state.sessions.push({id: sessionId, ownerId: config.ownerId, name: 'Database verification', authVersion: config.passwordDigest, expiresAt: stamp + 60000}));
    project = (await run('/api/projects', 'POST', {name: `Storage verification ${randomUUID()}`, kind: 'other'})).body;
    ticket = (await run('/api/tickets', 'POST', {project: project.id, title: 'Verify durable transactions'})).body;
    const before = await store.read();
    await assert.rejects(run(`/api/tickets/${ticket.id}`, 'PATCH', {revision: ticket.revision, status: 'completed', priority: -1}));
    assert.deepEqual(await store.read(), before, 'Failed mutation must roll back ticket and audit together.');
    const claims = await Promise.allSettled([run(`/api/tickets/${ticket.id}/claim`, 'POST', {revision: ticket.revision}), run(`/api/tickets/${ticket.id}/claim`, 'POST', {revision: ticket.revision})]);
    assert.equal(claims.filter(result => result.status === 'fulfilled').length, 1);
    const key = randomUUID(), change = {revision: ticket.revision + 1, comment: 'Idempotent verification note'};
    const result = await run(`/api/tickets/${ticket.id}`, 'PATCH', change, {'idempotency-key': key});
    assert.deepEqual(await run(`/api/tickets/${ticket.id}`, 'PATCH', change, {'idempotency-key': key}), result);
    await store.close(); store = openStore();
    const restarted = await store.read();
    assert.equal(restarted.tickets.find(row => row.id === ticket.id).comments.length, 1);
    assert.ok(restarted.activity.some(row => row.project === project.id));
  } finally {
    // Normal failures still clean partial fixtures. Cleanup failures must fail the check.
    try {
      await cleanupVerificationFixture(store, {project, ticketId: ticket?.id, sessionId});
      const clean = await store.read();
      assert.ok(!clean.projects.some(row => row.id === project?.id));
      assert.ok(!clean.tickets.some(row => row.project === project?.id));
      assert.ok(!clean.replays.some(row => row.project === project?.id));
      assert.ok(!clean.sessions.some(row => row.id === sessionId));
    }
    finally {await store.close();}
  }
}
