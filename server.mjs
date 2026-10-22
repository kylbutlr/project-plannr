import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {configuration, loadLocalEnv} from './lib/config.mjs';
import {emptyState, fileStore, memoryStore, postgresStore} from './lib/store.mjs';
import {HttpError} from './lib/auth.mjs';
import {apiApplication, bodyJSON, securityHeaders} from './lib/api.mjs';
import {demoState} from './lib/demo.mjs';

const root = new URL('./', import.meta.url);
const files = new Map([['/', 'prototype.html'], ['/prototype.html', 'prototype.html'], ['/board.js', 'board.js'], ['/board-client.js', 'board-client.js'], ['/ticket-priority.js', 'ticket-priority.js'], ['/ticket-checklist.js', 'ticket-checklist.js'], ['/board.css', 'board.css'],
  ['/tokens.css', 'vendor/app-stylr/adapters/css/app-stylr.css'], ['/sans.woff2', 'vendor/app-stylr/assets/fonts/Geist-Variable.woff2'],
  ['/app-icon.svg', 'assets/app-icon.svg'], ['/favicon-16.png', 'assets/favicon-16.png'], ['/favicon-32.png', 'assets/favicon-32.png']]);
export function application(store, config, dependencies = {}) {
  const api = apiApplication(store, config, dependencies);
  return async (req, res) => {
    try {
      const host = new URL(config.origin).host;
      if (!(config.mode === 'demo' ? [host, host.replace('127.0.0.1', 'localhost')] : [host]).includes(req.headers.host)) throw new HttpError(403, 'Use the configured Project Plannr origin.');
      const path = new URL(req.url, config.origin).pathname;
      if (req.method === 'GET' && files.has(path)) {
        const file = new URL(files.get(path), root), content = await readFile(file), ext = fileURLToPath(file).split('.').pop();
        res.writeHead(200, {...securityHeaders, 'Content-Type': {html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', woff2: 'font/woff2', svg: 'image/svg+xml', png: 'image/png'}[ext]});
        res.end(content); return;
      }
      const result = await api({path, query: new URL(req.url, config.origin).searchParams, method: req.method, headers: req.headers, body: max => bodyJSON(req, req.headers, max), ip: req.socket.remoteAddress});
      res.writeHead(result.status, {...securityHeaders, 'Content-Type': 'application/json', ...result.headers});
      res.end(JSON.stringify(result.body));
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(error instanceof HttpError ? error.status : 503, {...securityHeaders, 'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: error instanceof HttpError ? error.message : 'The workspace is temporarily unavailable. Check configuration and database connectivity, then retry.'}));
      } else res.end();
    }
  };
}
async function start() {
  loadLocalEnv(); const config = configuration();
  const store = config.mode === 'demo' ? memoryStore(demoState()) : config.databaseUrl ? postgresStore(config.databaseUrl) : await fileStore(config.dataFile, emptyState());
  const server = createServer(application(store, config)); server.requestTimeout = 20000; server.headersTimeout = 15000;
  server.on('error', async error => {console.error(error.code === 'EADDRINUSE' ? 'Port is already in use. Choose another port; do not stop other previews.' : 'Server could not start.'); await store.close(); process.exitCode = 1;});
  server.listen(config.port, '127.0.0.1', () => console.log(`Project Plannr: ${config.origin}/\n${config.mode === 'demo' ? 'Disposable demo. Data resets on restart.' : `Private workspace. ${config.databaseUrl ? 'Development database' : 'Local file'} storage; ${config.authConfigured ? 'owner sign-in configured' : 'sign-in setup required'}.`}\nCtrl+C stops only this server.`));
  let closing = false;
  const stop = () => {if (closing) return; closing = true; server.close(async () => {await store.close();}); server.closeIdleConnections();};
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await start();
