// Disposable local UI fixture. Never loads .env, opens storage, or calls Neon.
import {createServer} from 'node:http';
import {application} from '../server.mjs';
import {configuration} from '../lib/config.mjs';
import {memoryStore} from '../lib/store.mjs';
import {demoState} from '../lib/demo.mjs';

const port = Number(process.argv[2] || 4208);
const config = configuration({PLANNR_MODE: 'demo', PROJECT_PLANNR_PORT: String(port)}), state = demoState();
state.tickets.find(ticket=>ticket.id==='TF-DEMO-001').checklist=[
  {id:'reference',text:'Confirm the venue reference packet',completed:true},
  {id:'geometry',text:'Review geometry and visible pavement',completed:true},
  {id:'race',text:'Playtest a contact-enabled race',completed:false},
  {id:'owner',text:'Record owner review evidence',completed:false},
];
for (const project of ['worldrawn', 'track-forgr']) for (const status of ['next', 'in-progress']) for (let i=0;i<15;i++) state.tickets.push({
  id:`DEMO-${project}-${status}-${i}`,project,status,title:`Example ${status} task ${i+1}`,description:'Disposable column pagination fixture.',
  priority:i+10,revision:1,owner:null,ownerId:null,leaseUntil:0,comments:[]});
for (let i = 0; i < 45; i++) state.tickets.push({id: `DEMO-HISTORY-${i + 1}`, project: 'worldrawn',
  title: `Example completed work ${i + 1}`, description: i === 0 ? 'Searchable older history fixture.' : 'Disposable UI fixture, not real work.',
  status: 'completed', priority: i + 5, revision: 1, completedAt: new Date(1000000 + i * 1000).toISOString(),
  owner: null, ownerId: null, leaseUntil: 0, comments: []});
for (let i = 0; i < 35; i++) state.tickets.push({id: `DEMO-TRACK-HISTORY-${i + 1}`, project: 'track-forgr',
  title: `Example course work ${i + 1}`, description: 'Disposable UI fixture, not real work.',
  status: 'completed', priority: i + 5, revision: 1, completedAt: new Date(5000000 + i * 1000).toISOString(),
  owner: null, ownerId: null, leaseUntil: 0, comments: []});
const store = memoryStore(state), handle = application(store, config);
let failLaneOnce=process.argv.includes('--fail-lane-once');
const server = createServer((req,res)=>{
  const url=new URL(req.url,config.origin);
  if(url.pathname==='/responsive-fixture'){
    // A real 390px document viewport, when the browser's viewport override is unavailable.
    res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
    res.end('<!doctype html><html><head><title>Responsive board fixture</title></head><body style="margin:0;background:#101012"><iframe title="Mobile board" src="/?view=swimlanes&responsive-fixture=1" width="390" height="844" style="display:block;border:0"></iframe></body></html>');return;
  }
  if(url.pathname==='/'&&url.searchParams.get('responsive-fixture')==='1'){
    // Only this disposable in-memory fixture allows same-origin framing.
    // The real local/private and hosted applications retain frame-ancestors 'none'.
    const writeHead=res.writeHead;
    res.writeHead=function(status,headers){return writeHead.call(this,status,{...headers,
      'Content-Security-Policy':headers['Content-Security-Policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'")});};
  }
  if(failLaneOnce&&url.pathname==='/api/lane'&&url.searchParams.get('project')==='worldrawn'&&url.searchParams.get('status')==='completed'){
    failLaneOnce=false;res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({error:'Cannot load this column. Retry when your connection is restored.'}));return;
  }
  return handle(req,res);
});
server.listen(port, '127.0.0.1', () => console.log(`Disposable UI fixture: ${config.origin}/`));
// Optional bounded lifespan for Codex verification, without stopping any other server.
const lifetime=Number(process.argv[3]||0);
if(lifetime>0)setTimeout(()=>{server.close();server.closeIdleConnections();},lifetime).unref();
process.once('SIGINT', () => {server.close();server.closeIdleConnections();});
