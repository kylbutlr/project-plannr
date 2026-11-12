import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configuration} from '../lib/config.mjs';
import {emptyState, memoryStore} from '../lib/store.mjs';
import {cleanupVerificationFixture, verifyStorage} from '../scripts/verify-storage.mjs';

const config = () => configuration({PLANNR_PASSWORD: 'test-only-workspace-password'});
const fixture = {project: {id: 'test-project', name: 'Storage verification test-run', kind: 'other'}, ticketId: 'PLNR-2', sessionId: 'test-session'};
function populated() {
  const state = emptyState();
  state.counter = 2;
  state.projects = [{id: 'real-project', name: 'My app', kind: 'app'}, {...fixture.project}];
  state.tickets = [{id: 'PLNR-1', project: 'real-project', title: 'Real work'}, {id: fixture.ticketId, project: fixture.project.id, title: 'Verify durable transactions', comments: []}];
  state.sessions = [{id: 'real-session'}, {id: fixture.sessionId}];
  state.replays = [{id: 'real-replay', project: 'real-project'}, {id: 'test-replay', project: fixture.project.id}];
  state.activity = [{id: 'prior-audit', project: fixture.project.id, action: 'created ticket'}];
  return state;
}

test('verification cleanup removes only its exact fixture and preserves audit, real data and counter', async () => {
  const store = memoryStore(populated());
  await cleanupVerificationFixture(store, fixture);
  const state = await store.read();
  assert.deepEqual(state.projects.map(p => p.id), ['real-project']);
  assert.deepEqual(state.tickets.map(t => t.id), ['PLNR-1']);
  assert.deepEqual(state.sessions.map(s => s.id), ['real-session']);
  assert.deepEqual(state.replays.map(r => r.id), ['real-replay']);
  assert.equal(state.counter, 2);
  assert.ok(state.activity.some(a => a.id === 'prior-audit'));
  assert.ok(state.activity.some(a => a.action === 'removed storage verification fixtures'));
  const before = await store.read();
  await cleanupVerificationFixture(store, fixture);
  assert.deepEqual(await store.read(), before, 'Cleanup is idempotent.');
});

test('cleanup refuses renamed projects, extra tickets and linked agents without partial deletion', async () => {
  for (const change of [
    state => {state.projects[1].name = 'Keep this project';},
    state => {state.tickets.push({id: 'PLNR-3', project: fixture.project.id, title: 'User work'});},
    state => {state.agents.push({id: 'real-agent', projects: [fixture.project.id]});},
    state => {state.tickets[1].title = 'User renamed this ticket';},
  ]) {
    const initial = populated(); change(initial); const store = memoryStore(initial);
    await assert.rejects(cleanupVerificationFixture(store, fixture), /Refusing/);
    assert.deepEqual(await store.read(), initial);
  }
  const revised = populated(); revised.projects[1].revision = 2;
  const store = memoryStore(revised);
  await assert.rejects(cleanupVerificationFixture(store, {...fixture, project: {...fixture.project, revision: 1}}), /Refusing/);
  assert.deepEqual(await store.read(), revised);
});

test('successful storage verification cleans its fixtures and keeps unrelated rows', async () => {
  const initial = emptyState();
  initial.projects.push({id: 'real-project', name: 'My app', kind: 'app'});
  const store = memoryStore(initial); let opened = 0;
  await verifyStorage(() => {opened++; return store;}, config());
  const state = await store.read();
  assert.equal(opened, 2);
  assert.deepEqual(state.projects, initial.projects);
  assert.deepEqual(state.tickets, []);
  assert.deepEqual(state.sessions, []);
  assert.deepEqual(state.replays, []);
  assert.ok(state.activity.length > 0);
});

test('failed verification cleans partial fixtures before returning the original failure', async () => {
  const base = memoryStore(); let fail = true;
  const store = {...base, async read() {if (fail) {fail = false; throw Error('Injected verification failure');} return base.read();}};
  await assert.rejects(verifyStorage(() => store, config()), /Injected verification failure/);
  const state = await base.read();
  assert.deepEqual(state.projects, []);
  assert.deepEqual(state.tickets, []);
  assert.deepEqual(state.sessions, []);
  assert.deepEqual(state.replays, []);
  assert.ok(state.activity.some(a => a.action === 'removed storage verification fixtures'));
});

test('cleanup failures are reported, not silently turned into a passing check', async () => {
  const base = memoryStore();
  const store = {...base, transact(fn) {return base.transact(async state => {const result = await fn(state); if (state.activity.some(a => a.action === 'removed storage verification fixtures')) throw Error('Injected cleanup failure'); return result;});}};
  await assert.rejects(verifyStorage(() => store, config()), /Injected cleanup failure/);
  assert.equal((await base.read()).projects.length, 1);
});
