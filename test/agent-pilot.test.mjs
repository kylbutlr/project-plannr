import {test} from 'node:test';
import assert from 'node:assert/strict';
import {agentCommand,agentResult} from '../lib/agent-command.mjs';
import {apiApplication} from '../lib/api.mjs';
import {configuration} from '../lib/config.mjs';
import {emptyState,memoryStore} from '../lib/store.mjs';
import {hash} from '../lib/auth.mjs';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {application} from '../server.mjs';

test('agent CLI supports explicit project backlog and exact-ticket reads, never automatic claims',()=>{
  const backlog=agentCommand(['backlog','worldrawn']);assert.equal(backlog.method,'GET');
  assert.equal(backlog.path,'/api/board?project=worldrawn&view=kanban');
  const result=agentResult(backlog,{projects:[{id:'worldrawn'}],tickets:[
    {id:'later',priority:2,status:'next'},{id:'done',priority:0,status:'completed'},{id:'first',priority:1,status:'next'}]});
  assert.deepEqual(result.tickets.map(t=>t.id),['first','later']);
  assert.deepEqual(agentCommand(['show','PLNR-1']),{path:'/api/tickets/PLNR-1',method:'GET'});
  for(const args of [['claim','PLNR-1'],['claim','PLNR-1','0'],['renew','PLNR-1','NaN'],['move','PLNR-1','1','review'],['note','PLNR-1','1','']])assert.throws(()=>agentCommand(args));
});

test('isolated Worldrawn pilot reads priority, claims, renews, records evidence, and leaves completion to the owner',async()=>{
  // Test-only token and projects, never a credential grant or ledger import.
  let now=1000000;
  const state=emptyState(),token=`plnr_${'c'.repeat(43)}`,config=configuration({PLANNR_PASSWORD:'test-only-workspace-password'});
  state.projects=[{id:'worldrawn',name:'Worldrawn pilot fixture',kind:'game',revision:1,archived:false},{id:'other',name:'Other fixture',kind:'app',revision:1,archived:false}];
  state.tickets=[{id:'PILOT-1',project:'worldrawn',title:'Illustrative pilot only',description:'No real game work or ledger state.',priority:1,status:'next',revision:1,ownerId:null,leaseUntil:0,comments:[]},
    {id:'PRIVATE-1',project:'other',title:'Other fixture',status:'next',revision:1,priority:1,comments:[]}];
  state.agents=[{id:'pilot',name:'Worldrawn pilot',projects:['worldrawn'],tokenHash:hash(token),expiresAt:9999999,revoked:false}];
  const store=memoryStore(state),handle=apiApplication(store,config,{now:()=>now}),headers={authorization:`Bearer ${token}`};
  const send=async(command,key)=>{const url=new URL(command.path,config.origin);return handle({path:url.pathname,query:url.searchParams,method:command.method,
    headers:{...headers,...(key?{'idempotency-key':key}:{})},body:async()=>command.body});};
  const backlog=await send(agentCommand(['backlog','worldrawn']));assert.equal(backlog.status,200);assert.equal(backlog.body.tickets.length,1);
  assert.equal((await send(agentCommand(['show','PRIVATE-1']))).status,404);
  let row=(await send(agentCommand(['show','PILOT-1']))).body;
  row=(await send(agentCommand(['claim',row.id,String(row.revision)]))).body;
  assert.equal(row.status,'in-progress');assert.equal(row.ownerId,'pilot');
  assert.equal((await send(agentCommand(['claim',row.id,'1']))).status,409);
  now+=120000;row=(await send(agentCommand(['renew',row.id,String(row.revision)]))).body;
  const note=agentCommand(['note',row.id,String(row.revision),'Ready for owner review. Evidence: https://example.com/pilot-fixture. Test-only, no real work.']);
  row=(await send(note,'pilot-evidence')).body;const replay=await send(note,'pilot-evidence');
  assert.equal(replay.status,200);assert.equal(replay.body.revision,row.revision);assert.equal(row.comments.length,1);
  assert.equal(row.status,'in-progress','pilot never marks work Completed automatically');
  const saved=await store.read();assert.equal(saved.tickets.find(t=>t.id==='PRIVATE-1').revision,1);
  assert.ok(saved.activity.some(a=>a.actor==='Worldrawn pilot'));
  now+=300001;
  assert.equal((await send(agentCommand(['note',row.id,String(row.revision),'Late note']))).status,409);
});

test('actual agent CLI reads the private scoped backlog and individual ticket over HTTP',async t=>{
  const token=`plnr_${'d'.repeat(43)}`,config=configuration({PLANNR_PASSWORD:'test-only-workspace-password'}),state=emptyState();
  state.projects=[{id:'worldrawn',name:'Worldrawn fixture',kind:'game',archived:false,revision:1}];
  state.tickets=[{id:'PILOT-1',project:'worldrawn',title:'Disposable CLI test',description:'No real work.',status:'next',priority:1,revision:1,comments:[]}];
  state.agents=[{id:'pilot',name:'Pilot',projects:['worldrawn'],tokenHash:hash(token),expiresAt:9999999,revoked:false}];
  const store=memoryStore(state),server=createServer(application(store,config,{now:()=>1000000}));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await store.close();});
  server.listen(0,'127.0.0.1');await once(server,'listening');config.origin=`http://127.0.0.1:${server.address().port}`;
  const run=promisify(execFile),entry=fileURLToPath(new URL('../agent.mjs',import.meta.url)),options={
    timeout:10000,env:{...process.env,PLANNR_MODE:'private',PLANNR_AGENT_TOKEN:token,PLANNR_AGENT_ORIGIN:config.origin}};
  const backlog=JSON.parse((await run(process.execPath,[entry,'backlog','worldrawn'],options)).stdout);
  assert.equal(backlog.tickets[0].id,'PILOT-1');
  const row=JSON.parse((await run(process.execPath,[entry,'show','PILOT-1'],options)).stdout);
  assert.equal(row.revision,1);assert.equal(row.status,'next');
  assert.equal((await store.read()).activity.length,0,'read-only CLI does not claim work or write activity');
});
