import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apiApplication} from '../lib/api.mjs';
import {configuration} from '../lib/config.mjs';
import {emptyState, memoryStore} from '../lib/store.mjs';
import {hash} from '../lib/auth.mjs';
import {laneKey, laneOrder, sqlLaneBoard, sqlLanePage} from '../lib/lane-page.mjs';
import {boardSelection} from '../lib/board-page.mjs';

function fixture() {
  const state=emptyState();
  state.projects=['a','b','empty'].map(id=>({id,name:id,kind:'app',archived:false,revision:1}));
  for(const project of ['a','b'])for(const status of ['next','in-progress','completed'])for(let i=0;i<23;i++)state.tickets.push({
    id:`${project}-${status}-${i}`,project,status,title:`Task ${i}`,description:i===0?'Needle':'',priority:Math.floor(i/3),revision:1,
    completedAt:status==='completed'&&i>2?new Date(1000000+Math.floor(i/3)*1000).toISOString():null,comments:[],ownerId:null,leaseUntil:0});
  return state;
}
function api(state=fixture(),config=configuration({PLANNR_MODE:'demo'})) {
  const handle=apiApplication(memoryStore(state),config,{now:()=>2000000});
  return async (params,path='/api/board',headers={})=>handle({path,query:new URLSearchParams(params),headers,method:'GET'});
}
test('every Swimlane starts at five per project/status; Kanban at ten combined, with exact totals',async()=>{
  const send=api();
  for(const [view,size,groups] of [['swimlanes',5,['a','b','empty']],['kanban',10,['all']]]) {
    const result=await send({view,paging:'lanes'});assert.equal(result.status,200);assert.equal(result.body.laneView,view);
    for(const project of groups)for(const status of ['next','in-progress','completed']) {
      const metadata=result.body.lanes[laneKey(project,status)],rows=result.body.tickets.filter(t=>t.status===status&&(project==='all'||t.project===project));
      assert.equal(rows.length,project==='empty'?0:size);assert.equal(metadata.total,project==='empty'?0:project==='all'?46:23);
      assert.equal(Boolean(metadata.nextCursor),project!=='empty');
    }
    assert.equal(result.body.completed,undefined);
  }
  const filtered=(await send({view:'kanban',paging:'lanes',project:'a'})).body;
  assert.equal(filtered.tickets.length,30);assert.ok(filtered.tickets.every(row=>row.project==='a'));
});
test('each column cursor covers every ticket once, including priority/time ties and old null completion times',async()=>{
  const state=fixture(),send=api(state);
  for(const view of ['swimlanes','kanban'])for(const status of ['next','in-progress','completed']) {
    const project=view==='swimlanes'?'a':'all',first=(await send({view,paging:'lanes',project})).body;
    const ids=first.tickets.filter(t=>t.status===status).map(t=>t.id);let cursor=first.lanes[laneKey(project,status)].nextCursor;
    while(cursor){const result=await send({view,project,status,cursor},'/api/lane');assert.equal(result.status,200);
      assert.ok(result.body.tickets.length<=(view==='swimlanes'?5:10));assert.ok(result.body.tickets.every(t=>t.status===status));
      ids.push(...result.body.tickets.map(t=>t.id));cursor=result.body.nextCursor;}
    const expected=state.tickets.filter(t=>t.status===status&&(project==='all'||t.project===project)).sort(laneOrder).map(t=>t.id);
    assert.deepEqual(ids,expected);assert.equal(new Set(ids).size,ids.length);
  }
});
test('completed search leaves active columns intact and column cursors reject a changed scope/view/status/search',async()=>{
  const send=api(),initial=(await send({view:'swimlanes',paging:'lanes',project:'a'})).body;
  const cursor=initial.lanes[laneKey('a','next')].nextCursor;
  for(const patch of [{project:'b'},{view:'kanban'},{status:'completed'},{q:'Needle'},{cursor:'invalid'}]) {
    assert.equal((await send({view:'swimlanes',project:'a',status:'next',cursor,...patch},'/api/lane')).status,400);
  }
  assert.equal((await send({view:'queue',project:'a',status:'next'},'/api/lane')).status,400);
  assert.equal((await send({status:'invalid'},'/api/lane')).status,400);
  const page=(await send({view:'swimlanes',paging:'lanes',q:'Needle'})).body;
  assert.equal(page.lanes[laneKey('a','completed')].total,1);assert.equal(page.lanes[laneKey('a','next')].total,23);
  assert.equal(page.tickets.filter(t=>t.status==='next').length,10);
});
test('column reads enforce login and scoped agents, without expanding the existing agent board contract',async()=>{
  const state=fixture(),token=`plnr_${'c'.repeat(43)}`;
  state.agents.push({id:'agent',name:'Agent',projects:['a'],tokenHash:hash(token),expiresAt:99999999,revoked:false});
  const send=api(state,configuration({PLANNR_PASSWORD:'test-only-password'})),headers={authorization:`Bearer ${token}`};
  assert.equal((await send({status:'next'},'/api/lane')).status,401);
  assert.equal((await send({project:'b',status:'next'},'/api/lane',headers)).status,404);
  const board=(await send({view:'swimlanes',paging:'lanes'},'/api/board',headers)).body;
  assert.equal(Object.keys(board.lanes).length,3);assert.ok(board.tickets.every(t=>t.project==='a'));
  const legacy=(await send({view:'kanban'},'/api/board',headers)).body;
  assert.equal(legacy.tickets.filter(t=>t.status!=='completed').length,46,'agent backlog still has all active tickets');
  state.agents[0].expiresAt=1; // Separate expired fixture, the store clones its initial state.
  assert.equal((await api(state,configuration({PLANNR_PASSWORD:'test-only-password'}))({status:'next'},'/api/lane',headers)).status,401);
});
test('SQL board query bounds every partition to size plus lookahead, not an unbounded active snapshot',async()=>{
  const state=fixture(),owner={owner:true};
  for(const view of ['swimlanes','kanban']) {
    const selection=boardSelection(state,owner,new URLSearchParams({view,paging:'lanes'})),queries=[];
    const client={async query(sql,params){queries.push({sql,params});
      if(sql.includes('WITH lane_ranked'))return {rows:(view==='swimlanes'?['a','b']:['all']).flatMap(project=>['next','in-progress','completed'].flatMap(status=>state.tickets.filter(t=>t.status===status&&(project==='all'||t.project===project)).sort(laneOrder).slice(0,view==='swimlanes'?6:11).map(data=>({project_id:data.project,status,data,total:project==='all'?46:23}))))};
      return {rows:[]};}};
    const result=await sqlLaneBoard(client,selection);
    assert.equal(queries.length,2);assert.equal(result.tickets.length,30);
    assert.equal(queries[0].params[2],view==='swimlanes'?6:11);assert.match(queries[0].sql,/page_rank<=\$3/);
    assert.match(queries[0].sql,view==='swimlanes'?/PARTITION BY project_id, data->>'status'/:/PARTITION BY data->>'status'/);
    assert.match(queries[0].sql,/COLLATE "C"/);
  }
});
test('SQL continuation is project/status scoped, uses all typed cursor parameters and requests just one page plus lookahead',async()=>{
  const state=fixture();
  for(const status of ['next','in-progress','completed']) {
    const selection=boardSelection(state,{owner:true},new URLSearchParams({project:'a',view:'swimlanes',status}));
    selection.cursor={id:'boundary',time:'time',priority:2,priorityLevel:'P1',status,view:'swimlanes',sort:'default'};
    const queries=[],client={async query(sql,params){queries.push({sql,params});return {rows:sql.includes('count(*)')?[{total:23}]:[]};}};
    await sqlLanePage(client,selection);
    assert.deepEqual(queries[0].params,[['a'],'',status,'time','boundary',2,6,status==='completed'?0:1]);assert.match(queries[0].sql,/LIMIT \$7/);
    for(let i=1;i<=8;i++)assert.ok(queries[0].sql.includes(`$${i}`));
    assert.match(queries[0].sql,/data->>'status'=\$3/);assert.match(queries[0].sql,/CASE WHEN \$3='completed'/);
  }
});
test('Recent SQL uses a typed constant, numeric creation order and a matching descending cursor boundary',async()=>{
  const selection=boardSelection(fixture(),{owner:true},new URLSearchParams({project:'a',view:'swimlanes',status:'next',sort:'recent'}));
  selection.cursor={id:'PLNR-10',time:'',priority:999,priorityLevel:'P0',status:'next',view:'swimlanes',sort:'recent'};
  const queries=[],client={async query(sql,params){queries.push({sql,params});return {rows:sql.includes('count(*)')?[{total:23}]:[]};}};
  await sqlLanePage(client,selection);
  assert.match(queries[0].sql,/ORDER BY \(0::integer\) ASC/);
  assert.match(queries[0].sql,/substring\(id FROM 6\)::bigint/);
  assert.equal(queries[0].params[5],10);assert.equal(queries[0].params[7],0);
});
