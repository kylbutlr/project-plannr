// Local regression checks. Start and stop only this script's own isolated server.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const port=4207,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[new URL('server.mjs',import.meta.url).pathname],{env:{...process.env,PLANNR_MODE:'demo',DATABASE_URL:'',PLANNR_ORIGIN:base,PROJECT_PLANNR_PORT:String(port)},stdio:['ignore','pipe','pipe']});
async function send(path,method='GET',body,headers={}){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify({actor:'Regression check',...body})});
 return {status:response.status,body:await response.json()};
}
try{
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Isolated test server did not start.')),5000);
  server.stdout.once('data',()=>{clearTimeout(timer);resolve();});
  server.once('error',error=>{clearTimeout(timer);reject(error);});
  server.once('exit',code=>{clearTimeout(timer);reject(Error(`Test server exited with ${code}. Port ${port} must be free.`));});
  server.stderr.on('data',chunk=>process.stderr.write(chunk));
 });
 const original=(await send('/api/state')).body;
 const page=await fetch(base+'/');assert.equal(page.status,200);assert.match(await page.text(),/<title>Project Plannr<\/title>/);
 for(const path of ['/board.js','/board.css','/tokens.css','/sans.woff2','/app-icon.svg','/favicon-16.png','/favicon-32.png']){
  const asset=await fetch(base+path);assert.equal(asset.status,200,path);assert.ok((await asset.arrayBuffer()).byteLength>0,path);
 }
 assert.equal(original.projects.length,2);
 assert.ok(original.projects.every(p=>p.kind==='game'&&!p.archived&&p.revision===1));
 const created=await send('/api/projects','POST',{name:'Test app',kind:'app'});
 assert.equal(created.status,201);const id=created.body.id;
 const madeTicket=await send('/api/tickets','POST',{project:id,title:'Keep this ticket'});
 assert.equal(madeTicket.status,201);const ticketId=madeTicket.body.id;
 const rename=await send(`/api/projects/${id}`,'PATCH',{revision:1,name:'Renamed app',kind:'other'});
 assert.equal(rename.status,200);assert.equal(rename.body.id,id);assert.equal(rename.body.kind,'other');
 assert.equal((await send(`/api/projects/${id}`,'PATCH',{revision:1,name:'Stale name'})).status,409);
 assert.equal((await send(`/api/projects/${id}`,'PATCH',{revision:2,name:'Bad update',kind:'invalid'})).status,400);
 assert.equal((await send('/api/projects','POST',{name:'RENAMED APP',kind:'game'})).status,400);
 assert.equal((await send(`/api/projects/${id}`,'PATCH',{revision:2,archived:'yes'})).status,400);
 const archived=await send(`/api/projects/${id}`,'PATCH',{revision:2,archived:true});assert.equal(archived.status,200);
 assert.equal((await send('/api/tickets','POST',{project:id,title:'Blocked'})).status,409);
 assert.equal((await send(`/api/tickets/${ticketId}`,'PATCH',{revision:1,status:'completed'})).status,409);
 const afterArchive=(await send('/api/state')).body;
 assert.equal(afterArchive.projects.find(p=>p.id===id).name,'Renamed app');
 assert.equal(afterArchive.tickets.find(t=>t.id===ticketId).project,id);
 assert.ok(afterArchive.activity.some(a=>a.action==='archived project'));
 assert.equal((await send(`/api/projects/${id}`,'PATCH',{revision:3,archived:false})).status,200);
 const claims=await Promise.all([send(`/api/tickets/${ticketId}/claim`,'POST',{revision:1,actor:'Agent one'}),send(`/api/tickets/${ticketId}/claim`,'POST',{revision:1,actor:'Agent two'})]);
 assert.deepEqual(claims.map(c=>c.status).sort(),[200,409]);
 assert.equal((await send(`/api/tickets/${ticketId}`,'PATCH',{revision:1,status:'completed'})).status,409);
 assert.equal((await send('/api/projects','POST',{name:'Cross-origin',kind:'app'},{Origin:'https://example.com'})).status,403);
 assert.equal((await send('/api/state')).body.projects.length,3);
 console.log('PASS: project CRUD, stable ticket links, archive/restore, stale writes, validation atomicity, competing claims and origin guard.');
}finally{
 if(server.exitCode===null){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));}
}
