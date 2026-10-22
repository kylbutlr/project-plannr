import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configuration} from '../lib/config.mjs';
import {memoryStore} from '../lib/store.mjs';
import defaultHandler, {netlifyApplication, config as routing} from '../netlify/functions/workspace.mjs';

const password = 'test-only-hosted-password';
function settings() {
  return configuration({PLANNR_ORIGIN: 'https://plannr.example', PLANNR_PASSWORD: password,
    PLANNR_DATABASE_BRANCH: 'development', PLANNR_DATABASE_HOST: 'development.example', DATABASE_URL: 'postgresql://development.example/test'});
}
function request(path, {method = 'GET', body, headers = {}} = {}) {
  return new Request(`https://plannr.example${path}`, {method, headers: {'Content-Type': 'application/json', ...headers}, body: body === undefined ? undefined : JSON.stringify(body)});
}
test('Netlify adapter routes APIs and auth through the same private gate and secure session', async () => {
  assert.deepEqual(routing.path, ['/api/*', '/auth/*']);
  const store = memoryStore(), app = netlifyApplication(settings(), store), context = {ip: '192.0.2.1'};
  assert.equal((await app(request('/api/state'), context)).status, 401);
  const signedOut = await app(request('/api/session'), context); assert.equal((await signedOut.json()).user, null);
  const login = await app(request('/auth/login', {method: 'POST', body: {password}, headers: {Origin: 'https://plannr.example'}}), context);
  assert.equal(login.status, 200); assert.match(login.headers.get('set-cookie'), /^__Host-plannr=.*HttpOnly; SameSite=Lax; Secure$/);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const session = await (await app(request('/api/session', {headers: {cookie}}), context)).json();
  const headers = {cookie, Origin: 'https://plannr.example', 'X-CSRF-Token': session.csrf};
  assert.equal((await app(request('/api/projects', {method: 'POST', body: {name: 'Hosted adapter', kind: 'app'}, headers}), context)).status, 201);
  assert.equal((await (await app(request('/api/state', {headers: {cookie}}), context)).json()).projects.length, 1);
  const logout = await app(request('/auth/logout', {method: 'POST', body: {}, headers}), context);
  assert.equal(logout.status, 200); assert.match(logout.headers.get('set-cookie'), /Max-Age=0; Secure/);
  assert.equal((await app(request('/api/state', {headers: {cookie}}), context)).status, 401);
  assert.equal((await app(new Request('https://wrong.example/api/session'), context)).status, 403);
  await store.close();
});
test('Netlify throttling uses platform IP and shared storage, not a spoofable header', async () => {
  const store = memoryStore(), app = netlifyApplication(settings(), store), context = {ip: '192.0.2.1'};
  for (let i = 0; i < 5; i++) assert.equal((await app(request('/auth/login', {method: 'POST', body: {password: 'wrong'}, headers: {Origin: 'https://plannr.example', 'X-Forwarded-For': `192.0.2.${i + 10}`}}), context)).status, 401);
  const cold = netlifyApplication(settings(), store);
  assert.equal((await cold(request('/auth/login', {method: 'POST', body: {password}, headers: {Origin: 'https://plannr.example'}}), context)).status, 429);
  await store.close();
});
test('Netlify refuses demo, missing database and local transport; no local-file fallback', async () => {
  const store = memoryStore();
  assert.throws(() => netlifyApplication(configuration({PLANNR_MODE: 'demo'}), store), /Netlify requires/);
  assert.throws(() => netlifyApplication(configuration({PLANNR_PASSWORD: password}), store), /Netlify requires/);
  const response = await defaultHandler(request('/api/session'), {ip: '192.0.2.1'});
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /DATABASE_URL|postgresql:/);
  await store.close();
});
