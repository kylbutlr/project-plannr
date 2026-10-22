import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appendCompletedPage, appendLanePage, laneKey, nearLaneEnd, createPageGate, createReadGate, createTicketUpdates} from '../board-client.js';

const ticket = () => ({id: 'PLNR-1', title: 'Original', description: '', status: 'next', priority: 1, revision: 1, ownerId: null, leaseUntil: 0, comments: []});
const conflict = () => Object.assign(Error('This item changed.'), {status: 409});
function harness(write) {
  let current = ticket(), remote = ticket();
  const updates = createTicketUpdates({getTicket: () => current, readTicket: async () => structuredClone(remote),
    writeTicket: async (id, body) => write(body, remote), applyTicket: row => {current = row;}, invalidate: () => {}});
  return {updates, get current() {return current;}, get remote() {return remote;}};
}
test('rapid status changes use each returned revision and run in order', async () => {
  const revisions = [];
  const h = harness(async (body, remote) => {
    revisions.push(body.revision); assert.equal(body.revision, remote.revision);
    await new Promise(resolve => setImmediate(resolve));
    Object.assign(remote, body, {revision: remote.revision + 1}); return structuredClone(remote);
  });
  await Promise.all([h.updates.update('PLNR-1', {status: 'in-progress'}), h.updates.update('PLNR-1', {status: 'completed'})]);
  assert.deepEqual(revisions, [1, 2]); assert.equal(h.current.status, 'completed'); assert.equal(h.current.revision, 3);
});
test('status retries once after an unrelated title edit, without overwriting it', async () => {
  let writes = 0;
  const h = harness(async (body, remote) => {
    if (++writes === 1) {Object.assign(remote, {title: 'Agent title', revision: 2}); throw conflict();}
    assert.equal(body.revision, 2); Object.assign(remote, body, {revision: 3}); return structuredClone(remote);
  });
  await h.updates.update('PLNR-1', {status: 'completed'});
  assert.equal(writes, 2); assert.equal(h.current.title, 'Agent title');
});
test('actual status and claim conflicts are not silently overwritten', async () => {
  for (const changed of [{status: 'in-progress'}, {ownerId: 'agent', leaseUntil: 999999}]) {
    let writes = 0;
    const h = harness(async (_, remote) => {writes++; Object.assign(remote, changed, {revision: 2}); throw conflict();});
    await assert.rejects(h.updates.update('PLNR-1', {status: 'completed'}), /changed.*review/i);
    assert.equal(writes, 1); assert.equal(h.current.revision, 2);
  }
});
test('editor conflicts preserve the newer remote title and reject the old draft', async () => {
  const h = harness(async (_, remote) => {Object.assign(remote, {title: 'Newer title', revision: 2}); throw conflict();});
  await assert.rejects(h.updates.update('PLNR-1', {title: 'My draft'}, ticket()), /changed.*review/i);
  assert.equal(h.current.title, 'Newer title');
});
test('old snapshots cannot win after a newer read or a ticket mutation', () => {
  const gate = createReadGate(), first = gate.begin(), second = gate.begin();
  assert.equal(gate.accept(first), false); assert.equal(gate.accept(second), true);
  gate.invalidate(); assert.equal(gate.accept(second), false);
  assert.equal(gate.accept(gate.begin()), true);
});
test('project pages can finish independently, and filter or session changes invalidate both',()=>{
  const gate=createPageGate(),a=gate.begin('a'),b=gate.begin('b');
  assert.equal(gate.begin('a'),null);assert.equal(gate.accept(a),true);assert.equal(gate.accept(b),true);
  gate.finish(b);assert.equal(gate.accept(a),true);assert.equal(gate.pending,true);
  gate.invalidate();const fresh=gate.begin('a');gate.finish(a);
  assert.equal(gate.accept(a),false);assert.equal(gate.accept(b),false);assert.equal(gate.accept(fresh),true);
});
test('loading a project appends only its page and leaves the other project count and cursor unchanged',()=>{
  const state={tickets:[{id:'A1'},{id:'B1'}],completedByProject:{a:{total:30,nextCursor:'a-first'},b:{total:50,nextCursor:'b-first'}}};
  const other=structuredClone(state.completedByProject.b);
  appendCompletedPage(state,{tickets:[{id:'A1'},{id:'A2'}],total:30,nextCursor:'a-second'},'a');
  assert.deepEqual(state.tickets.map(t=>t.id),['A1','B1','A2']);
  assert.deepEqual(state.completedByProject.b,other);assert.equal(state.completedByProject.a.nextCursor,'a-second');
  assert.equal(state.completedByProject.a.expanded,true);
});
test('all-status column pages deduplicate tickets and preserve every other project/status cursor',()=>{
  const key=laneKey('a','next'),otherKey=laneKey('a','completed'),state={tickets:[{id:'A'}],lanes:{[key]:{total:12,nextCursor:'first'},[otherKey]:{total:20,nextCursor:'other'}}};
  appendLanePage(state,{project:'a',status:'next',tickets:[{id:'A'},{id:'B'},{id:'B'}],total:12,nextCursor:'second'},key);
  assert.deepEqual(state.tickets.map(t=>t.id),['A','B']);assert.equal(state.lanes[key].expanded,true);assert.equal(state.lanes[otherKey].nextCursor,'other');
  assert.throws(()=>appendLanePage(state,{project:'b',status:'next',tickets:[]},key),/no longer matches/);
  const gate=createPageGate(),a=gate.begin(key),b=gate.begin(otherKey);assert.ok(gate.accept(a)&&gate.accept(b));assert.equal(gate.begin(key),null);
  gate.invalidate();assert.equal(gate.accept(a),false);assert.equal(gate.accept(b),false);
});
test('automatic column loading starts near the end, not at the top of an overflowing or hidden column',()=>{
  assert.equal(nearLaneEnd({scrollTop:0,clientHeight:480,scrollHeight:1500}),false);
  assert.equal(nearLaneEnd({scrollTop:950,clientHeight:480,scrollHeight:1500}),true);
  assert.equal(nearLaneEnd({scrollTop:0,clientHeight:0,scrollHeight:0}),false);
  assert.equal(nearLaneEnd({scrollTop:0,clientHeight:480,scrollHeight:200}),true);
});
test('checklist draft retries an unrelated note once, but never overwrites another checklist edit',async()=>{
 for(const checklistChanged of [false,true]){
  let writes=0;
  const base={...ticket(),checklist:[{id:'step',text:'Review',completed:false}]};
  const h=harness(async(body,remote)=>{
   if(++writes===1){remote.revision=2;remote.checklist=structuredClone(base.checklist);if(checklistChanged)remote.checklist[0].text='New scope';throw conflict();}
   assert.equal(body.revision,2);return {...remote,revision:3};
  });
  const patch={checklistChanges:[{action:'update',id:'step',completed:true}]};
  if(checklistChanged){await assert.rejects(h.updates.update(base.id,patch,base),/draft is kept/);assert.equal(writes,1);}
  else{await h.updates.update(base.id,patch,base);assert.equal(writes,2);}
 }
});
