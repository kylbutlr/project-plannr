import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apiApplication} from '../lib/api.mjs';
import {configuration} from '../lib/config.mjs';
import {memoryStore} from '../lib/store.mjs';
import {hash} from '../lib/auth.mjs';
import {netlifyApplication} from '../netlify/functions/workspace.mjs';

const password = 'disposable-remember-session-password', start = 1000000, day = 86400000;
function fixture() {
  const config = configuration({PLANNR_PASSWORD: password, PLANNR_ORIGIN: 'https://plannr.example', PLANNR_DATABASE_BRANCH: 'development',
    PLANNR_DATABASE_HOST: 'development.example', DATABASE_URL: 'postgresql://development.example/test'}), store = memoryStore();
  let time = start;
  const makeApp = () => apiApplication(store, config, {now: () => time});
  const send = (path, method = 'GET', body, headers = {}, app = makeApp()) => app({path, method,
    headers: {origin: config.origin, ...headers}, body: async () => body, ip: 'fixture'});
  return {config, store, send, makeApp, at: value => {time = value;}};
}
const browserCookie = result => result.headers['Set-Cookie'].split(';')[0];

test('unchecked and omitted remember use session cookies with an absolute eight-hour server limit', async () => {
  for (const remember of [undefined, false]) {
    const h = fixture(), result = await h.send('/auth/login', 'POST', {password, ...(remember === undefined ? {} : {remember})});
    assert.equal(result.status, 200); assert.match(result.headers['Set-Cookie'], /HttpOnly; SameSite=Lax; Secure$/);
    assert.doesNotMatch(result.headers['Set-Cookie'], /Max-Age|Expires/);
    const headers = {cookie: browserCookie(result)};
    assert.equal((await h.store.read()).sessions[0].expiresAt, start + 8 * 3600000);
    h.at(start + 8 * 3600000 - 1); assert.ok((await h.send('/api/session', 'GET', undefined, headers)).body.user);
    h.at(start + 8 * 3600000); assert.equal((await h.send('/api/session', 'GET', undefined, headers)).body.user, null);
    assert.equal((await h.send('/api/state', 'GET', undefined, headers)).status, 401);
  }
});
test('remembered sessions survive fresh handlers and expire exactly 30 days after sign-in, not after last use', async () => {
  const h = fixture(), result = await h.send('/auth/login', 'POST', {password, remember: true});
  assert.equal(result.status, 200); assert.match(result.headers['Set-Cookie'], /^__Host-plannr=.*HttpOnly; SameSite=Lax; Max-Age=2592000; Secure$/);
  const headers = {cookie: browserCookie(result)}, raw = headers.cookie.split('=')[1], state = await h.store.read();
  assert.equal(state.sessions[0].id, hash(raw)); assert.equal(state.sessions[0].expiresAt, start + 30 * day);
  assert.doesNotMatch(JSON.stringify(state), new RegExp(`${password}|${raw}`));
  for (const age of [day, 29 * day, 30 * day - 1]) {
    h.at(start + age); const next = await h.send('/api/session', 'GET', undefined, headers, h.makeApp());
    assert.ok(next.body.user); assert.equal(next.headers, undefined, 'session checks do not renew browser expiry');
  }
  assert.equal((await h.store.read()).sessions[0].expiresAt, start + 30 * day);
  h.at(start + 30 * day); assert.equal((await h.send('/api/session', 'GET', undefined, headers)).body.user, null);
  assert.equal((await h.send('/api/state', 'GET', undefined, headers)).status, 401);
});
test('sign-out revokes remembered access, preserves another browser and enforces CSRF', async () => {
  const h = fixture(), first = await h.send('/auth/login', 'POST', {password, remember: true}), second = await h.send('/auth/login', 'POST', {password, remember: true});
  const cookie = browserCookie(first), session = (await h.send('/api/session', 'GET', undefined, {cookie})).body;
  assert.equal((await h.send('/auth/logout', 'POST', {}, {cookie})).status, 403);
  const logout = await h.send('/auth/logout', 'POST', {}, {cookie, 'x-csrf-token': session.csrf});
  assert.equal(logout.status, 200); assert.match(logout.headers['Set-Cookie'], /Max-Age=0; Secure$/);
  assert.equal((await h.send('/api/session', 'GET', undefined, {cookie})).body.user, null);
  assert.ok((await h.send('/api/session', 'GET', undefined, {cookie: browserCookie(second)})).body.user);
});
test('re-signing without remember rotates the old persistent session; password changes also invalidate it', async () => {
  const h = fixture(), first = await h.send('/auth/login', 'POST', {password, remember: true});
  const second = await h.send('/auth/login', 'POST', {password, remember: false}, {cookie: browserCookie(first)});
  assert.notEqual(browserCookie(first), browserCookie(second)); assert.doesNotMatch(second.headers['Set-Cookie'], /Max-Age/);
  assert.equal((await h.send('/api/session', 'GET', undefined, {cookie: browserCookie(first)})).body.user, null);
  const changed = apiApplication(h.store, {...h.config, passwordDigest: configuration({PLANNR_PASSWORD: 'different-fixture-password'}).passwordDigest}, {now: () => start});
  assert.equal((await h.send('/api/session', 'GET', undefined, {cookie: browserCookie(second)}, changed)).body.user, null);
});
test('invalid remember choices fail before writing sessions or bypassing the password gate', async () => {
  const h = fixture();
  for (const remember of ['true', 1, null, [], {}]) assert.equal((await h.send('/auth/login', 'POST', {password, remember})).status, 400);
  assert.deepEqual((await h.store.read()).sessions, []); assert.deepEqual((await h.store.read()).attempts, []);
  assert.equal((await h.send('/auth/login', 'POST', {password: 'wrong', remember: true})).status, 401);
  assert.deepEqual((await h.store.read()).sessions, []);
});
test('Netlify adapter issues the same persistent secure cookie and restores a fresh instance', async () => {
  const config = configuration({PLANNR_PASSWORD: password, PLANNR_ORIGIN: 'https://plannr.example', PLANNR_DATABASE_BRANCH: 'development',
    PLANNR_DATABASE_HOST: 'development.example', DATABASE_URL: 'postgresql://development.example/test'}), store = memoryStore();
  const request = (path, options = {}) => new Request(config.origin + path, options), context = {ip: 'fixture'};
  const login = await netlifyApplication(config, store)(request('/auth/login', {method: 'POST', headers: {Origin: config.origin, 'Content-Type': 'application/json'}, body: JSON.stringify({password, remember: true})}), context);
  assert.equal(login.status, 200); assert.match(login.headers.get('set-cookie'), /Max-Age=2592000; Secure$/);
  const next = await netlifyApplication(config, store)(request('/api/session', {headers: {cookie: login.headers.get('set-cookie').split(';')[0]}}), context);
  assert.ok((await next.json()).user);
});
