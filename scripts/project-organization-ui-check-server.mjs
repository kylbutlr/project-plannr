// Disposable public UI fixture. No .env, private files, database or external calls.
import {createServer} from 'node:http';
import {application} from '../server.mjs';
import {configuration} from '../lib/config.mjs';
import {emptyState, memoryStore} from '../lib/store.mjs';

const port = 4205;
const config = configuration({PLANNR_MODE: 'demo', PROJECT_PLANNR_PORT: String(port),
  PLANNR_PROJECT_TYPES: process.argv.includes('--types') ? JSON.stringify([
    {id: 'client', label: 'Client work'}, {id: 'internal', label: 'Internal'}, {id: 'research', label: 'Research'}]) : ''});
const state = emptyState();
state.projects = [
  {id:'zebra',name:'Zebra',kind:'app',type:'client',updatedAt:'2026-01-02T12:00:00Z'},
  {id:'atlas',name:'Atlas',kind:'game',type:'internal',updatedAt:'2026-01-03T12:00:00Z'},
  {id:'beta',name:'Beta',kind:'other'},
  {id:'delta',name:'Delta',kind:'app',type:'retired-category'},
].map(row=>({...row,revision:1,archived:false}));
for (const project of state.projects) {
  state.tickets.push({id:`DEMO-${++state.counter}`,project:project.id,title:`Review ${project.name} release`,
    description:'Fictional review fixture. No real project work.',status:'next',priority:1,revision:1,comments:[],
    checklist:[{id:'review',text:'Review the outcome',completed:false}],ownerId:null,leaseUntil:0});
}
state.tickets[1].parentId=state.tickets[0].id;state.tickets[1].project='zebra';
state.tickets[0].radarUrl='https://tracker.example.com/tickets/123';
const store=memoryStore(state),server=createServer(application(store,config));
const stop=()=>{server.close();server.closeIdleConnections();};
server.on('error',error=>{console.error(error.code);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Public project fixture pid=${process.pid}: ${config.origin}/ (types ${config.projectTypes.length?'enabled':'off'})`));
setTimeout(stop,600000).unref();
process.once('SIGINT',stop);process.once('SIGTERM',stop);
