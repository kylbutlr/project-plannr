import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {emptyState, memoryStore, fileStore, postgresStore} from '../lib/store.mjs';
import {configuration} from '../lib/config.mjs';
import {apiApplication} from '../lib/api.mjs';
import {hash} from '../lib/auth.mjs';
import {agentCommand} from '../lib/agent-command.mjs';

async function harness(store = memoryStore()) {
  const config = configuration({PLANNR_PASSWORD: 'fixture-only-password'}), raw = 'fixture-session', now = 100000;
  await store.transact(state => state.sessions.push({id: hash(raw), ownerId: config.ownerId, name: 'Owner', authVersion: config.passwordDigest, expiresAt: now + 3600000}));
  const app = apiApplication(store, config, {now: () => now});
  const owner = {cookie: `plannr_session=${raw}`, origin: config.origin, 'x-csrf-token': hash(`${raw}:csrf`)};
  const send = (path, method = 'GET', body, headers = owner) => {
    const url = new URL(path, config.origin);
    return app({path: url.pathname, query: url.searchParams, method, headers, body: async () => body});
  };
  const p = (await send('/api/projects', 'POST', {name: 'Fictional app', kind: 'app'})).body;
  const create = async (title, extra = {}) => {
    const result = await send('/api/tickets', 'POST', {project: p.id, title, ...extra});
    assert.equal(result.status, 201, JSON.stringify(result.body)); return result.body;
  };
  const edit = (ticket, patch, headers) => send(`/api/tickets/${ticket.id}`, 'PATCH', {revision: ticket.revision, ...patch}, headers);
  return {store, p, send, owner, create, edit};
}

test('create, attach, reparent and detach retain independent status, checklist, notes and manual parent completion', async () => {
  const h = await harness(), parent = await h.create('Overall effort', {radarUrl: 'https://tracker.example.com/123'}), second = await h.create('Another effort');
  const child = await h.create('First sub-task', {parentId: parent.id});
  const updated = await h.edit(child, {checklistChanges: [{action: 'add', text: 'Reviewed', completed: true}], comment: 'Evidence', status: 'completed'});
  assert.equal(updated.status, 200); assert.equal(updated.body.parentId, parent.id);
  assert.equal((await h.send(`/api/tickets/${parent.id}`)).body.status, 'next');
  let packet = (await h.send(`/api/tickets/${parent.id}?include=relationships`)).body;
  assert.deepEqual(packet.children.map(row => row.id), [child.id]);
  let board = (await h.send('/api/board')).body;
  assert.deepEqual(board.relationships[parent.id].subtasks, {completed: 1, total: 1});
  const moved = await h.edit(updated.body, {parentId: second.id});
  assert.equal(moved.status, 200); assert.deepEqual(moved.body.checklist, updated.body.checklist); assert.deepEqual(moved.body.comments, updated.body.comments);
  const detached = await h.edit(moved.body, {parentId: null}); assert.equal(detached.body.parentId, null);
  assert.equal((await h.edit(parent, {status: 'completed'})).status, 200);
  const later = await h.create('Later task', {parentId: parent.id});
  assert.equal(later.status, 'next'); assert.equal((await h.send(`/api/tickets/${parent.id}`)).body.status, 'completed');
});

test('invalid hierarchy/reference writes roll back all fields, counter, checklist and audit', async () => {
  const h = await harness(), parent = await h.create('Parent'), child = await h.create('Child', {parentId: parent.id});
  const foreign = (await h.send('/api/projects', 'POST', {name: 'Other project', kind: 'app'})).body;
  const other = await h.create('Other', {project: foreign.id});
  for (const [ticket, patch, status] of [
    [parent, {parentId: parent.id}, 400], [parent, {parentId: child.id}, 400],
    [child, {parentId: child.id}, 400], [child, {parentId: other.id}, 400],
    [child, {parentId: 'missing'}, 400], [parent, {parentId: other.id}, 400],
    [child, {parentId: false}, 400], [child, {radarUrl: 'https://tracker.example.com/123'}, 400],
    [parent, {radarUrl: 'javascript:alert(1)'}, 400], [parent, {radarUrl: 'http://tracker.example.com/123'}, 400],
    [parent, {radarUrl: 'https://user:password@tracker.example.com/123'}, 400]
  ]) {
    const before = await h.store.read();
    assert.equal((await h.edit(ticket, {title: 'Must roll back', checklistChanges: [{action: 'add', text: 'Must roll back'}], ...patch})).status, status);
    assert.deepEqual(await h.store.read(), before);
  }
  const root = await h.create('Root');
  assert.equal((await h.edit(parent, {parentId: root.id})).status, 409);
  const before = await h.store.read();
  assert.equal((await h.send('/api/tickets', 'POST', {project: h.p.id, title: 'Bad child', parentId: child.id})).status, 400);
  assert.deepEqual(await h.store.read(), before);
});

test('scoped relationship reads and writes retain claims, CSRF, stale revisions and idempotency', async () => {
  const h = await harness(), parent = await h.create('Parent'), child = await h.create('Existing ticket');
  const other = (await h.send('/api/projects', 'POST', {name: 'Secret project', kind: 'app'})).body;
  const hidden = await h.create('Secret ticket', {project: other.id});
  const agent = (await h.send('/api/agents', 'POST', {name: 'Scoped fixture', projects: [h.p.id]})).body;
  const headers = {authorization: `Bearer ${agent.token}`};
  assert.equal((await h.send(`/api/tickets/${hidden.id}?include=relationships`, 'GET', undefined, headers)).status, 404);
  assert.equal((await h.edit(child, {parentId: parent.id}, headers)).status, 409);
  assert.equal((await h.edit(child, {parentId: parent.id}, {cookie: h.owner.cookie, origin: h.owner.origin})).status, 403);
  const claimed = (await h.send(`/api/tickets/${child.id}/claim`, 'POST', {revision: child.revision}, headers)).body;
  const keyed = {...headers, 'idempotency-key': 'attach-once'};
  const attached = await h.edit(claimed, {parentId: parent.id}, keyed);
  assert.equal(attached.status, 200);
  assert.deepEqual(await h.edit(claimed, {parentId: parent.id}, keyed), attached);
  assert.equal((await h.edit(claimed, {parentId: null}, headers)).status, 409);
  const packet = (await h.send(`/api/tickets/${parent.id}?include=relationships`, 'GET', undefined, headers)).body;
  assert.doesNotMatch(JSON.stringify(packet), /Secret ticket|Secret project/);
  assert.equal(packet.children[0].id, child.id);
  const state = await h.store.read(); assert.equal(state.activity.filter(row => row.ticket === child.id && row.action === 'updated ticket').length, 1);
});

test('page and search summaries include unloaded children and relationships navigate to unloaded tickets', async () => {
  const h = await harness(), parent = await h.create('Find parent');
  for (let i = 0; i < 25; i++) await h.create(`Completed child ${i}`, {parentId: parent.id, columnId: 'completed'});
  await h.create('Active child', {parentId: parent.id});
  for (const view of ['swimlanes', 'kanban', 'queue']) {
    const query = new URLSearchParams({view, q: 'Find parent', searchScope: 'all', ...(view === 'queue' ? {} : {paging: 'lanes'})});
    const board = (await h.send(`/api/board?${query}`)).body;
    assert.equal(board.tickets.length, 1);
    assert.deepEqual(board.relationships[parent.id].subtasks, {completed: 25, total: 26});
  }
  const packet = (await h.send(`/api/tickets/${parent.id}?include=relationships`)).body;
  assert.equal(packet.children.length, 26);
  const child = (await h.send(`/api/tickets/${packet.children[0].id}?include=relationships`)).body;
  assert.equal(child.parent.id, parent.id); assert.equal(child.childOptions.length, 0);
});

test('legacy records stay unchanged; relationship fields persist across file reopen', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'plannr-hierarchy-')), path = join(directory, 'workspace.json');
  let store = await fileStore(path);
  try {
    const h = await harness(store), parent = await h.create('Legacy top-level'), child = await h.create('Persistent child', {parentId: parent.id});
    assert.equal((await h.send(`/api/tickets/${parent.id}`)).body.parentId, undefined);
    const before = await store.read(); await h.send(`/api/tickets/${parent.id}?include=relationships`); assert.deepEqual(await store.read(), before);
    await store.close(); store = await fileStore(path);
    assert.equal((await store.read()).tickets.find(row => row.id === child.id).parentId, parent.id);
  } finally {await store.close(); await rm(directory, {recursive: true, force: true});}
});

test('PostgreSQL relationship transactions, scoped summaries and custom columns match the file contract without a schema change', async () => {
  const db = new PGlite();
  for (const file of ['001-workspace.sql', '002-workflow.sql']) await db.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  const pool = {on() {}, async connect() {return {release() {}, async query(sql, params) {const r = await db.query(sql, params); return {rows: r.rows, rowCount: r.rows.length || r.affectedRows || 0};}};}, end: () => db.close()};
  const store = postgresStore('postgresql://unused.example/hierarchy', {pool});
  try {
    const h = await harness(store), parent = await h.create('SQL parent');
    const workflow = (await h.send('/api/workflow')).body;
    assert.equal((await h.send('/api/workflow', 'PATCH', {revision: workflow.revision, columns: [...workflow.columns, {id: 'approved', name: 'Approved', category: 'done', enabled: true}]})).status, 200);
    for (let i = 0; i < 12; i++) await h.create(`SQL child ${i}`, {parentId: parent.id, columnId: 'approved'});
    const packet = (await h.send(`/api/tickets/${parent.id}?include=relationships`)).body;
    assert.equal(packet.children.length, 12); assert.equal(packet.ticket.status, 'next');
    for (const url of ['/api/board?view=swimlanes&paging=lanes', '/api/board', '/api/completed']) {
      const result = await h.send(url); assert.equal(result.status, 200, JSON.stringify(result.body));
      if (result.body.relationships[parent.id]) assert.deepEqual(result.body.relationships[parent.id].subtasks, {completed: 12, total: 12});
      const child = result.body.tickets.find(row => row.parentId === parent.id);
      if (child) assert.equal(result.body.relationships[child.id].parent.id, parent.id);
    }
    const child = packet.children[0], before = await store.read();
    assert.equal((await h.edit(parent, {parentId: child.id})).status, 400); assert.deepEqual(await store.read(), before);
  } finally {await store.close();}
});

test('agent commands read and change explicit relationships without selecting work or completing a parent', () => {
  assert.equal(agentCommand(['relationships', 'PLNR-1']).path, '/api/tickets/PLNR-1?include=relationships');
  assert.deepEqual(agentCommand(['subtask', 'project', 'PLNR-1', 'Deliver a child']).body, {project: 'project', parentId: 'PLNR-1', title: 'Deliver a child'});
  assert.deepEqual(agentCommand(['parent', 'PLNR-2', '3', 'none']).body, {revision: 3, parentId: null});
  assert.deepEqual(agentCommand(['radar', 'PLNR-1', '2', 'none']).body, {revision: 2, radarUrl: ''});
  for (const args of [['parent', 'PLNR-2', '0', 'PLNR-1'], ['subtask', 'project', 'PLNR-1'], ['relationships', 'PLNR-1', 'extra']]) assert.throws(() => agentCommand(args));
});

test('competing relationship writes cannot create a cycle or a second nesting level', async () => {
  const h = await harness(), first = await h.create('First effort'), second = await h.create('Second effort');
  const results = await Promise.all([h.edit(first, {parentId: second.id}), h.edit(second, {parentId: first.id})]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
  const tickets = (await h.store.read()).tickets;
  assert.equal(tickets.filter(row => row.parentId).length, 1);
  const child = tickets.find(row => row.parentId), parent = tickets.find(row => row.id === child.parentId);
  assert.equal(parent.parentId, undefined); assert.equal(parent.revision, 1);
});

test('external parent references accept different HTTPS trackers and preserve existing stored links',async()=>{
  const h=await harness();
  for(const url of ['https://tracker.example.com/123','https://issues.example.org/team/456']){
    const ticket=await h.create('Generic reference', {radarUrl:url});
    assert.equal(ticket.radarUrl,url);
  }
});
