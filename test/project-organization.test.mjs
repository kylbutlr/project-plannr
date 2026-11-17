import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {orderedProjects as order, projectType, parseProjectTypes, readProjectPreferences, saveProjectPreferences} from '../project-organization.js';
import {projectMetadata, readProjectActivity} from '../lib/project-metadata.mjs';
import {emptyState, memoryStore, postgresStore} from '../lib/store.mjs';
import {apiApplication} from '../lib/api.mjs';
import {configuration} from '../lib/config.mjs';
import {hash} from '../lib/auth.mjs';

const types=[{id:'client',label:'Client work'},{id:'internal',label:'Internal'}];
const orderedProjects=(projects,preferences)=>order(projects,preferences,types);
const configured=extra=>configuration({PLANNR_PROJECT_TYPES:JSON.stringify(types),...extra});
const projects = [
  {id:'z',name:'Zebra',kind:'app',type:'client',revision:1,updatedAt:'2026-11-01T12:00:00.000Z'},
  {id:'a',name:'Atlas',kind:'game',type:'internal',revision:1,updatedAt:'2026-11-02T12:00:00.000Z'},
  {id:'b',name:'Beta',kind:'other',revision:1},
];
const ids = rows => rows.map(row => row.id);
function harness(initial=emptyState(), config=configured({PLANNR_AUTH_MODE:'none'})) {
  const store=memoryStore(initial);let now=1000000;
  const app=apiApplication(store,config,{now:()=>now});
  return {store,advance:value=>now+=value,send:(path,method='GET',body,headers={origin:config.origin,'x-csrf-token':config.localCsrf})=>{
    const url=new URL(path,'http://fixture');return app({path:url.pathname,query:url.searchParams,method,body:async()=>body,headers});
  }};
}
test('project sorting is independent of kind and filtering, with stable ties and unassigned legacy types',()=>{
  const before=structuredClone(projects);
  assert.deepEqual(ids(orderedProjects(projects)),['a','z','b']);
  assert.deepEqual(ids(orderedProjects(projects,{sort:'alphabetical'})),['a','b','z']);
  assert.deepEqual(ids(orderedProjects(projects,{sort:'type'})),['z','a','b']);
  for(const sort of ['recent','alphabetical','type'])assert.deepEqual(ids(orderedProjects(projects,{type:'internal',sort})),['a']);
  assert.deepEqual(ids(orderedProjects(projects,{type:'client',sort:'alphabetical'})),['z']);
  assert.deepEqual(ids(orderedProjects([{...projects[0],updatedAt:projects[1].updatedAt},projects[1]])),['a','z']);
  assert.equal(projectType({type:['internal']}),null);assert.deepEqual(projects,before);
});
test('project preferences persist safely and default to Recent and All types',()=>{
  const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  assert.deepEqual(readProjectPreferences(storage,types),{type:'all',sort:'recent'});
  assert.equal(saveProjectPreferences(storage,{type:'internal',sort:'alphabetical'},types),true);
  assert.deepEqual(readProjectPreferences(storage,types),{type:'internal',sort:'alphabetical'});
  assert.equal(saveProjectPreferences({setItem(){throw Error();}},{}),false);
  assert.deepEqual(readProjectPreferences({getItem(){throw Error();}}),{type:'all',sort:'recent'});
});
test('Configured types persist with project kind, stale-write protection and atomic type validation',async()=>{
  const h=harness();let p=(await h.send('/api/projects','POST',{name:'Fixture',kind:'game',type:'internal'})).body;
  assert.equal(p.type,'internal');assert.equal(p.kind,'game');assert.ok(p.updatedAt);
  const t=(await h.send('/api/tickets','POST',{project:p.id,title:'Preserved ticket'})).body;
  for(const type of ['work',['internal'],{},17]){
    const before=await h.store.read();assert.equal((await h.send(`/api/projects/${p.id}`,'PATCH',{revision:1,type})).status,400);
    assert.deepEqual(await h.store.read(),before);
  }
  p=(await h.send(`/api/projects/${p.id}`,'PATCH',{revision:1,type:'client'})).body;
  assert.equal(p.type,'client');assert.equal(p.kind,'game');assert.equal(p.revision,2);
  assert.equal((await h.send(`/api/projects/${p.id}`,'PATCH',{revision:1,type:'internal'})).status,409);
  await h.send(`/api/projects/${p.id}`,'PATCH',{revision:2,archived:true});
  await h.send(`/api/projects/${p.id}`,'PATCH',{revision:3,archived:false});
  const saved=(await h.send('/api/state')).body;assert.equal(saved.projects[0].type,'client');assert.equal(saved.tickets[0].id,t.id);
});
test('project and ticket work advances Recent but renewing a claim does not',async()=>{
  const h=harness(),p=(await h.send('/api/projects','POST',{name:'Activity fixture',kind:'app'})).body;
  h.advance(1000);const ticket=(await h.send('/api/tickets','POST',{project:p.id,title:'Work'})).body;
  assert.ok(Date.parse(ticket.updatedAt)>Date.parse(p.updatedAt));
  const agent=(await h.send('/api/agents','POST',{name:'Fixture agent',projects:[p.id]})).body,headers={authorization:`Bearer ${agent.token}`};
  h.advance(1000);await h.send(`/api/tickets/${ticket.id}/claim`,'POST',{revision:1},headers);
  const before=(await h.send('/api/state')).body.projects[0].updatedAt;
  h.advance(1000);await h.send(`/api/tickets/${ticket.id}/renew`,'POST',{revision:2},headers);
  assert.equal((await h.send('/api/state')).body.projects[0].updatedAt,before);
  h.advance(1000);await h.send(`/api/tickets/${ticket.id}`,'PATCH',{revision:3,comment:'Reviewed work'},headers);
  const after=(await h.send('/api/state')).body.projects[0].updatedAt;assert.ok(Date.parse(after)>Date.parse(before));
  assert.equal((await h.send(`/api/projects/${p.id}`,'PATCH',{revision:1,type:'internal'},headers)).status,403);
  await h.store.transact(state=>{state.activity=[];});
  assert.equal((await h.send('/api/state')).body.projects[0].updatedAt,after);
});
function fixture() {
  const state=emptyState();state.projects=structuredClone(projects);
  state.tickets=projects.flatMap((p,i)=>Array.from({length:23},(_,n)=>({id:`PLNR-${i*23+n+1}`,project:p.id,title:'Searchable fixture',description:'',status:'completed',completedAt:'2026-11-01T12:00:00.000Z',revision:1,priority:n,comments:[]})));
  return state;
}
test('type filters cover every board view, search, history and cursors while retaining authorization',async()=>{
  const state=fixture(),token=`plnr_${'e'.repeat(43)}`;state.agents=[{id:'agent',projects:['a','b'],tokenHash:hash(token),expiresAt:10**15}];
  const h=harness(state,configured({PLANNR_PASSWORD:'fixture-only'})),headers={authorization:`Bearer ${token}`};
  for(const view of ['swimlanes','kanban','queue']){
    const path=`/api/board?view=${view}&projectType=internal&q=Searchable&searchScope=all${view==='queue'?'':'&paging=lanes'}`;
    const response=await h.send(path,'GET',undefined,headers);assert.equal(response.status,200);
    assert.deepEqual([...new Set(response.body.tickets.map(row=>row.project))],['a']);
    assert.deepEqual(ids(response.body.projects).sort(),['a','b']);
    if(view!=='queue'){
      const page=Object.values(response.body.lanes).find(row=>row.status==='completed'&&row.nextCursor);
      const query=new URLSearchParams({view,project:page.project,status:'completed',projectType:'internal',q:'Searchable',searchScope:'all',cursor:page.nextCursor});
      assert.equal((await h.send('/api/lane?'+query,'GET',undefined,headers)).status,200);
      query.set('projectType','all');assert.equal((await h.send('/api/lane?'+query,'GET',undefined,headers)).status,400);
    }else{
      const query=new URLSearchParams({projectType:'internal',q:'Searchable',searchScope:'all',cursor:response.body.completed.nextCursor});
      assert.equal((await h.send('/api/completed?'+query,'GET',undefined,headers)).status,200);
      query.set('projectType','all');assert.equal((await h.send('/api/completed?'+query,'GET',undefined,headers)).status,400);
    }
  }
  assert.equal((await h.send('/api/board?projectType=bogus','GET',undefined,headers)).status,400);
  assert.equal((await h.send('/api/board?project=z&projectType=internal','GET',undefined,headers)).status,404);
  assert.equal((await h.send('/api/board?projectType=internal','GET',undefined,{})).status,401);
  const legacy=(await h.send('/api/board?projectType=unassigned','GET',undefined,headers)).body;
  assert.ok(legacy.tickets.every(row=>row.project==='b'));
});
test('legacy Recent ordering survives the 100-row feed in disposable PostgreSQL and matches memory',async()=>{
  const {PGlite}=await import('@electric-sql/pglite'),db=new PGlite();
  try {
    await db.exec('CREATE SCHEMA project_plannr; CREATE TABLE project_plannr.audit(id uuid, happened_at timestamptz, project_id text, data jsonb)');
    const old={id:randomUUID(),project:'a',time:'2026-01-01T12:00:00.000Z',action:'updated ticket'};
    const events=[old,...Array.from({length:120},()=>({id:randomUUID(),project:'b',time:'2026-11-01T12:00:00.000Z',action:'updated ticket'})),{id:randomUUID(),project:'a',time:'2026-11-16T12:00:00.000Z',action:'renew work claim'}];
    for(const row of events)await db.query('INSERT INTO project_plannr.audit VALUES($1,$2,$3,$4)',[row.id,row.time,row.project,JSON.stringify(row)]);
    const legacy=projects.map(({updatedAt,...row})=>row),sql={projects:legacy,activity:[]};let reads=0;
    await readProjectActivity({query:async(...args)=>{reads++;return db.query(...args);}},sql);
    assert.equal(reads,1);assert.equal(sql.activity.length,100);assert.ok(!sql.activity.some(row=>row.id===old.id));
    assert.deepEqual(projectMetadata(sql),projectMetadata({projects:legacy,activity:events}));
    assert.equal(projectMetadata(sql).find(row=>row.id==='a').updatedAt,old.time);
    assert.deepEqual(ids(orderedProjects(projectMetadata(sql))),['b','a','z']);
  } finally {await db.close();}
});

test('types default off and preserve stored assignments through edits, archive and reads',async()=>{
  const initial=fixture(), h=harness(initial,configuration({PLANNR_AUTH_MODE:'none'}));
  assert.deepEqual((await h.send('/api/session')).body.projectTypes,[]);
  assert.deepEqual((await h.send('/api/state')).body.projects.map(row=>row.type),['client','internal',null]);
  assert.equal((await h.send('/api/board?projectType=client')).status,400);
  const renamed=await h.send('/api/projects/a','PATCH',{revision:1,name:'Renamed'});
  assert.equal(renamed.status,200);assert.equal(renamed.body.type,'internal');
  assert.equal((await h.send('/api/projects/a','PATCH',{revision:2,type:'client'})).status,400);
  assert.equal((await h.send('/api/projects/a','PATCH',{revision:2,archived:true})).body.type,'internal');
  assert.deepEqual((await h.store.read()).tickets,initial.tickets);
  const created=await h.send('/api/projects','POST',{name:'No type required',kind:'app'});
  assert.equal(created.status,201);assert.equal(created.body.type,null);
  assert.deepEqual(order(projects,{type:'internal',sort:'alphabetical'}).map(row=>row.id),['a','b','z']);
});
test('configuration accepts custom labels/order, rejects malformed settings, and stale preferences recover',()=>{
  assert.deepEqual(configuration({}).projectTypes,[]);
  assert.deepEqual(parseProjectTypes('[]'),[]);
  assert.deepEqual(parseProjectTypes('[{"id":"design","label":" Design & review "}]'),[{id:'design',label:'Design & review'}]);
  for(const value of ['{}','null','[null]','[1]','["client"]','[{}]','broken',
    '[{"id":"all","label":"All"}]','[{"id":"unassigned","label":"None"}]',
    '[{"id":"Has Space","label":"Label"}]','[{"id":"client","label":""}]',
    '[{"id":"client","label":"A"},{"id":"client","label":"B"}]'])assert.throws(()=>configured({PLANNR_PROJECT_TYPES:value}));
  const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  saveProjectPreferences(storage,{type:'internal',sort:'type'},types);
  assert.deepEqual(readProjectPreferences(storage),{type:'all',sort:'recent'});
  assert.deepEqual(readProjectPreferences(storage,[{id:'client',label:'Renamed'}]),{type:'all',sort:'type'});
  assert.deepEqual(ids(order(projects,{sort:'type'},[...types].reverse())),['a','z','b']);
});
test('renamed and retired categories preserve IDs, with explicit reassignment or Unassigned',async()=>{
  const h=harness(fixture(),configured({PLANNR_AUTH_MODE:'none',PLANNR_PROJECT_TYPES:'[{"id":"client","label":"Customer projects"}]'}));
  assert.deepEqual((await h.send('/api/session')).body.projectTypes,[{id:'client',label:'Customer projects'}]);
  const before=await h.store.read();
  assert.equal((await h.send('/api/projects/a','PATCH',{revision:1,name:'Keep retired category',type:'internal'})).body.type,'internal');
  const filtered=(await h.send('/api/board?projectType=unassigned&paging=lanes&view=swimlanes')).body;
  assert.deepEqual([...new Set(filtered.tickets.map(row=>row.project))].sort(),['a','b']);
  assert.equal((await h.send('/api/projects/a','PATCH',{revision:2,type:null})).body.type,null);
  assert.equal((await h.send('/api/projects/a','PATCH',{revision:3,type:'client'})).body.type,'client');
  assert.deepEqual((await h.store.read()).tickets,before.tickets);
});
