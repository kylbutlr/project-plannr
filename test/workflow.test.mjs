import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {apiApplication} from '../lib/api.mjs';
import {configuration} from '../lib/config.mjs';
import {emptyState, memoryStore, fileStore, postgresStore} from '../lib/store.mjs';
import {PGlite} from '@electric-sql/pglite';
import {defaultColumns, pickupReady, workflowOf} from '../workflow.js';
import {agentResult} from '../lib/agent-command.mjs';
import {importPlan, previewImport, applyImport} from '../lib/project-import.mjs';

async function harness(store=memoryStore(emptyState())) {
  const config=configuration({PLANNR_AUTH_MODE:'none'}), api=apiApplication(store,config,{now:()=>1700000000000});
  const owner={origin:config.origin,'x-csrf-token':config.localCsrf};
  const send=(path,method='GET',body,headers=owner)=>{const url=new URL(path,config.origin);return api({path:url.pathname,query:url.searchParams,method,headers,body:async()=>body});};
  const project=(await send('/api/projects','POST',{name:'Fieldnotes',kind:'app'})).body;
  const create=async(columnId,title='Fictional work')=>(await send('/api/tickets','POST',{project:project.id,title,...(columnId?{columnId}:{})})).body;
  const save=async(columns,moves={},revision)=>(await send('/api/workflow','PATCH',{revision:revision??workflowOf(await store.read()).revision,columns,moves}));
  const agent=(await send('/api/agents','POST',{name:'Fixture agent',projects:[project.id]})).body;
  return {store,send,project,create,save,agentHeaders:{authorization:`Bearer ${agent.token}`}};
}
const custom=(id,category='waiting',enabled=true)=>({id,name:id,category,enabled});
const base=()=>defaultColumns.map(column=>({...column}));

test('legacy workspaces retain default states; Waiting columns cannot enter the agent backlog or claim path',async()=>{
  const h=await harness();
  const columns=[custom('triage'),...base(),custom('qa-ready','ready')];
  assert.equal((await h.save(columns)).status,200);
  const waiting=await h.create('triage'),ready=await h.create('qa-ready'),legacy=await h.create();
  assert.equal(waiting.status,'waiting');assert.equal(ready.status,'next');assert.equal(legacy.status,'next');
  const snapshot=(await h.send('/api/state','GET',undefined,h.agentHeaders)).body;
  assert.deepEqual(agentResult({backlog:true},snapshot).tickets.map(row=>row.id),[ready.id,legacy.id]);
  assert.equal((await h.send(`/api/tickets/${waiting.id}/claim`,'POST',{revision:1},h.agentHeaders)).status,409);
  assert.equal((await h.send('/api/workflow','GET',undefined,h.agentHeaders)).status,403);
  assert.equal((await h.send('/api/workflow','PATCH',{revision:2,columns},h.agentHeaders)).status,403);
});

test('custom Ready claim and release return to the same step; disabled Ready retains its tickets and is excluded',async()=>{
  const h=await harness(),columns=[...base(),custom('ready-for-review','ready')];await h.save(columns);
  const ticket=await h.create('ready-for-review');
  const claimed=await h.send(`/api/tickets/${ticket.id}/claim`,'POST',{revision:1},h.agentHeaders);
  assert.equal(claimed.status,200);assert.equal(claimed.body.status,'in-progress');assert.equal(claimed.body.columnId,'in-progress');
  assert.equal((await h.save(columns.map(column=>({...column,enabled:column.id!=='in-progress'})))).status,400,'last Active cannot be disabled');
  const released=await h.send(`/api/tickets/${ticket.id}/release`,'POST',{revision:2},h.agentHeaders);
  assert.equal(released.body.columnId,'ready-for-review');
  await h.save(columns.map(column=>({...column,enabled:column.id!=='ready-for-review'})));
  const snapshot=(await h.send('/api/state')).body;
  assert.equal(snapshot.tickets[0].id,ticket.id);assert.equal(pickupReady(snapshot.workflow,snapshot.tickets[0]),false);
  assert.equal((await h.send(`/api/tickets/${ticket.id}/claim`,'POST',{revision:3},h.agentHeaders)).status,409);
  await h.save(columns);assert.equal(pickupReady((await h.send('/api/state')).body.workflow,released.body),true);
});

test('custom Active claims remain in their step and active claims protect workflow edits',async()=>{
  const h=await harness(),columns=[...base(),custom('reviewing','active')];await h.save(columns);
  let ticket=await h.create();ticket=(await h.send(`/api/tickets/${ticket.id}/claim`,'POST',{revision:1},h.agentHeaders)).body;
  assert.equal((await h.save(columns.map(column=>({...column,enabled:column.id!=='in-progress'})))).status,409);
  ticket=(await h.send(`/api/tickets/${ticket.id}/release`,'POST',{revision:ticket.revision},h.agentHeaders)).body;
  ticket=(await h.send(`/api/tickets/${ticket.id}`,'PATCH',{revision:ticket.revision,columnId:'reviewing'})).body;
  assert.equal(ticket.columnId,'reviewing');
  assert.equal((await h.save(columns.filter(column=>column.id!=='reviewing'),{reviewing:'next'})).status,409);
});

test('an agent can explicitly claim Ready review work into its intended Active step',async()=>{
  const h=await harness(),columns=[...base(),custom('ready-for-review','ready'),custom('reviewing','active')];await h.save(columns);
  const ticket=await h.create('ready-for-review');
  const invalid=await h.send(`/api/tickets/${ticket.id}/claim`,'POST',{revision:1,columnId:'completed'},h.agentHeaders);assert.equal(invalid.status,400);
  const claimed=await h.send(`/api/tickets/${ticket.id}/claim`,'POST',{revision:1,columnId:'reviewing'},h.agentHeaders);
  assert.equal(claimed.status,200);assert.equal(claimed.body.columnId,'reviewing');
  const released=await h.send(`/api/tickets/${ticket.id}/release`,'POST',{revision:2},h.agentHeaders);assert.equal(released.body.columnId,'ready-for-review');
});

test('removing a populated column requires explicit moves, includes archived work, and rejects stale edits atomically',async()=>{
  const h=await harness(),columns=[...base(),custom('triage')];await h.save(columns);
  const ticket=await h.create('triage');await h.send(`/api/projects/${h.project.id}`,'PATCH',{revision:1,archived:true});
  const before=await h.store.read();
  assert.equal((await h.save(base())).status,400);assert.deepEqual(await h.store.read(),before);
  assert.equal((await h.save(base(),{triage:'next'},1)).status,409);assert.deepEqual(await h.store.read(),before);
  assert.equal((await h.save(base(),{triage:'next'})).status,200);
  const moved=(await h.store.read()).tickets.find(row=>row.id===ticket.id);
  assert.equal(moved.columnId,'next');assert.equal(moved.revision,2);assert.equal(moved.project,h.project.id);
});

test('custom Done participates in completion history and column paging independently of its name',async()=>{
  const h=await harness(),columns=[...base(),custom('shipped','done')];await h.save(columns);
  for(let i=0;i<12;i++)await h.create('shipped',`Completed fixture ${i}`);
  const history=(await h.send('/api/completed')).body;assert.equal(history.total,12);assert.ok(history.tickets.every(row=>row.completedAt&&row.status==='completed'));
  const board=(await h.send('/api/board?view=kanban&paging=lanes')).body;
  const lane=board.lanes[JSON.stringify(['all','shipped'])];assert.equal(lane.total,12);assert.ok(lane.nextCursor);
  const next=(await h.send('/api/lane?'+new URLSearchParams({status:'shipped',view:'kanban',cursor:lane.nextCursor}))).body;
  assert.equal(next.tickets.length,2);assert.ok(next.tickets.every(row=>row.columnId==='shipped'));
});

test('workflow revisions change freshness tokens even in an empty project and categories update existing ticket semantics',async()=>{
  const h=await harness();const first=(await h.send('/api/changes')).body.changeToken;
  await h.save([...base(),custom('triage')]);assert.notEqual((await h.send('/api/changes')).body.changeToken,first);
  const ticket=await h.create('triage');
  await h.save([...base(),custom('triage','ready')]);
  const ready=(await h.send(`/api/tickets/${ticket.id}`)).body;assert.equal(ready.status,'next');assert.equal(ready.columnId,'triage');
  await h.save([...base(),custom('triage','done')]);
  const done=(await h.send(`/api/tickets/${ticket.id}`)).body;assert.equal(done.status,'completed');assert.ok(done.completedAt);assert.equal(done.ownerId,null);
});

test('column category, names, required stages and unknown columns validate without partial changes',async()=>{
  const h=await harness(),ticket=await h.create(),before=await h.store.read();
  for(const columns of [[...base(),custom('triage','unknown')],[...base(),{...custom('triage'),name:'Next'}],base().map(row=>({...row,enabled:row.category!=='done'})),base().map(row=>({...row,category:row.id==='next'?'waiting':row.category}))]) {
    assert.equal((await h.save(columns)).status,400);assert.deepEqual(await h.store.read(),before);
  }
  assert.equal((await h.send(`/api/tickets/${ticket.id}`,'PATCH',{revision:1,columnId:'missing'})).status,400);
  assert.equal((await h.send(`/api/tickets/${ticket.id}`,'PATCH',{revision:1,columnId:'next',status:'completed'})).status,400);
});

test('file persistence retains workflow, disabled columns, and ticket identity across restart',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'plannr-workflow-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const path=join(directory,'workspace.json');let store=await fileStore(path);
  const h=await harness(store),columns=[...base(),custom('triage')];await h.save(columns);const ticket=await h.create('triage');
  await h.save(columns.map(column=>({...column,enabled:column.id!=='triage'})));const before=await store.read();await store.close();
  store=await fileStore(path);try{const after=await store.read();assert.deepEqual(after,before);assert.equal(after.tickets[0].id,ticket.id);}finally{await store.close();}
});

test('imports route legacy states into replacement columns and reject workflow changes after preview',async()=>{
  const h=await harness();
  await h.save([custom('ready-to-build','ready'),custom('building','active'),custom('shipped','done')]);
  const plan=importPlan({version:1,project:{name:'Imported fixture',kind:'app'},source:{namespace:'fixture-import'},tickets:[{sourceId:'one',title:'Imported work',raw:'Fictional source',status:'next',priority:1}]});
  let state=await h.store.read(),preview=previewImport(state,plan);
  await h.save([custom('triage'),custom('ready-to-build','ready'),custom('building','active'),custom('shipped','done')]);
  const owner={id:'owner',name:'Fixture owner',owner:true};
  await assert.rejects(h.store.transact(next=>applyImport(next,plan,preview.expectedState,owner,1700000000000,'private')),/changed since preview/);
  state=await h.store.read();preview=previewImport(state,plan);
  await h.store.transact(next=>applyImport(next,plan,preview.expectedState,owner,1700000000000,'private'));
  const board=(await h.send('/api/board?view=kanban&paging=lanes')).body;
  const imported=board.tickets.find(ticket=>ticket.title==='Imported work');
  assert.equal(imported.columnId,'ready-to-build');assert.equal(pickupReady(board.workflow,imported),true);
});

test('editor recovery reads a ticket and its newly added column from one authorized snapshot',async()=>{
  const h=await harness(),ticket=await h.create();
  await h.save([...base(),custom('ready-for-review','ready')]);
  await h.send(`/api/tickets/${ticket.id}`,'PATCH',{revision:1,columnId:'ready-for-review'});
  assert.equal((await h.send(`/api/tickets/${ticket.id}`,'PATCH',{revision:1,title:'Old draft'})).status,409);
  const packet=(await h.send(`/api/tickets/${ticket.id}?include=workflow`)).body;
  assert.equal(packet.ticket.columnId,'ready-for-review');
  assert.equal(packet.workflow.columns.some(column=>column.id===packet.ticket.columnId),true);
});

test('real embedded Postgres executes the upgrade, workflow persistence, scoped lane paging and Done history',async()=>{
  const db=new PGlite();
  await db.exec(await readFile(new URL('../migrations/001-workspace.sql',import.meta.url),'utf8'));
  // Simulate a pre-upgrade workspace before applying the additive migration.
  await db.query("INSERT INTO project_plannr.entities(kind,id,data) VALUES('project','legacy',$1::jsonb)",[JSON.stringify({id:'legacy',name:'Legacy',kind:'app',revision:1,archived:false})]);
  await db.exec(await readFile(new URL('../migrations/002-workflow.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../migrations/002-workflow.sql',import.meta.url),'utf8'));
  const pool={on(){},async connect(){return {release(){},async query(sql,params){const result=await db.query(sql,params);return {rows:result.rows,rowCount:result.rows.length||result.affectedRows||0};}};},end:()=>db.close()};
  const store=postgresStore('postgresql://unused.example/fixture',{pool});
  try {
    const h=await harness(store);assert.equal((await store.read()).projects.some(row=>row.id==='legacy'),true);
    const columns=[custom('triage'),...base(),custom('qa-ready','ready'),custom('shipped','done')];
    assert.equal((await h.save(columns)).status,200);
    await h.create('triage');await h.create('qa-ready');
    for(let i=0;i<24;i++)await h.create('shipped',`Done fixture ${i}`);
    const snapshot=(await h.send('/api/state')).body;assert.equal(snapshot.workflow.columns.length,6);
    const visible=(await h.send('/api/board?'+new URLSearchParams({project:h.project.id,view:'swimlanes',paging:'lanes'}))).body;
    assert.equal(visible.workflow.columns[0].id,'triage');
    const shipped=visible.lanes[JSON.stringify([h.project.id,'shipped'])];assert.equal(shipped.total,24);
    const ids=visible.tickets.filter(row=>row.columnId==='shipped').map(row=>row.id);
    let cursor=shipped.nextCursor;
    while(cursor){const next=await h.send('/api/lane?'+new URLSearchParams({project:h.project.id,view:'swimlanes',status:'shipped',cursor}));assert.equal(next.status,200);ids.push(...next.body.tickets.map(row=>row.id));cursor=next.body.nextCursor;}
    assert.equal(ids.length,24);assert.equal(new Set(ids).size,24);
    const history=(await h.send('/api/completed?project='+h.project.id)).body;assert.equal(history.total,24);assert.equal(history.tickets.length,20);
    const backlog=agentResult({backlog:true},(await h.send('/api/board?project='+h.project.id,'GET',undefined,h.agentHeaders)).body);
    assert.equal(backlog.tickets.length,1);assert.equal(backlog.tickets[0].columnId,'qa-ready');
    const oldToken=(await h.send('/api/changes')).body.changeToken;
    await h.save(columns.map(column=>({...column,enabled:column.id!=='qa-ready'})));
    assert.notEqual((await h.send('/api/changes')).body.changeToken,oldToken);
    const disabled=(await h.send('/api/board?project='+h.project.id)).body;
    assert.equal(disabled.workflow.columns.find(column=>column.id==='qa-ready').enabled,false);
    assert.equal(agentResult({backlog:true},disabled).tickets.length,0);
  } finally {await store.close();}
});
