// Disposable private-mode UI fixture. No .env, disk store, hosted access or Neon.
import {createServer} from 'node:http';
import {application} from '../server.mjs';
import {configuration} from '../lib/config.mjs';
import {emptyState, memoryStore} from '../lib/store.mjs';

const port = Number(process.argv[2] || 4209);
const config = configuration({PROJECT_PLANNR_PORT: String(port), PLANNR_PASSWORD: 'fixture-only-workspace-password'}), state = emptyState();
state.projects = [{id: 'fixture', name: 'Disposable verification project', kind: 'app', archived: false, revision: 1}];
for (const status of ['next', 'in-progress', 'completed']) for (let i = 0; i < 16; i++) state.tickets.push({
  id: `PLNR-${++state.counter}`, project: 'fixture', status, title: `${status} example ${i + 1}`, description: 'Disposable verification only, not a real ticket.',
  priority: i + 1, ...(i % 5 === 4 ? {} : {priorityLevel: `P${(3 - i % 4)}`}), revision: 1, comments: [], ownerId: null, leaseUntil: 0,
  completedAt: status === 'completed' ? new Date(1000000 + i * 1000).toISOString() : null});
const store = memoryStore(state); let offset = 0;
const handle = application(store, config, {now: () => Date.now() + offset});
let pauseSession = process.argv.includes('--pause-session');
const pendingSessions = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, config.origin);
  if (req.method === 'POST' && url.pathname === '/verification/resume' && req.headers.origin === config.origin) {
    pauseSession = false; for (const resume of pendingSessions.splice(0)) resume();
    res.writeHead(200, {'Content-Type': 'application/json'}); res.end('{"resumed":true}'); return;
  }
  if (pauseSession && url.pathname === '/api/session') {pendingSessions.push(() => handle(req, res)); return;}
  if (req.method === 'POST' && url.pathname === '/verification/expire' && req.headers.origin === config.origin) {
    offset += 31 * 86400000; res.writeHead(200, {'Content-Type': 'application/json'}); res.end('{"expired":true}'); return;
  }
  if (url.pathname === '/responsive-fixture') {
    res.writeHead(200, {'Content-Type': 'text/html', 'Cache-Control': 'no-store'});
    res.end('<!doctype html><html><head><title>Mobile sign-in and priority fixture</title></head><body style="margin:0;background:#101012"><iframe title="Mobile board" src="/?view=swimlanes&responsive-fixture=1" width="390" height="844" style="display:block;border:0"></iframe></body></html>'); return;
  }
  if (url.pathname === '/' && url.searchParams.get('responsive-fixture') === '1') {
    const writeHead = res.writeHead;
    res.writeHead = function(status, headers) {return writeHead.call(this, status, {...headers,
      'Content-Security-Policy': headers['Content-Security-Policy'].replace("frame-ancestors 'none'", "frame-ancestors 'self'")});};
  }
  return handle(req, res);
});
server.listen(port, '127.0.0.1', () => console.log(`Disposable private fixture: ${config.origin}/ (fixture-only-workspace-password)`));
// Bound this verification process without stopping any other preview or app.
setTimeout(() => {server.close(); server.closeIdleConnections();}, Number(process.argv[3]) || 20 * 60000).unref();
