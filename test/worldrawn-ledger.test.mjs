import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState, memoryStore} from '../lib/store.mjs';
import {planWorldrawnImport, importWorldrawnPlan} from '../scripts/worldrawn-ledger.mjs';

const revision = 'a'.repeat(40);
const source = (status = 'Idea') => '# Source\n\n## Next\n- POI-017: Towns\n- POI-018: Mines\n- POI-012 follow-up: Trails\n\n## Family rules\nKeep variation deterministic.\n\n## Places\n' +
  Array.from({length: 34}, (_, i) => `- **Place ${i + 1}** (POI-${String(i + 1).padStart(3, '0')})\n  - Status: ${status}\n  - Built: [Evidence](prototypes/check.md)\n    Keep all continuation notes.\n`).join('') + '\n## Keeping it simple\nPreserve IDs.\n';
const initial = () => ({...emptyState(), counter: 3, projects: [{id: 'world', name: 'Worldrawn', kind: 'game', archived: false}],
  tickets: [{id: 'PLNR-3', project: 'world', title: 'Test', revision: 1}]});

test('every source ID, context, status, priority and relative evidence link survives', () => {
  const plan = planWorldrawnImport(source(), revision);
  assert.equal(plan.tickets.length, 35);
  assert.equal(plan.tickets.find(row => row.key === 'POI-017').priority, 1);
  assert.equal(plan.tickets.find(row => row.key === 'POI-018').priority, 2);
  assert.equal(plan.tickets.find(row => row.key === 'POI-012').priority, 3);
  assert.ok(plan.tickets[0].description.includes(`/blob/${revision}/docs/prototypes/check.md`));
  assert.ok(plan.tickets.at(-1).raw.includes('Keep variation deterministic'));
  assert.ok(plan.tickets.at(-1).raw.includes('Preserve IDs'));
  for (const [legacy, status] of [['Idea', 'next'], ['Needs polish', 'next'], ['In progress', 'in-progress'], ['Done', 'completed']]) {
    assert.equal(planWorldrawnImport(source(legacy), revision).tickets[0].status, status);
  }
  assert.throws(() => planWorldrawnImport(source('Unknown'), revision));
  assert.throws(() => planWorldrawnImport(source().replace('POI-034', 'POI-033'), revision));
});

test('long entries remain editable, source is lossless and notes respect API limits', () => {
  const input = source().replace('Keep all continuation notes.', 'Keep all continuation notes. ' + 'Detail. '.repeat(800));
  const item = planWorldrawnImport(input, revision).tickets[0];
  assert.ok(item.description.length <= 4000);
  assert.ok(item.notes.every(text => text.length <= 2000));
  assert.ok(item.notes.join('').includes('Detail. '.repeat(800)));
  assert.ok(item.raw.includes('Detail. '.repeat(800)));
});

test('atomic import preserves existing work and never duplicates or overwrites edited tickets', async () => {
  const store = memoryStore(initial()), plan = planWorldrawnImport(source('Done'), revision);
  const mapping = await importWorldrawnPlan(store, plan, 'world', 1234);
  assert.equal(mapping.length, 35);
  const once = await store.read();
  assert.deepEqual(once.tickets[0], initial().tickets[0]);
  assert.ok(once.tickets.slice(1).every(ticket => !ticket.ownerId && !ticket.completedAt));
  await store.transact(state => {state.tickets[1].title = 'Owner changed this'; state.tickets[1].revision++;});
  const edited = await store.read();
  await importWorldrawnPlan(store, plan, 'world', 5678);
  assert.deepEqual(await store.read(), edited);
  assert.equal(once.counter, 38);
  assert.equal(once.activity.length, 35);
});

test('conflicts or persistence failure roll back the entire import', async () => {
  const data = initial(); data.tickets.push({id: 'PLNR-4', project: 'world', title: 'Existing POI-034 work'});
  const store = memoryStore(data), plan = planWorldrawnImport(source(), revision);
  await assert.rejects(importWorldrawnPlan(store, plan, 'world'));
  assert.deepEqual(await store.read(), data);
  const failing = memoryStore(initial(), async () => {throw Error('Cannot persist');});
  await assert.rejects(importWorldrawnPlan(failing, plan, 'world'));
  assert.deepEqual(await failing.read(), initial());
});
