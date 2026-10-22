import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {application} from '../server.mjs';
import {configuration} from '../lib/config.mjs';
import {emptyState, fileStore, memoryStore} from '../lib/store.mjs';
import {hash, passwordAuth} from '../lib/auth.mjs';

async function harness(t, options = {}) {
  let timestamp = 1000000;
  const state = emptyState(), raw = 'test-session';
  const config = configuration({PLANNR_PASSWORD: 'test-only-workspace-password'});
  state.sessions.push({id: hash(raw), ownerId: config.ownerId, name: 'Workspace owner', authVersion: config.passwordDigest, expiresAt: timestamp + 8 * 3600000});
  const store = options.store || memoryStore(state);
  const server = createServer((...args) => handler(...args)); let handler;
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  config.origin = `http://127.0.0.1:${server.address().port}`;
  handler = application(store, config, {now: () => timestamp});
  t.after(async () => {server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await store.close();});
  const owner = {cookie: `plannr_session=${raw}`, Origin: config.origin, 'X-CSRF-Token': hash(`${raw}:csrf`)};
  async function send(path, method = 'GET', body, headers = owner) {
    const response = await fetch(config.origin + path, {method, headers: {'Content-Type': 'application/json', ...headers}, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual'});
    return {status: response.status, body: response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text(), headers: response.headers};
  }
  return {store, config, send, owner, advance: value => {timestamp += value;}};
}
const project = async h => (await h.send('/api/projects', 'POST', {name: 'Test app', kind: 'app', actor: 'Forged actor'})).body;
const ticket = async (h, p) => (await h.send('/api/tickets', 'POST', {project: p.id, title: 'Work item'})).body;

test('private shell is public, workspace is not; anonymous reads do not touch storage', async t => {
  const h = await harness(t), before = await h.store.read();
  assert.equal((await h.send('/api/state', 'GET', undefined, {})).status, 401);
  assert.equal((await h.send('/api/projects', 'POST', {name: 'Leak', kind: 'app'}, {})).status, 401);
  const session = await h.send('/api/session', 'GET', undefined, {}); assert.equal(session.body.user, null);
  assert.equal((await h.send('/', 'GET', undefined, {})).status, 200);
  assert.equal((await h.send('/.env')).status, 404);
  assert.equal((await h.send('/lib/auth.mjs')).status, 404);
  assert.deepEqual(await h.store.read(), before);
});
test('owner mutations require same origin and CSRF; caller actor is ignored', async t => {
  const h = await harness(t);
  assert.equal((await h.send('/api/projects', 'POST', {name: 'No CSRF', kind: 'app'}, {cookie: h.owner.cookie, Origin: h.config.origin})).status, 403);
  assert.equal((await h.send('/api/projects', 'POST', {name: 'Wrong origin', kind: 'app'}, {...h.owner, Origin: 'https://evil.example'})).status, 403);
  assert.equal((await h.send('/api/projects', 'POST', {name: 'No origin', kind: 'app'}, {cookie: h.owner.cookie, 'X-CSRF-Token': h.owner['X-CSRF-Token']})).status, 403);
  const p = await project(h); assert.ok(p.id);
  assert.equal((await h.store.read()).activity[0].actor, 'Workspace owner');
  assert.equal((await h.send('/api/state')).body.projects.length, 1);
  assert.doesNotMatch(JSON.stringify((await h.send('/api/state')).body), /tokenHash|test-session|test-secret/);
});
test('validation and audit are atomic; project identity survives archive/restore', async t => {
  const h = await harness(t), p = await project(h), work = await ticket(h, p), before = await h.store.read();
  assert.equal((await h.send(`/api/tickets/${work.id}`, 'PATCH', {revision: 1, status: 'completed', priority: -1})).status, 400);
  assert.deepEqual(await h.store.read(), before);
  assert.equal((await h.send(`/api/projects/${p.id}`, 'PATCH', {revision: 1, archived: true})).status, 200);
  assert.equal((await h.send(`/api/tickets/${work.id}/claim`, 'POST', {revision: 1})).status, 409);
  const restored = await h.send(`/api/projects/${p.id}`, 'PATCH', {revision: 2, archived: false, name: 'Renamed app'});
  assert.equal(restored.body.id, p.id); assert.equal((await h.send('/api/state')).body.tickets[0].project, p.id);
});
test('scoped agent can only access assigned projects; stored token is a hash', async t => {
  const h = await harness(t), p = await project(h), work = await ticket(h, p);
  const other = (await h.send('/api/projects', 'POST', {name: 'Other app', kind: 'app'})).body, hidden = await ticket(h, other);
  const issued = (await h.send('/api/agents', 'POST', {name: 'Builder', projects: [p.id]})).body;
  const headers = {Authorization: `Bearer ${issued.token}`};
  const state = (await h.send('/api/state', 'GET', undefined, headers)).body;
  assert.deepEqual(state.projects.map(row => row.id), [p.id]); assert.deepEqual(state.tickets.map(row => row.id), [work.id]);
  assert.equal((await h.send(`/api/tickets/${hidden.id}/claim`, 'POST', {revision: 1}, headers)).status, 404);
  assert.equal((await h.send('/api/projects', 'POST', {name: 'Forbidden', kind: 'app'}, headers)).status, 403);
  assert.equal((await h.send('/api/agents', 'GET', undefined, headers)).status, 403);
  assert.equal((await h.send('/api/agents', 'POST', {name: 'Forbidden', projects: [p.id]}, headers)).status, 403);
  assert.ok(!(JSON.stringify(await h.store.read()).includes(issued.token)));
  assert.equal((await h.send(`/api/agents/${issued.id}/revoke`, 'POST', {})).status, 200);
  assert.equal((await h.send('/api/state', 'GET', undefined, headers)).status, 401);
});
test('claims conflict, belong to authenticated agent, renew, release and expire', async t => {
  const h = await harness(t), p = await project(h), work = await ticket(h, p);
  const agents = await Promise.all(['First', 'Second'].map(async name => (await h.send('/api/agents', 'POST', {name, projects: [p.id]})).body));
  const headers = agents.map(agent => ({Authorization: `Bearer ${agent.token}`}));
  assert.equal((await h.send(`/api/tickets/${work.id}`, 'PATCH', {revision: 1, status: 'completed'}, headers[0])).status, 409);
  const claims = await Promise.all(headers.map(header => h.send(`/api/tickets/${work.id}/claim`, 'POST', {revision: 1, actor: 'Spoofed'}, header)));
  assert.deepEqual(claims.map(row => row.status).sort(), [200, 409]);
  const winner = claims.findIndex(row => row.status === 200), loser = 1 - winner;
  assert.equal(claims[winner].body.owner, agents[winner].name);
  assert.equal((await h.send(`/api/tickets/${work.id}/release`, 'POST', {revision: 2}, headers[loser])).status, 409);
  const renewed = await h.send(`/api/tickets/${work.id}/renew`, 'POST', {revision: 2}, headers[winner]); assert.equal(renewed.status, 200);
  const released = await h.send(`/api/tickets/${work.id}/release`, 'POST', {revision: 3}, headers[winner]); assert.equal(released.body.status, 'next');
  assert.equal((await h.send(`/api/tickets/${work.id}/claim`, 'POST', {revision: 4}, headers[loser])).status, 200);
  h.advance(300001);
  assert.equal((await h.send(`/api/tickets/${work.id}`, 'PATCH', {revision: 5, status: 'completed'}, headers[loser])).status, 409);
  assert.equal((await h.send(`/api/tickets/${work.id}/claim`, 'POST', {revision: 5}, headers[winner])).status, 200);
  h.advance(31 * 86400000);
  assert.equal((await h.send('/api/state', 'GET', undefined, headers[winner])).status, 401);
});
test('idempotent retries return original result even after later edits', async t => {
  const h = await harness(t), p = await project(h), work = await ticket(h, p);
  const headers = {...h.owner, 'Idempotency-Key': 'note-one'}, body = {revision: 1, comment: 'Once only'};
  const first = await h.send(`/api/tickets/${work.id}`, 'PATCH', body, headers);
  await h.send(`/api/tickets/${work.id}`, 'PATCH', {revision: 2, title: 'Later edit'});
  assert.deepEqual((await h.send(`/api/tickets/${work.id}`, 'PATCH', body, headers)).body, first.body);
  assert.equal((await h.send(`/api/tickets/${work.id}`, 'PATCH', {...body, comment: 'Different'}, headers)).status, 409);
  assert.equal((await h.send('/api/state')).body.tickets[0].comments.length, 1);
});
test('password login issues a fresh HttpOnly session; password and raw session are not stored', async t => {
  const h = await harness(t), headers = {Origin: h.config.origin};
  assert.equal((await h.send('/auth/login', 'POST', {password: 'wrong'}, headers)).status, 401);
  assert.equal((await h.send('/auth/login', 'POST', {password: 'test-only-workspace-password'}, {})).status, 403);
  const result = await h.send('/auth/login', 'POST', {password: 'test-only-workspace-password'}, headers);
  assert.equal(result.status, 200); assert.equal(result.body.signedIn, true);
  const cookie = result.headers.get('set-cookie'); assert.match(cookie, /HttpOnly; SameSite=Lax$/);
  assert.notEqual(cookie.split(';')[0], h.owner.cookie);
  assert.equal((await h.send('/api/state', 'GET', undefined, {cookie: cookie.split(';')[0]})).status, 200);
  const raw = cookie.split(';')[0].split('=')[1];
  assert.ok(!JSON.stringify(await h.store.read()).includes(raw));
  assert.doesNotMatch(JSON.stringify(await h.store.read()), /test-only-workspace-password/);
  assert.doesNotMatch(JSON.stringify((await h.send('/api/session')).body), /passwordDigest|authVersion/);
});
test('login limit persists across handlers and expires; forwarded IP cannot bypass it', async t => {
  const h = await harness(t), headers = {Origin: h.config.origin};
  for (let i = 0; i < 5; i++) assert.equal((await h.send('/auth/login', 'POST', {password: 'wrong'}, {...headers, 'X-Forwarded-For': `192.0.2.${i}`})).status, 401);
  const denied = await h.send('/auth/login', 'POST', {password: 'test-only-workspace-password'}, headers);
  assert.equal(denied.status, 429); assert.equal(denied.headers.get('retry-after'), '900');
  const another = passwordAuth(h.store, h.config, {now: () => 1000000});
  assert.equal((await another({password: 'test-only-workspace-password'}, {origin: h.config.origin}, '127.0.0.1')).status, 429);
  h.advance(900001);
  assert.equal((await h.send('/auth/login', 'POST', {password: 'test-only-workspace-password'}, headers)).status, 200);
});
test('password rotation revokes existing owner sessions', async t => {
  const h = await harness(t); h.config.passwordDigest = hash('rotated-password');
  assert.equal((await h.send('/api/state')).status, 401);
  assert.equal((await h.send('/api/session')).body.user, null);
});
test('logout revokes session server-side; expiry also rejects stale cookies', async t => {
  const h = await harness(t); assert.equal((await h.send('/api/session')).body.user.name, 'Workspace owner');
  assert.equal((await h.send('/auth/logout', 'POST', {})).status, 200);
  assert.equal((await h.send('/api/state')).status, 401); assert.equal((await h.send('/api/session')).body.user, null);
  const separate = await harness(t); separate.advance(8 * 3600000);
  assert.equal((await separate.send('/api/state')).status, 401);
});
test('local file persists across restart, rejects concurrent owners and rolls back failed writes', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'plannr-test-')), path = join(directory, 'workspace.json');
  t.after(() => rm(directory, {recursive: true, force: true}));
  let store = await fileStore(path);
  await store.transact(state => {state.projects.push({id: 'test', name: 'Persistent', kind: 'app', archived: false, revision: 1});});
  await assert.rejects(fileStore(path), /already locked/);
  await assert.rejects(store.transact(state => {state.counter = 999; throw Error('Abort');}));
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  await store.close(); store = await fileStore(path);
  assert.equal((await store.read()).projects[0].name, 'Persistent'); assert.equal((await store.read()).counter, 0);
  await store.close();
});
test('configuration prevents demo database use, production targeting and insecure hosting', () => {
  assert.throws(() => configuration({PLANNR_MODE: 'demo', DATABASE_URL: 'postgresql://example/db'}), /Demo mode/);
  assert.throws(() => configuration({DATABASE_URL: 'postgresql://example/db', PLANNR_DATABASE_BRANCH: 'production'}), /Production access/);
  assert.throws(() => configuration({DATABASE_URL: 'postgresql://wrong/db', PLANNR_DATABASE_BRANCH: 'development', PLANNR_DATABASE_HOST: 'expected'}), /development database host/);
  assert.throws(() => configuration({PLANNR_ORIGIN: 'http://public.example'}), /HTTPS/);
  assert.throws(() => configuration({PLANNR_ORIGIN: 'https://public.example'}), /fully configured/);
  assert.throws(() => configuration({PLANNR_PASSWORD: 'short'}), /between 16 and 256/);
});
test('credential issuance is single-use on retry, including its secret', async t => {
  const h = await harness(t), p = await project(h), headers = {...h.owner, 'Idempotency-Key': 'issue-once'}, body = {name: 'Once', projects: [p.id]};
  const first = await h.send('/api/agents', 'POST', body, headers); assert.equal(first.status, 201);
  assert.equal((await h.send('/api/agents', 'POST', body, headers)).status, 409);
  assert.equal((await h.store.read()).agents.length, 1);
  assert.ok(!JSON.stringify(await h.store.read()).includes(first.body.token));
});
test('global login budget is shared by distinct addresses and bounded', async () => {
  const store = memoryStore(), config = configuration({PLANNR_PASSWORD: 'test-only-workspace-password'}), login = passwordAuth(store, config, {now: () => 1000000});
  for (let i = 0; i < 50; i++) assert.equal((await login({password: 'wrong'}, {origin: config.origin}, `192.0.2.${i}`)).status, 401);
  assert.equal((await login({password: 'test-only-workspace-password'}, {origin: config.origin}, '192.0.2.100')).status, 429);
  assert.equal((await store.read()).attempts.length, 51); await store.close();
});
test('malformed, oversized and wrong-content-type login requests fail closed', async t => {
  const h = await harness(t);
  assert.equal((await h.send('/auth/login', 'POST', {password: 123}, {Origin: h.config.origin})).status, 400);
  assert.equal((await h.send('/auth/login', 'POST', {password: 'x'.repeat(13000)}, {Origin: h.config.origin})).status, 413);
  assert.equal((await h.send('/auth/login', 'POST', {password: 'test-only-workspace-password'}, {Origin: h.config.origin, 'Content-Type': 'text/plain'})).status, 415);
});
test('persistence failure leaves prior data and audit untouched', async () => {
  const state = emptyState(); state.counter = 7;
  const store = memoryStore(state, async () => {throw Error('Disk unavailable');});
  await assert.rejects(store.transact(next => {next.counter = 8; next.activity.push({id: 'failed'});}));
  assert.deepEqual(await store.read(), state); await store.close();
});
test('anonymous session checks do not invoke storage at all', async t => {
  const h = await harness(t, {store: {read: () => {throw Error('Credential-bearing internal failure');}, close: async () => {}}});
  assert.equal((await h.send('/api/session', 'GET', undefined, {})).status, 200);
  assert.equal((await h.send('/api/state', 'GET', undefined, {})).status, 401);
  const response = await h.send('/api/state'); assert.equal(response.status, 503);
  assert.doesNotMatch(JSON.stringify(response.body), /Credential-bearing/);
});
test('checklist edits are revisioned, audited, idempotent and independent of ticket status',async t=>{
 const h=await harness(t),p=await project(h),work=await ticket(h,p),path=`/api/tickets/${work.id}`;
 assert.deepEqual(work.checklist,[]);
 const patch={revision:1,checklistChanges:[{action:'add',text:'Review geometry'},{action:'add',text:'Player review'}]},headers={...h.owner,'Idempotency-Key':'checklist-once'};
 const added=await h.send(path,'PATCH',patch,headers);assert.equal(added.status,200);assert.equal(added.body.checklist.length,2);
 assert.deepEqual((await h.send(path,'PATCH',patch,headers)).body,added.body);
 let row=added.body;const id=row.checklist[0].id;
 row=(await h.send(path,'PATCH',{revision:row.revision,checklistChanges:row.checklist.map(item=>({action:'update',id:item.id,completed:true}))})).body;
 assert.equal(row.status,'next');assert.equal(row.completedAt,undefined);assert.equal(row.ownerId,null);
 const before=await h.store.read();
 assert.equal((await h.send(path,'PATCH',{revision:row.revision,status:'completed',checklistChanges:[{action:'update',id,completed:'yes'}]})).status,400);
 assert.deepEqual(await h.store.read(),before);
 assert.equal((await h.send(path,'PATCH',{revision:1,checklistChanges:[{action:'remove',id}]})).status,409);
 assert.equal((await h.send(path,'PATCH',{revision:row.revision,checklistChanges:[{action:'remove',id}]},{cookie:h.owner.cookie,Origin:h.config.origin})).status,403);
 const board=(await h.send('/api/board?view=swimlanes&paging=lanes')).body;
 assert.deepEqual(board.tickets.find(ticket=>ticket.id===row.id).checklist,row.checklist);
 assert.equal((await h.store.read()).activity[0].action,'updated ticket checklist');
});
test('checklist agents must have project scope and an unexpired claim',async t=>{
 const h=await harness(t),p=await project(h),work=await ticket(h,p),other=(await h.send('/api/projects','POST',{name:'Other',kind:'app'})).body,hidden=await ticket(h,other);
 const agent=(await h.send('/api/agents','POST',{name:'Checklist builder',projects:[p.id]})).body,headers={Authorization:`Bearer ${agent.token}`};
 const send=(row,revision)=>h.send(`/api/tickets/${row.id}`,'PATCH',{revision,checklistChanges:[{action:'add',text:'Verified step'}]},headers);
 assert.equal((await send(hidden,1)).status,404);assert.equal((await send(work,1)).status,409);
 assert.equal((await h.send(`/api/tickets/${work.id}/claim`,'POST',{revision:1},headers)).status,200);
 assert.equal((await send(work,2)).status,200);h.advance(300001);assert.equal((await send(work,3)).status,409);
});
test('HTTP accepts a bounded full checklist batch, preserves normal request limits and persists across file reload',async t=>{
 const h=await harness(t),p=await project(h),work=await ticket(h,p);
 const changes=Array.from({length:100},(_,i)=>({action:'add',id:`step-${i}`,text:'Review '.repeat(40)}));
 const response=await h.send(`/api/tickets/${work.id}`,'PATCH',{revision:1,checklistChanges:changes});
 assert.equal(response.status,200);assert.equal(response.body.checklist.length,100);
 assert.equal((await h.send('/api/projects','POST',{name:'Too large',kind:'app',extra:'x'.repeat(13000)})).status,413);
 assert.equal((await h.send(`/api/tickets/${work.id}`,'PATCH',{revision:2,extra:'x'.repeat(262145)})).status,413);
 const dir=await mkdtemp(join(tmpdir(),'plannr-checklist-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 let disk=await fileStore(join(dir,'state.json'),await h.store.read());await disk.transact(()=>{});await disk.close();disk=await fileStore(join(dir,'state.json'),emptyState());
 assert.deepEqual((await disk.read()).tickets[0].checklist,response.body.checklist);await disk.close();
});
