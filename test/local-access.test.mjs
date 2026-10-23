import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {application} from '../server.mjs';
import {configuration} from '../lib/config.mjs';
import {memoryStore} from '../lib/store.mjs';
import {netlifyApplication} from '../netlify/functions/workspace.mjs';

test('local passwordless owner retains CSRF, origin and credential boundaries', async t => {
  const config = configuration({PLANNR_AUTH_MODE: 'none'}), store = memoryStore();
  let handle;
  const server = createServer((...args) => handle(...args));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  config.origin = `http://127.0.0.1:${server.address().port}`;
  handle = application(store, config);
  t.after(async () => {server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await store.close();});
  const send = (path, method = 'GET', body, headers = {}) => fetch(config.origin + path, {method, headers: {'Content-Type': 'application/json', ...headers}, body: body === undefined ? undefined : JSON.stringify(body)});
  const session = await (await send('/api/session')).json();
  assert.equal(session.authMode, 'none'); assert.equal(session.user.name, 'Local owner'); assert.ok(session.csrf);
  assert.equal((await send('/api/state')).status, 200);
  const project = {name: 'Fictional project', kind: 'app'};
  assert.equal((await send('/api/projects', 'POST', project)).status, 403);
  assert.equal((await send('/api/projects', 'POST', project, {Origin: 'https://other.example', 'X-CSRF-Token': session.csrf})).status, 403);
  const saved = await send('/api/projects', 'POST', project, {Origin: config.origin, 'X-CSRF-Token': session.csrf});
  assert.equal(saved.status, 201);
  // A forged/expired agent token must never fall through to local owner access.
  assert.equal((await send('/api/state', 'GET', undefined, {Authorization: 'Bearer invalid'})).status, 401);
  assert.throws(() => netlifyApplication({...config, secure: true, databaseUrl: 'postgresql://fixture.example/db', authConfigured: true}, store), /Netlify requires/);
});

test('passwordless access is explicit and cannot expose the hosted adapter', () => {
  assert.equal(configuration({}).passwordless, false);
  assert.throws(() => configuration({PLANNR_AUTH_MODE: 'none', PLANNR_ORIGIN: 'https://planner.example'}), /loopback/);
  assert.throws(() => configuration({PLANNR_AUTH_MODE: 'none', NETLIFY: 'true'}), /loopback/);
  assert.throws(() => configuration({PLANNR_AUTH_MODE: 'none', PLANNR_PASSWORD: 'a-password-that-is-set'}), /Remove/);
  assert.throws(() => configuration({PLANNR_AUTH_MODE: 'invalid'}), /AUTH_MODE/);
});
