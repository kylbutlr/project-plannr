import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apiApplication} from '../lib/api.mjs';
import {configuration} from '../lib/config.mjs';
import {emptyState, memoryStore} from '../lib/store.mjs';
import {boardSelection, sqlBoardPage} from '../lib/board-page.mjs';
import {sqlLaneBoard, sqlLanePage, laneKey} from '../lib/lane-page.mjs';
import {memoryChanges, sqlChanges} from '../lib/board-changes.mjs';
import {projectFolds} from '../board-client.js';
import {hash} from '../lib/auth.mjs';

function fixture() {
  const state = emptyState();
  state.projects = ['a','b'].map(id => ({id,name:id,revision:1,archived:false,kind:'app'}));
  for (const project of ['a','b']) for (const status of ['next','in-progress','completed']) for(let i=0;i<30;i++)state.tickets.push({
    id:`${project}-${status}-${i}`,project,status,title:`Task ${i}`,description:i===29?'Hidden needle':'',priority:i,revision:1,
    completedAt:status==='completed'?new Date(i*1000).toISOString():null,comments:[],ownerId:null,leaseUntil:0});
  return state;
}
function harness(state=fixture(), config=configuration({PLANNR_MODE:'demo'})) {
  const store=memoryStore(state), app=apiApplication(store,config,{now:()=>100000});
  return {store, send:(path,method='GET',body,headers={})=>{
    const url=new URL(path,'http://fixture');return app({path:url.pathname,query:url.searchParams,method,body:async()=>body,headers});
  }};
}
test('owner all-ticket search finds unloaded work in every view and status, by description, title and ID',async()=>{
  const h=harness();
  for(const view of ['swimlanes','kanban','queue'])for(const q of ['needle','Task 29','a-next-29']) {
    const response=await h.send(`/api/board?view=${view}&${view==='queue'?'':'paging=lanes&'}searchScope=all&q=${encodeURIComponent(q)}`);
    assert.equal(response.status,200);
    assert.equal(response.body.tickets.length,q==='a-next-29'?1:6);
    assert.ok(response.body.tickets.every(t=>`${t.id}\n${t.title}\n${t.description}`.toLowerCase().includes(q.toLowerCase())));
  }
  const none=(await h.send('/api/board?paging=lanes&searchScope=all&q=unfindable')).body;
  assert.equal(none.tickets.length,0);assert.ok(Object.values(none.lanes).every(p=>p.total===0&&!p.nextCursor));
  const legacy=(await h.send('/api/board?q=needle')).body;
  assert.equal(legacy.tickets.filter(t=>t.status!=='completed').length,120);
});
test('all-ticket cursor retains search and scope over subsequent pages',async()=>{
  const h=harness(),first=(await h.send('/api/board?view=swimlanes&paging=lanes&project=a&searchScope=all&q=Task')).body;
  const cursor=first.lanes[laneKey('a','next')].nextCursor;
  const path=`/api/lane?project=a&view=swimlanes&status=next&q=Task&cursor=${cursor}`;
  assert.equal((await h.send(path)).status,400);
  const page=await h.send(`${path}&searchScope=all`);assert.equal(page.status,200);assert.equal(page.body.tickets.length,5);
  assert.ok(page.body.tickets.every(t=>t.priority>=5&&t.priority<10));
});
test('SQL global search filters active and completed rows with bound values, retaining page limits',async()=>{
  const selection=boardSelection(fixture(),{owner:true},new URLSearchParams({searchScope:'all',q:"Needle%_'",view:'kanban'}));
  for(const read of [sqlLaneBoard,sqlLanePage,sqlBoardPage]) {
    const queries=[],client={async query(sql,params){queries.push({sql,params});return {rows:sql.includes('AS total')&&!sql.includes('GROUP BY')&&!sql.includes('OVER')?[{total:0}]:[]};}};
    await read(client,{...selection,status:'next'});
    const searchQueries=queries.filter(q=>q.params?.includes("needle%_'"));
    assert.ok(searchQueries.length);
    assert.ok(searchQueries.every(q=>!q.sql.includes("data->>'status'!='completed' OR")&&!q.sql.includes("Needle%_'")));
    if(read===sqlBoardPage)assert.ok(searchQueries.some(q=>q.sql.includes("data->>'status'!='completed'")));
  }
});
test('collapse preferences survive reload; search temporarily expands without erasing preferences',()=>{
  const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  const folds=projectFolds(storage);assert.equal(folds.isCollapsed('a'),false);folds.toggle('a');
  assert.equal(projectFolds(storage).isCollapsed('a'),true);assert.equal(folds.isCollapsed('a',true),false);
  assert.equal(folds.isCollapsed('b'),false);assert.equal(folds.isCollapsed('a'),true);
  folds.toggle('a');assert.equal(projectFolds(storage).isCollapsed('a'),false);
  assert.doesNotThrow(()=>projectFolds({getItem(){throw Error();},setItem(){throw Error();}}).toggle('a'));
});
test('change tokens match board snapshots, survive activity truncation, and detect writes without ticket payloads',async()=>{
  const h=harness(),initial=(await h.send('/api/board?paging=lanes')).body;
  assert.deepEqual((await h.send('/api/changes')).body,{changeToken:initial.changeToken});
  const result=await h.send('/api/tickets/a-next-29','PATCH',{revision:1,title:'Changed elsewhere'});assert.equal(result.status,200);
  await h.store.transact(state=>{state.activity=[];});
  const next=(await h.send('/api/changes')).body;assert.notEqual(next.changeToken,initial.changeToken);
  assert.deepEqual(Object.keys(next),['changeToken']);
  assert.equal((await h.send('/api/board?paging=lanes&q=needle&searchScope=all')).body.changeToken,next.changeToken);
});
test('change metadata enforces auth and agent scope; other projects do not trigger scoped changes',async()=>{
  const state=fixture(),token=`plnr_${'d'.repeat(43)}`;
  state.agents.push({id:'agent',name:'Scoped agent',projects:['a'],tokenHash:hash(token),revoked:false,expiresAt:1000000});
  const h=harness(state,configuration({PLANNR_PASSWORD:'test-only-password'})),headers={authorization:`Bearer ${token}`};
  assert.equal((await h.send('/api/changes')).status,401);
  assert.equal((await h.send('/api/changes?project=b','GET',undefined,headers)).status,404);
  const before=(await h.send('/api/changes','GET',undefined,headers)).body.changeToken;
  await h.store.transact(s=>{s.tickets.find(t=>t.project==='b').revision++;});
  assert.equal((await h.send('/api/changes','GET',undefined,headers)).body.changeToken,before);
  const claim=await h.send('/api/tickets/a-next-29/claim','POST',{revision:1},headers);assert.equal(claim.status,200);
  const note=await h.send('/api/tickets/a-next-29','PATCH',{revision:2,comment:'Agent progress'},headers);assert.equal(note.status,200);
  assert.notEqual((await h.send('/api/changes','GET',undefined,headers)).body.changeToken,before);
  await h.store.transact(s=>{s.agents[0].revoked=true;});assert.equal((await h.send('/api/changes','GET',undefined,headers)).status,401);
});
test('SQL change check aggregates revisions rather than returning tickets, and matches memory tokens',async()=>{
  const state=fixture(),selection=boardSelection(state,{owner:true},new URLSearchParams({project:'a'}));
  const queries=[],client={async query(sql,params){queries.push({sql,params});return {rows:[{project_id:'a',ticket_count:'90',revision_sum:'90'}]};}};
  assert.equal(await sqlChanges(client,selection),memoryChanges(state,selection));assert.deepEqual(queries[0].params,[['a']]);
  assert.match(queries[0].sql,/sum\(\(data->>'revision'\)::bigint\)/);assert.doesNotMatch(queries[0].sql,/SELECT data/);
  const previous=memoryChanges(state,selection);state.projects[0].revision++;assert.notEqual(memoryChanges(state,selection),previous);
});
