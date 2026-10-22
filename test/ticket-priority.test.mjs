import {test} from 'node:test';
import assert from 'node:assert/strict';
import {priorityLevel, compareActive} from '../ticket-priority.js';
import {apiApplication} from '../lib/api.mjs';
import {configuration} from '../lib/config.mjs';
import {emptyState, memoryStore} from '../lib/store.mjs';
import {laneKey, laneOrder, sqlPriorityIndex} from '../lib/lane-page.mjs';
import {agentResult} from '../lib/agent-command.mjs';
import {importPlan} from '../lib/project-import.mjs';

function fixture() {
  const state = emptyState(); state.projects = ['a', 'b'].map(id => ({id, name: id, kind: 'app', archived: false, revision: 1}));
  let id = 0;
  for (const project of ['a', 'b']) for (const status of ['next', 'in-progress', 'completed']) for (let i = 0; i < 22; i++) state.tickets.push({
    id: `PLNR-${++id}`, project, status, title: `Priority fixture ${id}`, description: '', priority: 999 - i,
    ...(i % 5 === 4 ? {} : {priorityLevel: `P${i % 4}`}), completedAt: status === 'completed' ? new Date(1000000 + i * 1000).toISOString() : null,
    revision: 1, owner: null, ownerId: null, leaseUntil: 0, comments: []});
  state.counter = id;
  const store = memoryStore(state), app = apiApplication(store, configuration({PLANNR_MODE: 'demo'}));
  const send = (path, method = 'GET', body) => {const url = new URL(path, 'http://fixture'); return app({path: url.pathname, query: url.searchParams, method, headers: {}, body: async () => body});};
  return {state, store, send};
}
test('legacy ranks default to P2 without being modified; priority beats queue rank and ID', () => {
  const legacy = {id: 'PLNR-1', priority: 1}; assert.equal(priorityLevel(legacy), 'P2'); assert.equal(legacy.priorityLevel, undefined);
  const tickets = [legacy, {id: 'PLNR-500', priority: 999, priorityLevel: 'P0'}, {id: 'PLNR-2', priority: 0, priorityLevel: 'P3'}, {id: 'PLNR-9', priority: 999, priorityLevel: 'P1'}];
  assert.deepEqual(tickets.sort(compareActive).map(row => priorityLevel(row)), ['P0', 'P1', 'P2', 'P3']);
  assert.deepEqual(agentResult({backlog: true}, {projects: [], tickets: tickets.map(row => ({...row, status: 'next'}))}).tickets.map(row => priorityLevel(row)), ['P0', 'P1', 'P2', 'P3']);
});
test('every Swimlane and Kanban column paginates in priority order, without skips or duplicate IDs', async () => {
  const h = fixture(), before = await h.store.read();
  for (const sort of ['default', 'priority', 'recent']) for (const view of ['swimlanes', 'kanban']) for (const status of ['next', 'in-progress', 'completed']) {
    const project = view === 'swimlanes' ? 'a' : 'all', params = new URLSearchParams({view, project, paging: 'lanes', sort});
    const first = await h.send(`/api/board?${params}`); assert.equal(first.status, 200);
    let tickets = first.body.tickets.filter(row => row.status === status), cursor = first.body.lanes[laneKey(project, status)].nextCursor;
    assert.equal(tickets.length, view === 'swimlanes' ? 5 : 10);
    while (cursor) {
      const page = await h.send(`/api/lane?${new URLSearchParams({view, project, status, cursor, sort})}`); assert.equal(page.status, 200);
      tickets.push(...page.body.tickets); cursor = page.body.nextCursor;
    }
    const expected = h.state.tickets.filter(row => row.status === status && (project === 'all' || row.project === project)).sort((a,b)=>laneOrder(a,b,sort));
    assert.deepEqual(tickets.map(row => row.id), expected.map(row => row.id)); assert.equal(new Set(tickets.map(row => row.id)).size, tickets.length);
  }
  assert.deepEqual(await h.store.read(), before, 'reading legacy data never migrates or rewrites tickets');
});
test('Default keeps Completed chronological; explicit Priority and Recent change whole columns, not just loaded rows', async () => {
  const h=fixture();
  const read=async sort=>(await h.send(`/api/board?${new URLSearchParams({view:'swimlanes',project:'a',paging:'lanes',sort})}`)).body;
  const normal=await read('default'), priority=await read('priority'), recent=await read('recent');
  assert.equal(normal.laneSort,'default');
  assert.notDeepEqual(normal.tickets.filter(t=>t.status==='completed').map(t=>t.id),priority.tickets.filter(t=>t.status==='completed').map(t=>t.id));
  assert.notDeepEqual(normal.tickets.filter(t=>t.status==='next').map(t=>t.id),recent.tickets.filter(t=>t.status==='next').map(t=>t.id));
  for(const sort of ['priority','recent'])assert.equal((await h.send(`/api/lane?${new URLSearchParams({view:'swimlanes',project:'a',status:'next',sort,cursor:normal.lanes[laneKey('a','next')].nextCursor})}`)).status,400);
  assert.equal((await h.send('/api/board?paging=lanes&sort=unknown')).status,400);
});
test('priority can be created and edited; invalid levels fail atomically and never replace the legacy rank', async () => {
  const h = fixture();
  const created = await h.send('/api/tickets', 'POST', {project: 'a', title: 'Critical task', priorityLevel: 'P0'});
  assert.equal(created.status, 201); assert.equal(created.body.priorityLevel, 'P0');
  assert.equal((await h.send('/api/tickets', 'POST', {project: 'a', title: 'Default task'})).body.priorityLevel, 'P2');
  const original = h.state.tickets[0], edited = await h.send(`/api/tickets/${original.id}`, 'PATCH', {revision: 1, priorityLevel: 'P3'});
  assert.equal(edited.status, 200); assert.equal(edited.body.priorityLevel, 'P3'); assert.equal(edited.body.priority, original.priority);
  const before = await h.store.read();
  for (const priorityLevel of ['P4', 'p0', 0, null, ['P0'], {}, 'toString']) {
    assert.equal((await h.send('/api/tickets', 'POST', {project: 'a', title: 'Invalid', priorityLevel})).status, 400);
    assert.equal((await h.send(`/api/tickets/${original.id}`, 'PATCH', {revision: 2, priorityLevel})).status, 400);
  }
  assert.deepEqual(await h.store.read(), before);
  assert.equal((await h.send(`/api/tickets/${original.id}`, 'PATCH', {revision: 1, priorityLevel: 'P0'})).status, 409);
});
test('old and invalid priority cursors fail explicitly instead of silently using an obsolete sort', async () => {
  const h = fixture(), first = (await h.send('/api/board?project=a&view=swimlanes&paging=lanes')).body;
  const value = JSON.parse(Buffer.from(first.lanes[laneKey('a', 'next')].nextCursor, 'base64url'));
  for (const level of [undefined, 'P9', 0]) {
    const cursor = Buffer.from(JSON.stringify({...value, priorityLevel: level})).toString('base64url');
    assert.equal((await h.send(`/api/lane?${new URLSearchParams({project: 'a', view: 'swimlanes', status: 'next', cursor})}`)).status, 400);
  }
  assert.match(sqlPriorityIndex, /WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P3' THEN 3 ELSE 2 END/);
});
test('import manifests accept explicit levels while omitted levels retain the exact old source hash shape', () => {
  const manifest = {version: 1, project: {name: 'Fixture', kind: 'app'}, source: {namespace: 'fixture'}, tickets: [{sourceId: 'OLD-1', title: 'Source', raw: 'Preserved text', priority: 28, status: 'next'}]};
  const old = importPlan(manifest); assert.equal(Object.hasOwn(old.tickets[0], 'priorityLevel'), false);
  const next = importPlan({...manifest, tickets: [{...manifest.tickets[0], priorityLevel: 'P1'}]}); assert.equal(next.tickets[0].priorityLevel, 'P1');
  assert.notEqual(old.hash, next.hash); assert.equal(old.hash, importPlan(manifest).hash);
  assert.throws(() => importPlan({...manifest, tickets: [{...manifest.tickets[0], priorityLevel: 1}]}), /Choose P0/);
});
