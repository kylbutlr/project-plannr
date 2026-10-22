import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apiApplication} from '../lib/api.mjs';
import {configuration} from '../lib/config.mjs';
import {emptyState, memoryStore, postgresStore} from '../lib/store.mjs';
import {hash} from '../lib/auth.mjs';

function fixture() {
  const state = emptyState();
  state.projects = [{id: 'app', name: 'Test app', kind: 'app', revision: 1, archived: false},
    {id: 'hidden', name: 'Other app', kind: 'app', revision: 1, archived: false}];
  state.tickets = Array.from({length: 46}, (_, i) => ({id: `PLNR-${i + 1}`, project: 'app', title: `Completed ${i + 1}`,
    description: i === 0 ? 'Needle in old history' : '', status: 'completed', revision: 1, priority: i + 1,
    completedAt: new Date(1000000 + i * 1000).toISOString(), comments: [], ownerId: null, leaseUntil: 0}));
  state.tickets.push({...state.tickets[0], id: 'PLNR-47', status: 'next', completedAt: null},
    {...state.tickets[0], id: 'HIDDEN', project: 'hidden'});
  return state;
}
function api(state = fixture(), config = configuration({PLANNR_MODE: 'demo'})) {
  const store = memoryStore(state), handle = apiApplication(store, config, {now: () => 2000000});
  return {store, send: (url, method = 'GET', body, headers = {}) => {const u = new URL(url, config.origin);
    return handle({path: u.pathname, query: u.searchParams, method, headers, body: async () => body});}};
}
test('board reads only 20 completed tickets; cursor pages cover all history without duplicates', async () => {
  const h = api(), first = await h.send('/api/board?project=app');
  assert.equal(first.status, 200); assert.equal(first.body.completed.total, 46);
  assert.equal(first.body.tickets.length, 21); assert.equal(first.body.projects[0].ticketCount, 47);
  let cursor = first.body.completed.nextCursor, ids = first.body.tickets.filter(t => t.status === 'completed').map(t => t.id);
  assert.equal(ids[0], 'PLNR-46');
  while (cursor) {const page = await h.send(`/api/completed?project=app&cursor=${cursor}`);
    assert.equal(page.status, 200); assert.ok(page.body.tickets.length <= 20);
    ids.push(...page.body.tickets.map(t => t.id)); cursor = page.body.nextCursor;}
  assert.equal(ids.length, 46); assert.equal(new Set(ids).size, 46); assert.equal(ids.at(-1), 'PLNR-1');
  assert.equal((await h.send('/api/state')).body.tickets.length, 48, 'legacy agent API stays complete');
});
test('search reaches old completed pages and matches ID, title and description literally', async () => {
  const h = api();
  for (const search of ['Needle', 'PLNR-1', 'Completed 1']) {
    const result = await h.send(`/api/board?project=app&q=${encodeURIComponent(search)}`);
    assert.equal(result.status, 200); assert.ok(result.body.tickets.some(t => t.id === 'PLNR-1'));
    assert.ok(result.body.tickets.some(t => t.status === 'next'), 'completed search does not hide active work');
  }
  assert.equal((await h.send('/api/completed?project=app&q=%25')).body.total, 0);
  assert.equal((await h.send('/api/completed?q=' + 'x'.repeat(121))).status, 400);
});
test('completed cursors reject malformed or changed filters; archive removes a project from board history', async () => {
  const h = api(), first = (await h.send('/api/board?project=app')).body;
  assert.equal((await h.send('/api/completed?cursor=invalid')).status, 400);
  assert.equal((await h.send(`/api/completed?project=app&q=changed&cursor=${first.completed.nextCursor}`)).status, 400);
  await h.send('/api/projects/app', 'PATCH', {revision: 1, archived: true});
  assert.equal((await h.send('/api/completed?project=app')).status, 404);
  assert.equal((await h.send('/api/board')).body.completed.total, 1);
});
test('new board, history and single-ticket endpoints enforce sign-in and agent scope', async () => {
  const state = fixture(), token = `plnr_${'a'.repeat(43)}`, config = configuration({PLANNR_PASSWORD: 'test-only-password'});
  state.agents.push({id: 'agent', name: 'Agent', projects: ['app'], tokenHash: hash(token), expiresAt: 99999999, revoked: false});
  const h = api(state, config), headers = {authorization: `Bearer ${token}`};
  for (const path of ['/api/board', '/api/completed', '/api/tickets/PLNR-1']) assert.equal((await h.send(path)).status, 401);
  assert.equal((await h.send('/api/board?project=hidden', 'GET', undefined, headers)).status, 404);
  assert.equal((await h.send('/api/tickets/HIDDEN', 'GET', undefined, headers)).status, 404);
  const page = (await h.send('/api/board', 'GET', undefined, headers)).body;
  assert.equal(page.projects.length, 1); assert.equal(page.completed.total, 46);
  assert.equal((await h.send('/api/tickets/PLNR-1', 'GET', undefined, headers)).body.title, 'Completed 1');
  assert.doesNotMatch(JSON.stringify(page), /tokenHash|aaaaaaaa/);
});
test('completion time survives title edits and unchanged status, and resets on reopen', async () => {
  const h = api(), row = (await h.send('/api/tickets/PLNR-47', 'PATCH', {revision: 1, status: 'completed'})).body;
  assert.equal(row.completedAt, new Date(2000000).toISOString());
  const edited = (await h.send('/api/tickets/PLNR-47', 'PATCH', {revision: 2, title: 'Edited', status: 'completed'})).body;
  assert.equal(edited.completedAt, row.completedAt);
  assert.equal((await h.send('/api/tickets/PLNR-47', 'PATCH', {revision: 3, status: 'next'})).body.completedAt, null);
});
test('Postgres board adapter uses bounded, scoped SQL rather than full ticket snapshots', async () => {
  const queries = [], state = fixture();
  const client = {release() {}, async query(sql, params) {
    queries.push({sql, params});
    if (sql.includes("kind IN ('project','agent','session')")) return {rows: state.projects.map(data => ({kind: 'project', data}))};
    if (sql.includes('LIMIT 21')) {assert.deepEqual(params[0], ['app']);return {rows: state.tickets.slice(25, 46).reverse().map(data => ({data}))};}
    if (sql.includes('GROUP BY project_id')) return {rows: [{project_id: 'app', total: 47}]};
    if (sql.includes('count(*)')) return {rows: [{total: 46}]};
    if (sql.includes("!='completed'")) return {rows: [{data: state.tickets[46]}]};
    return {rows: []};
  }};
  const pool = {on() {}, connect: async () => client, end: async () => {}};
  const store = postgresStore('postgresql://unused.local/test', {pool});
  const handle = apiApplication(store, configuration({PLANNR_MODE: 'demo'}));
  const result = await handle({path: '/api/board', query: new URLSearchParams({project: 'app'}), method: 'GET', headers: {}});
  assert.equal(result.status, 200); assert.equal(result.body.tickets.length, 21); assert.equal(result.body.completed.total, 46);
  assert.ok(queries.some(q => q.sql.includes('REPEATABLE READ READ ONLY')));
  assert.ok(queries.some(q => q.sql.includes('COLLATE "C"')));
  assert.ok(!queries.some(q => q.sql === 'SELECT kind, data FROM project_plannr.entities ORDER BY id'));
  await store.close();
});

function swimlaneFixture() {
  const state = fixture();
  state.tickets.push(...Array.from({length: 35}, (_, i) => ({...state.tickets[i], id: `OTHER-${i}`, project: 'hidden',
    completedAt: new Date(5000000 + i * 1000).toISOString()})));
  return state;
}
test('swimlanes give every project its own 20-ticket page, total, and project-bound cursor', async () => {
  const h=api(swimlaneFixture()), first=(await h.send('/api/board?view=swimlanes')).body;
  assert.equal(first.completed, undefined);
  for(const [project,total] of [['app',46],['hidden',36]]) {
    assert.equal(first.tickets.filter(t=>t.project===project&&t.status==='completed').length,20);
    assert.equal(first.completedByProject[project].total,total);
    assert.ok(first.completedByProject[project].nextCursor);
  }
  const cursor=first.completedByProject.app.nextCursor;
  const next=(await h.send(`/api/completed?project=app&cursor=${cursor}`)).body;
  assert.equal(next.tickets.length,20);assert.ok(next.tickets.every(t=>t.project==='app'));
  assert.equal((await h.send(`/api/completed?project=hidden&cursor=${cursor}`)).status,400);
  const combined=(await h.send('/api/board?view=kanban')).body;
  assert.equal(combined.tickets.filter(t=>t.status==='completed').length,20);
  assert.equal(combined.completed.total,82);assert.equal(combined.completedByProject,undefined);
});
test('swimlane search, project filters and agent authorization apply to each history independently', async () => {
  const h=api(swimlaneFixture());
  const search=(await h.send('/api/board?view=swimlanes&q=Needle')).body;
  assert.equal(search.completedByProject.app.total,1);assert.equal(search.completedByProject.hidden.total,2);
  const filtered=(await h.send('/api/board?view=swimlanes&project=app')).body;
  assert.deepEqual(Object.keys(filtered.completedByProject),['app']);
  const state=swimlaneFixture(),token=`plnr_${'b'.repeat(43)}`;
  state.agents.push({id:'pilot',name:'Pilot',projects:['app'],tokenHash:hash(token),expiresAt:99999999,revoked:false});
  const scoped=api(state,configuration({PLANNR_PASSWORD:'test-only-password'}));
  const result=(await scoped.send('/api/board?view=swimlanes','GET',undefined,{authorization:`Bearer ${token}`})).body;
  assert.deepEqual(Object.keys(result.completedByProject),['app']);assert.ok(result.tickets.every(t=>t.project==='app'));
});
test('Postgres swimlanes partition completed history in one bounded query, including empty projects', async () => {
  const queries=[],state=swimlaneFixture();state.projects.push({id:'empty',name:'Empty',kind:'app',archived:false,revision:1});
  const client={release(){},async query(sql,params){
    queries.push({sql,params});
    if(sql.includes("kind IN ('project','agent','session')"))return {rows:state.projects.map(data=>({kind:'project',data}))};
    if(sql.includes('WITH ranked'))return {rows:['app','hidden'].flatMap(id=>state.tickets.filter(t=>t.project===id&&t.status==='completed').sort((a,b)=>b.completedAt.localeCompare(a.completedAt)).slice(0,21).map(data=>({project_id:id,data,total:id==='app'?46:36})))};
    return {rows:[]};
  }};
  const store=postgresStore('postgresql://unused.local/test',{pool:{on(){},connect:async()=>client,end:async()=>{}}});
  const handle=apiApplication(store,configuration({PLANNR_MODE:'demo'}));
  const result=await handle({path:'/api/board',query:new URLSearchParams({view:'swimlanes'}),method:'GET',headers:{}});
  assert.equal(result.status,200);assert.equal(result.body.tickets.length,40);
  assert.equal(result.body.completedByProject.empty.total,0);assert.equal(result.body.completedByProject.empty.nextCursor,null);
  const history=queries.filter(q=>q.sql.includes('WITH ranked'));assert.equal(history.length,1);
  assert.match(history[0].sql,/PARTITION BY project_id/);assert.match(history[0].sql,/page_rank<=21/);
  assert.deepEqual(history[0].params,[['app','hidden','empty'],'']);
  await store.close();
});
