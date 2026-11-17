import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {apiApplication} from '../lib/api.mjs';
import {configuration} from '../lib/config.mjs';
import {emptyState, memoryStore, postgresStore} from '../lib/store.mjs';
import {hash} from '../lib/auth.mjs';
import {activitySelection, memoryActivityPage, sqlActivityPage} from '../lib/activity-page.mjs';

const from='2026-11-16T08:00:00.000Z', until='2026-11-17T08:00:00.000Z';
const window=`from=${from}&until=${until}`;
function fixture() {
  const state=emptyState();
  state.projects=[{id:'app',archived:true},{id:'other'}];
  state.activity=Array.from({length:235},(_,i)=>({id:randomUUID(),time:'2026-11-16T18:00:00.000Z',project:'app',ticket:'original-imported-id',actorId:'owner',action:'updated ticket',private:'not returned'}));
  state.activity.push({id:randomUUID(),time:from,project:'app'}, {id:randomUUID(),time:until,project:'app'},
    {id:randomUUID(),time:'2026-11-16T18:00:00.000Z',project:'other'}, {id:randomUUID(),time:from,project:null});
  return state;
}
function harness(state=fixture()) {
  const token=`plnr_${'a'.repeat(43)}`;
  state.agents=[{id:'reader',projects:['app'],tokenHash:hash(token),expiresAt:Date.parse(until)+10000}];
  const store=memoryStore(state), config=configuration({PLANNR_PASSWORD:'synthetic-password-only'});
  let now=Date.parse(until);
  const app=apiApplication(store,config,{now:()=>now});
  return {store,setNow:value=>now=value,send:(query=window,headers={authorization:`Bearer ${token}`})=>app({path:'/api/activity',query:new URLSearchParams(query),method:'GET',headers})};
}
test('scoped history traverses more than 100 rows with timestamp ties, preserves imports and excludes other projects',async()=>{
  const h=harness(),before=await h.store.read();let cursor=null,events=[];
  do {
    const result=await h.send(window+(cursor?'&cursor='+encodeURIComponent(cursor):''));
    assert.equal(result.status,200);assert.ok(result.body.activity.length<=100);
    assert.deepEqual(result.body.projectIds,['app']);events.push(...result.body.activity);cursor=result.body.nextCursor;
    assert.doesNotMatch(JSON.stringify(result.body),/private|not returned|tokenHash|original-secret/);
  } while(cursor);
  assert.equal(events.length,236);assert.equal(new Set(events.map(row=>row.id)).size,236);
  assert.ok(events.some(row=>row.ticket==='original-imported-id'));assert.deepEqual(await h.store.read(),before);
});
test('history requires fresh auth, strict windows, and cursors bound to actor, scope and filters',async()=>{
  const h=harness();assert.equal((await h.send(window,{})).status,401);
  for(const invalid of ['', 'from=bad&until='+until, `from=${until}&until=${from}`,`from=2026-01-01T00:00:00.000Z&until=${until}`])assert.equal((await h.send(invalid)).status,400);
  assert.equal((await h.send(window+'&project=other')).status,404);
  const first=(await h.send()).body, cursor=encodeURIComponent(first.nextCursor);
  assert.equal((await h.send(window+'&project=app&cursor='+cursor)).status,400);
  assert.equal((await h.send(window+'&cursor='+encodeURIComponent(first.nextCursor+'x'))).status,400);
  await h.store.transact(state=>state.agents[0].projects.push('other'));
  assert.equal((await h.send(window+'&cursor='+cursor)).status,400);
  await h.store.transact(state=>state.agents[0].revoked=true);
  assert.equal((await h.send(window+'&cursor='+cursor)).status,401);
});
test('a continued window excludes activity after its initial capture time',async()=>{
  const h=harness();h.setNow(Date.parse('2026-11-16T19:00:00Z'));
  const first=(await h.send()).body;
  await h.store.transact(state=>state.activity.push({id:randomUUID(),time:'2026-11-16T19:01:00.000Z',project:'app'}));
  h.setNow(Date.parse('2026-11-16T20:00:00Z'));
  const next=(await h.send(window+'&cursor='+encodeURIComponent(first.nextCursor))).body;
  assert.equal(next.asOf,first.asOf);assert.ok(next.activity.every(row=>row.time<=first.asOf));
});
test('Postgres history is a bounded read-only project query without loading the recent global audit window',async()=>{
  const queries=[],state=fixture(), token=`plnr_${'a'.repeat(43)}`;
  const client={release(){},async query(sql,params){
    queries.push({sql,params});
    if(sql.includes("kind IN ('project','agent','session')"))return {rows:[{kind:'project',data:state.projects[0]},
      {kind:'agent',data:{id:'reader',projects:['app'],tokenHash:hash(token),expiresAt:Date.parse(until)+10000}}]};
    return {rows:[]};
  }};
  const store=postgresStore('postgresql://unused.local/fixture',{pool:{on(){},connect:async()=>client}});
  const app=apiApplication(store,configuration({PLANNR_PASSWORD:'synthetic-password-only'}),{now:()=>Date.parse(until)});
  assert.equal((await app({path:'/api/activity',query:new URLSearchParams(window),method:'GET',headers:{authorization:`Bearer ${token}`}})).status,200);
  const read=queries.find(q=>q.sql.includes('FROM project_plannr.audit'));
  assert.deepEqual(read.params.slice(0,3),[['app'],from,until]);assert.match(read.sql,/LIMIT 101/);
  assert.equal(queries.filter(q=>q.sql.includes('FROM project_plannr.audit')).length,1);
  assert.ok(queries.some(q=>q.sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));
  assert.ok(queries.every(q=>!/^\s*(INSERT|UPDATE|DELETE)/.test(q.sql)));
});
test('file and SQL history return the same ordered pages using real disposable PostgreSQL semantics',async()=>{
  const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
  try {
    await db.exec('CREATE SCHEMA project_plannr; CREATE TABLE project_plannr.audit(id uuid, happened_at timestamptz, project_id text, data jsonb)');
    const state=fixture();
    for(const row of state.activity)await db.query('INSERT INTO project_plannr.audit VALUES($1,$2,$3,$4)',[row.id,row.time,row.project,JSON.stringify(row)]);
    let params=new URLSearchParams(window),cursor=null;
    do {
      if(cursor)params.set('cursor',cursor);
      const selection=activitySelection(state,{id:'reader',owner:false,projects:['app']},params,Date.parse(until),'fixture-signing-key');
      const memory=memoryActivityPage(state,selection),sql=await sqlActivityPage(db,selection);
      assert.deepEqual(sql,memory);cursor=sql.nextCursor;
    } while(cursor);
  } finally {await db.close();}
});
