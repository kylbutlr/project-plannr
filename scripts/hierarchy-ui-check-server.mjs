// Disposable demo, without .env, credentials, local ledgers or external calls.
import {createServer} from 'node:http';
import {application} from '../server.mjs';
import {configuration} from '../lib/config.mjs';
import {emptyState, memoryStore} from '../lib/store.mjs';
const port = 4208, config = configuration({PLANNR_MODE: 'demo', PROJECT_PLANNR_PORT: String(port)});
const state = emptyState();
state.projects = [{id: 'delivery-demo', name: 'Client delivery demo', kind: 'other', revision: 1, archived: false}];
function ticket(id, title, status = 'next', extra = {}) {
  const row = {id: `DEMO-${id}`, project: 'delivery-demo', title, description: 'Fictional verification data. No real client or project work.',
    status, priority: id, priorityLevel: 'P2', revision: 1, owner: null, ownerId: null, leaseUntil: 0, comments: [], checklist: [], ...extra};
  state.tickets.push(row); state.counter = Math.max(state.counter, id); return row;
}
ticket(1, 'Prepare the storefront release', 'next', {radarUrl: 'https://tracker.example.com/tickets/123', checklist: [{id: 'review', text: 'Record final owner review', completed: false}]});
ticket(2, 'Review the release notes'); ticket(3, 'Coordinate analytics checks');
ticket(4, 'Verify the mobile product page', 'in-progress', {parentId: 'DEMO-1'});
for (let id = 5; id <= 29; id++) ticket(id, `Completed delivery check ${id - 4}`, 'completed', {parentId: 'DEMO-1', completedAt: new Date(1000000 + id * 1000).toISOString()});
const store = memoryStore(state), server = createServer(application(store, config));
server.listen(port, '127.0.0.1', () => console.log(`Hierarchy fixture pid=${process.pid}: ${config.origin}/`));
const stop = () => {server.close(); server.closeIdleConnections();};
const timer = setTimeout(stop, 600000); timer.unref();
process.once('SIGINT', stop); process.once('SIGTERM', stop);
