import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, mkdir, stat, chmod, symlink, readdir, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {emptyState, memoryStore} from '../lib/store.mjs';
import {configuration} from '../lib/config.mjs';
import {apiApplication, bodyJSON} from '../lib/api.mjs';
import {hash} from '../lib/auth.mjs';
import {application} from '../server.mjs';
import {netlifyApplication} from '../netlify/functions/workspace.mjs';
import {importPlan, previewImport, applyImport} from '../lib/project-import.mjs';
import {onboardingArgs, onboardingSource, onboardingRun} from '../scripts/onboard-project.mjs';
import {planningAccess, planningRun} from '../lib/planning-client.mjs';

const exec = promisify(execFile), password = 'fixture-only-owner-password';
const fixture = (kind = 'app', name = 'Calendar fixture') => ({version: 1, project: {name, kind}, source: {namespace: 'roadmap-v1', url: 'https://example.com/source'}, tickets: [
  {sourceId: 'APP-1', title: 'Next fixture', raw: 'Original first requirement.', status: 'next', priority: 1, legacyStatus: 'Idea'},
  {sourceId: 'APP-2', title: 'Ongoing fixture', raw: 'Original ongoing requirement.', description: 'Keep working.', notes: ['Evidence retained'], status: 'in-progress', priority: 2},
  {sourceId: 'APP-3', title: 'Historical fixture', raw: 'Recorded as done, not newly tested.', status: 'completed', priority: 3},
]});
const actor = {id: 'owner', name: 'Workspace owner', owner: true};

test('any game, app or other project imports atomically with recorded statuses and lossless source', async () => {
  const store = memoryStore();
  for (const kind of ['game', 'app', 'other']) {
    const plan = importPlan(fixture(kind, `Fixture ${kind}`));
    const preview = previewImport(await store.read(), plan);
    const result = await store.transact(state => applyImport(state, plan, preview.expectedState, actor, 1000, 'private'));
    assert.equal(result.created, 3); assert.equal(result.project.kind, kind);
    const tickets = (await store.read()).tickets.filter(row => row.project === result.project.id);
    assert.deepEqual(tickets.map(row => row.status), ['next', 'in-progress', 'completed']);
    assert.ok(tickets.every(row => row.completedAt === null && row.ownerId === null));
    assert.equal(tickets[1].comments[0].text, 'Evidence retained');
    assert.equal(tickets[0].importSource.raw, plan.tickets[0].raw);
  }
  assert.equal((await store.read()).counter, 9);
});

test('replay preserves owner edits, other projects, priorities and audit; changed source never overwrites', async () => {
  const store = memoryStore(), plan = importPlan(fixture());
  let preview = previewImport(await store.read(), plan);
  const result = await store.transact(state => applyImport(state, plan, preview.expectedState, actor, 1000, 'private'));
  await store.transact(state => {
    Object.assign(state.tickets[0], {title: 'Owner changed this', status: 'completed', revision: 7, priority: 9});
    state.projects.push({id: 'other', name: 'Other', kind: 'game'});
    state.tickets.push({id: 'OTHER-1', project: 'other', title: 'Unrelated', revision: 20});
  });
  const before = await store.read(); preview = previewImport(before, plan);
  assert.equal(preview.preserveTickets, 3);
  await store.transact(state => applyImport(state, plan, preview.expectedState, actor, 2000, 'private'));
  assert.deepEqual(await store.read(), before);
  for (const change of [{raw: 'Changed'}, {title: 'Changed'}, {status: 'completed'}, {priority: 7}, {notes: ['Changed']}]) {
    const manifest = fixture(); Object.assign(manifest.tickets[0], change);
    assert.throws(() => previewImport(before, importPlan(manifest)), /changed or is duplicated/);
  }
  const renamed = structuredClone(before); renamed.projects[0].name = 'Renamed';
  const manifest = fixture('app', 'Renamed'); manifest.project.id = result.project.id;
  assert.equal(previewImport(renamed, importPlan(manifest)).preserveTickets, 3);
});

test('validate all tickets, detect existing title collisions, archived/type mismatch and concurrent edits', async () => {
  const manifest = fixture(); manifest.tickets.push({...manifest.tickets[0]});
  assert.throws(() => importPlan(manifest), /unique stable/);
  for (const mutate of [m => m.tickets[0].status = 'Done', m => m.project.kind = 'store', m => m.tickets[0].priority = -1,
    m => m.source.url = 'https://user:password@example.com/', m => m.source.files = ['../secret'], m => m.tickets[0].raw = '']) {
    const value = fixture(); mutate(value); assert.throws(() => importPlan(value));
  }
  const state = emptyState(), plan = importPlan(fixture());
  state.projects.push({id: 'project', name: plan.project.name, kind: 'app', archived: false, revision: 1});
  const preview = previewImport(state, plan);
  state.projects[0].revision++;
  assert.throws(() => applyImport(state, plan, preview.expectedState, actor, 1000, 'private'), /changed since preview/);
  state.tickets.push({id: 'existing', project: 'project', title: 'Next fixture'});
  assert.throws(() => previewImport(state, plan), /existing title/);
  state.tickets = []; state.projects[0].archived = true; assert.throws(() => previewImport(state, plan), /archived/);
  state.projects[0].archived = false; state.projects[0].kind = 'game'; assert.throws(() => previewImport(state, plan), /type differs/);
});

test('persistence failure rolls project, tickets, IDs and audit back together', async () => {
  const state = emptyState(), store = memoryStore(state, async () => {throw Error('fixture disk failure');}), plan = importPlan(fixture());
  await assert.rejects(store.transact(data => applyImport(data, plan, previewImport(data, plan).expectedState, actor, 1, 'private')));
  assert.deepEqual(await store.read(), state);
});

test('long source becomes readable note chunks without losing raw text', () => {
  const manifest = fixture(); manifest.tickets[0].raw = 'A'.repeat(9000);
  const plan = importPlan(manifest);
  assert.equal(plan.tickets[0].notes.join(''), manifest.tickets[0].raw);
  assert.ok(plan.tickets[0].notes.every(text => text.length <= 1800));
});

async function ownerAPI(store) {
  const config = configuration({PLANNR_PASSWORD: password}), app = apiApplication(store, config);
  const login = await app({path: '/auth/login', method: 'POST', headers: {origin: config.origin}, body: async () => ({password}), ip: 'fixture'});
  const cookie = login.headers['Set-Cookie'].split(';')[0];
  const session = await app({path: '/api/session', method: 'GET', headers: {cookie}});
  return {app, headers: {cookie, origin: config.origin, 'x-csrf-token': session.body.csrf}};
}

test('private API requires owner, exact origin and CSRF before reading a large import body', async () => {
  const state = emptyState(), token = `plnr_${'e'.repeat(43)}`;
  state.agents.push({id: 'agent', name: 'Fixture agent', projects: [], tokenHash: hash(token), expiresAt: Date.now() + 999999, revoked: false});
  const store = memoryStore(state), {app, headers} = await ownerAPI(store);
  const send = (headers, path = '/api/imports/preview', body = {manifest: fixture()}) => app({path, method: 'POST', headers, body: async () => body});
  let reads = 0;
  assert.equal((await app({path: '/api/imports/apply', method: 'POST', headers: {authorization: `Bearer ${token}`}, body: async () => {reads++;}})).status, 403);
  assert.equal(reads, 0);
  assert.equal((await send({})).status, 401);
  assert.equal((await send({...headers, origin: 'https://wrong.example'})).status, 403);
  assert.equal((await send({...headers, 'x-csrf-token': 'wrong'})).status, 403);
  const preview = await send(headers); assert.equal(preview.status, 200);
  assert.equal((await store.read()).projects.length, 0);
  const payload = {manifest: fixture(), expectedState: preview.body.expectedState};
  const applied = await send({...headers, 'idempotency-key': 'fixture-import'}, '/api/imports/apply', payload);
  const saved = await store.read();
  assert.deepEqual((await send({...headers, 'idempotency-key': 'fixture-import'}, '/api/imports/apply', payload)).body, applied.body);
  assert.deepEqual(await store.read(), saved);
});

test('request limit stays 12KB normally, import body has an explicit bounded allowance', async () => {
  const body = Buffer.from(JSON.stringify({large: 'A'.repeat(15000)}));
  await assert.rejects(bodyJSON([body], {'content-type': 'application/json'}), /Request too large/);
  assert.equal((await bodyJSON([body], {'content-type': 'application/json'}, 524288)).large.length, 15000);
  await assert.rejects(bodyJSON([Buffer.alloc(524289)], {'content-type': 'application/json'}, 524288), /Request too large/);
});

async function repoFixture() {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'plannr-onboarding-'))), repo = join(directory, 'app');
  await mkdir(repo);
  const git = async args => (await exec('git', ['-C', repo, ...args], {env: {...process.env, GIT_AUTHOR_NAME: 'Kyle Butler', GIT_AUTHOR_EMAIL: 'kyle@sdg.la', GIT_COMMITTER_NAME: 'Kyle Butler', GIT_COMMITTER_EMAIL: 'kyle@sdg.la'}})).stdout.trim();
  await git(['init', '--quiet']); await writeFile(join(repo, '.gitignore'), '.plannr/\n'); await writeFile(join(repo, 'roadmap.md'), 'Fixture source ledger\n');
  await git(['add', '.gitignore', 'roadmap.md']);
  for (const variable of ['GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT']) assert.match(await git(['var', variable]), /^Kyle Butler <kyle@sdg.la> /);
  await git(['commit', '-qm', 'Disposable fixture']);
  const manifest = fixture(); manifest.source.revision = await git(['rev-parse', 'HEAD']); manifest.source.files = ['roadmap.md'];
  const path = join(directory, 'manifest.json'); await writeFile(path, JSON.stringify(manifest));
  return {directory, repo, path, manifest, git};
}

test('offline preview verifies committed files and makes zero network requests', async () => {
  const fixture = await repoFixture(), options = onboardingArgs(['--repo', fixture.repo, '--manifest', fixture.path]);
  assert.throws(() => onboardingArgs(['--repo', fixture.repo, '--manifest', fixture.path, '--issue-agent']));
  const result = await onboardingRun(options, {fetcher: () => {throw Error('Must not fetch');}});
  assert.equal(result.mode, 'offline preview'); assert.equal(result.items.length, 3);
  assert.deepEqual(result.sourceFilesVerified, ['roadmap.md']);
  assert.equal((await readdir(fixture.repo)).includes('.plannr'), false);
  const entry = fileURLToPath(new URL('../scripts/onboard-project.mjs', import.meta.url));
  const cli = await exec(process.execPath, [entry, '--repo', fixture.repo, '--manifest', fixture.path], {env: {...process.env, PLANNR_PASSWORD: ''}});
  assert.equal(JSON.parse(cli.stdout).mode, 'offline preview');
  assert.equal(JSON.parse(cli.stdout).items.length, 3);
  assert.match((await exec(process.execPath, [entry, '--help'])).stdout, /Default: offline preview/);
  await writeFile(join(fixture.repo, 'roadmap.md'), 'Uncommitted changes');
  await assert.rejects(onboardingSource(options), /committed snapshot/);
});

test('actual CLI imports via owner password, verifies receipts, grants scoped access, and generic roadmap reads it', async t => {
  const fixture = await repoFixture(), state = emptyState(), store = memoryStore(state), config = configuration({PLANNR_PASSWORD: password});
  const server = createServer(application(store, config)); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  config.origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));});
  const options = onboardingArgs(['--repo', fixture.repo, '--manifest', fixture.path, '--origin', config.origin, '--apply', '--issue-agent']);
  const backupRoot = join(fixture.directory, 'backups');
  const result = await onboardingRun(options, {password, backupRoot});
  assert.equal(result.created, 3); assert.equal(result.preserved, 0); assert.ok(result.agentId);
  assert.equal((await stat(result.credentialFile)).mode & 0o777, 0o600);
  assert.equal((await stat(join(fixture.repo, '.plannr'))).mode & 0o777, 0o700);
  for (const file of await readdir(result.backup)) assert.equal((await stat(join(result.backup, file))).mode & 0o777, 0o600);
  const access = await planningAccess(result.credentialFile);
  assert.ok(!JSON.stringify(result).includes(access.token));
  assert.ok(!(await readFile(join(result.backup, 'receipt.json'), 'utf8')).includes(access.token));
  assert.deepEqual(access.projects, [result.projectId]);
  assert.equal((await store.read()).sessions.length, 0, 'setup signs out its own session');
  const roadmap = fileURLToPath(new URL('../scripts/roadmap.mjs', import.meta.url));
  const output = await exec(process.execPath, [roadmap, '--repo', fixture.repo, 'backlog']);
  assert.equal(JSON.parse(output.stdout).tickets.length, 1);
  assert.ok(!output.stdout.includes(access.token));
  const board = await planningRun(['board'], result.credentialFile); assert.equal(board.projects[0].id, result.projectId);
  await assert.rejects(planningRun(['move', 'PLNR-1', '1', 'completed'], result.credentialFile), /Completion requires owner review/);
  let checklistTicket=board.tickets.find(ticket=>ticket.status==='next');
  checklistTicket=await planningRun(['claim',checklistTicket.id,String(checklistTicket.revision)],result.credentialFile);
  checklistTicket=await planningRun(['checklist-add',checklistTicket.id,String(checklistTicket.revision),'Record owner review'],result.credentialFile);
  const checklistId=checklistTicket.checklist[0].id;
  checklistTicket=await planningRun(['checklist-edit',checklistTicket.id,String(checklistTicket.revision),checklistId,'Owner review evidence'],result.credentialFile);
  checklistTicket=await planningRun(['checklist-check',checklistTicket.id,String(checklistTicket.revision),checklistId],result.credentialFile);
  assert.equal(checklistTicket.checklist[0].completed,true);assert.equal(checklistTicket.status,'in-progress');
  checklistTicket=await planningRun(['checklist-uncheck',checklistTicket.id,String(checklistTicket.revision),checklistId],result.credentialFile);
  assert.equal(checklistTicket.checklist[0].completed,false);
  checklistTicket=await planningRun(['checklist-remove',checklistTicket.id,String(checklistTicket.revision),checklistId],result.credentialFile);
  assert.deepEqual(checklistTicket.checklist,[]);

  const before = await store.read();
  await assert.rejects(onboardingRun(options, {password, backupRoot}));
  assert.deepEqual(await store.read(), before, 'existing credentials are never overwritten or reissued');
  options.issueAgent = false;
  const replay = await onboardingRun(options, {password, backupRoot}); assert.equal(replay.created, 0); assert.equal(replay.preserved, 3);
  assert.equal((await store.read()).agents.length, 1);
  assert.equal(await readFile(join(fixture.repo, 'roadmap.md'), 'utf8'), 'Fixture source ledger\n');
});

test('passwordless loopback onboarding imports and grants scoped access without login', async t => {
  const fixture = await repoFixture(), store = memoryStore();
  const config = configuration({PLANNR_AUTH_MODE: 'none'});
  const server = createServer(application(store, config)); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  config.origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));});
  const options = onboardingArgs(['--repo', fixture.repo, '--manifest', fixture.path, '--origin', config.origin, '--apply', '--issue-agent']);
  const result = await onboardingRun(options, {password: undefined, backupRoot: join(fixture.directory, 'backups'), fetcher: (url, options) => {
    assert.ok(!url.includes('/auth/'), 'local access does not create or destroy a password session');
    return fetch(url, options);
  }});
  assert.equal(result.created, 3);
  const access = await planningAccess(result.credentialFile);
  assert.deepEqual(access.projects, [result.projectId]);
  assert.equal((await store.read()).sessions.length, 0);
  assert.equal((await planningRun(['board'], result.credentialFile)).projects[0].id, result.projectId);
});

test('access rejects symlinks, public permissions, expiry and multi-project credentials', async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'plannr-access-'))), file = join(dir, 'agent.json');
  const value = {origin: 'https://example.com', projects: ['app'], token: `plnr_${'a'.repeat(43)}`, expiresAt: Date.now() + 100000};
  await writeFile(file, JSON.stringify(value), {mode: 0o600}); await planningAccess(file);
  await chmod(file, 0o644); await assert.rejects(planningAccess(file)); await chmod(file, 0o600);
  await symlink(file, join(dir, 'link')); await assert.rejects(planningAccess(join(dir, 'link')));
  for (const change of [{expiresAt: 1}, {projects: ['app', 'game']}, {origin: 'http://example.com'}]) {
    await writeFile(file, JSON.stringify({...value, ...change})); await assert.rejects(planningAccess(file));
  }
});

test('lost issuance response revokes only this operation grant, preserves imported tickets and leaves no usable secret', async () => {
  const fixture = await repoFixture(), store = memoryStore(), config = configuration({PLANNR_PASSWORD: password});
  const app = apiApplication(store, config);
  let lost = false;
  const fetcher = async (url, options) => {
    const headers = Object.fromEntries(Object.entries(options.headers).map(([key, value]) => [key.toLowerCase(), value]));
    const path = new URL(url).pathname;
    const result = await app({path, method: options.method, headers, body: async () => options.body ? JSON.parse(options.body) : {}, ip: 'fixture'});
    if (path === '/api/agents' && options.method === 'POST' && result.status === 201) {lost = true; throw Error('Fixture connection lost after issuance');}
    return Response.json(result.body, {status: result.status, headers: result.headers});
  };
  const options = onboardingArgs(['--repo', fixture.repo, '--manifest', fixture.path, '--origin', config.origin, '--apply', '--issue-agent']);
  await assert.rejects(onboardingRun(options, {password, fetcher, backupRoot: join(fixture.directory, 'backups')}));
  const data = await store.read();
  assert.equal(lost, true); assert.equal(data.tickets.length, 3);
  assert.equal(data.agents.length, 1); assert.equal(data.agents[0].revoked, true);
  assert.equal(data.sessions.length, 0);
  assert.equal(await readFile(join(fixture.repo, '.plannr/agent.json'), 'utf8'), '');
  assert.equal(await readFile(join(fixture.repo, 'roadmap.md'), 'utf8'), 'Fixture source ledger\n');
});

test('credential setup refuses an unignored repo before signing in or writing remotely', async () => {
  const fixture = await repoFixture(); await writeFile(join(fixture.repo, '.gitignore'), '');
  const options = onboardingArgs(['--repo', fixture.repo, '--manifest', fixture.path, '--apply', '--issue-agent']);
  let requests = 0;
  await assert.rejects(onboardingRun(options, {password, fetcher: async () => {requests++; throw Error('Must not fetch');}, backupRoot: join(fixture.directory, 'backups')}));
  assert.equal(requests, 0);
  assert.equal((await readdir(fixture.repo)).includes('.plannr'), false);
});

test('Netlify adapter supports owner imports above the ordinary body size without weakening other routes', async () => {
  const config = configuration({PLANNR_ORIGIN: 'https://plannr.example', PLANNR_PASSWORD: password, PLANNR_DATABASE_BRANCH: 'development', PLANNR_DATABASE_HOST: 'fixture.example', DATABASE_URL: 'postgresql://fixture.example/test'});
  const store = memoryStore(), handle = netlifyApplication(config, store), context = {ip: 'fixture'};
  const send = (path, body, headers = {}) => handle(new Request(config.origin + path, {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)}), context);
  const login = await send('/auth/login', {password}, {Origin: config.origin});
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const session = await (await handle(new Request(config.origin + '/api/session', {headers: {cookie}}), context)).json();
  const headers = {Cookie: cookie, Origin: config.origin, 'X-CSRF-Token': session.csrf}, manifest = fixture(); manifest.tickets[0].raw = 'A'.repeat(20000);
  const preview = await send('/api/imports/preview', {manifest}, headers); assert.equal(preview.status, 200);
  assert.equal((await send('/api/imports/apply', {manifest, expectedState: (await preview.json()).expectedState}, headers)).status, 200);
  assert.equal((await send('/api/projects', {name: 'Other', kind: 'app', extra: 'A'.repeat(20000)}, headers)).status, 413);
});
