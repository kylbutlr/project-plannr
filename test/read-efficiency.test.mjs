import {test} from 'node:test';
import assert from 'node:assert/strict';
import {postgresStore} from '../lib/store.mjs';
import {apiApplication} from '../lib/api.mjs';
import {configuration} from '../lib/config.mjs';
import {hash} from '../lib/auth.mjs';

function harness() {
  const token = `plnr_${'a'.repeat(43)}`, queries = [];
  const records = [
    {kind:'project', data:{id:'fixture', name:'Fixture', kind:'app', revision:1, archived:false}},
    {kind:'agent', data:{id:'agent', name:'Fixture agent', tokenHash:hash(token), projects:['fixture'], expiresAt:200000, revoked:false}},
  ];
  const client = {release() {}, async query(sql, params) {
    queries.push({sql, params});
    if (sql.includes("kind IN ('project','agent','session')")) return {rows:records};
    if (sql.includes('FROM project_plannr.audit')) return {rows:[{data:{id:'audit', project:'fixture', action:'fixture activity'}}]};
    if (sql.includes('revision_sum')) return {rows:[{project_id:'fixture',ticket_count:'0',revision_sum:'0'}]};
    if (sql.includes('count(*)::integer AS total')) return {rows:[{total:0}]};
    if (sql.includes("kind='ticket' AND id=$1")) return {rows:[{data:{id:'PLNR-1',project:'fixture',revision:1}}]};
    return {rows:[]};
  }};
  const store = postgresStore('postgresql://unused.local/fixture', {pool:{on() {}, connect:async()=>client, end:async()=>{}}});
  const config = configuration({PLANNR_PASSWORD:'fixture-password-only'});
  const app = apiApplication(store, config, {now:()=>100000});
  return {queries, records, config, send:async (path, headers={authorization:`Bearer ${token}`,cookie:'fixture=only'})=>{
    queries.length=0; const url=new URL(path,'http://fixture');
    return app({path:url.pathname,query:url.searchParams,method:'GET',headers});
  }};
}

test('metadata, lane, history, ticket and access reads do not fetch unused audit records', async()=>{
  const h=harness();
  for (const path of ['/api/changes','/api/lane?project=fixture&status=next','/api/completed','/api/tickets/PLNR-1','/api/session']) {
    const response=await h.send(path); assert.equal(response.status,200,path);
    assert.equal(h.queries.filter(q=>q.sql.includes('FROM project_plannr.audit')).length,0,path);
    assert.ok(h.queries.some(q=>q.sql.includes('REPEATABLE READ READ ONLY')),path);
  }
  const board=await h.send('/api/board?paging=lanes');
  assert.equal(board.status,200); assert.equal(board.body.activity[0].id,'audit');
  assert.equal(h.queries.filter(q=>q.sql.includes('FROM project_plannr.audit')).length,1);
});

test('change checks keep fresh authorization, scope, token parity and a four-command transaction',async()=>{
  const h=harness();
  const board=await h.send('/api/board?paging=lanes');
  const changes=await h.send('/api/changes');
  assert.deepEqual(changes.body,{changeToken:board.body.changeToken});
  assert.equal(Buffer.byteLength(JSON.stringify(changes.body)),82);
  assert.equal(h.queries.length,4);
  assert.equal((await h.send('/api/changes?project=unassigned')).status,404);
  h.records[1].data.revoked=true;
  assert.equal((await h.send('/api/changes')).status,401);
  assert.equal(h.queries.at(-1).sql,'ROLLBACK');
});


test('owner session checks still verify the current session without fetching activity',async()=>{
  const h=harness(),raw='fixture-owner-session';
  const session={id:hash(raw),name:'Fixture owner',ownerId:h.config.ownerId,authVersion:h.config.passwordDigest,expiresAt:200000};
  h.records.push({kind:'session',data:session});
  const headers={cookie:`plannr_session=${raw}`};
  const active=await h.send('/api/session',headers);
  assert.equal(active.body.user.name,'Fixture owner');assert.ok(active.body.csrf);
  assert.equal(h.queries.length,3);
  session.expiresAt=100000;
  assert.equal((await h.send('/api/session',headers)).body.user,null);
  assert.equal(h.queries.length,3);
});
