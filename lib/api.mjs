import {HttpError, audit, authenticate, cookie, cookieName, passwordAuth, requireActor, requireMutation, requireOwner} from './auth.mjs';
import {workspace} from './workspace.mjs';

export const securityHeaders = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};

export async function bodyJSON(stream, headers, maxBytes = 12000) {
  if (!/^application\/json(?:;|$)/i.test(headers['content-type'] || '')) throw new HttpError(415, 'Send JSON.');
  if (Number(headers['content-length']) > maxBytes) throw new HttpError(413, `Request too large. Limit is ${maxBytes} bytes.`);
  const chunks = []; let bytes = 0;
  for await (const chunk of stream || []) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new HttpError(413, `Request too large. Limit is ${maxBytes} bytes.`);
    chunks.push(Buffer.from(chunk));
  }
  try {return JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {throw new HttpError(400, 'Send valid JSON.');}
}

// Both local HTTP and Netlify adapters cross this same protected interface.
export function apiApplication(store, config, dependencies = {}) {
  const now = dependencies.now || Date.now, board = workspace(store, config, {now}), login = passwordAuth(store, config, {now});
  return async ({path, query = new URLSearchParams(), method, headers, body, ip}) => {
    try {
      if (method === 'GET' && path === '/api/session') {
        // Anonymous shell checks do not wake the database or read private rows.
        const actor = config.mode === 'demo' ? {name: 'Demo owner', owner: true} : (headers.cookie || config.passwordless) ? authenticate(await (store.readAccess?.() || store.read()), headers, config, now()) : null;
        return {status: 200, body: {mode: config.mode, authConfigured: config.authConfigured, authMode: config.authMode, storage: config.databaseUrl ? 'database' : 'local', user: actor?.owner ? {name: actor.name} : null, csrf: actor?.owner ? actor.csrf : undefined}};
      }
      if (method === 'POST' && path === '/auth/login') return await login(await body(), headers, ip);
      if (config.mode !== 'demo' && !config.passwordless && !headers.cookie && !headers.authorization) throw new HttpError(401, 'Sign in again to access this private workspace.');
      if (method === 'POST' && path === '/auth/logout') {
        await body();
        await store.transact(state => {
          const actor = requireActor(state, headers, config, now()); requireOwner(actor); requireMutation(headers, actor, config);
          state.sessions = state.sessions.filter(row => row.id !== actor.sessionId); audit(state, actor, 'Workspace', 'signed out', null, now());
        });
        return {status: 200, body: {signedOut: true}, headers: {'Set-Cookie': cookie(config, cookieName(config), '', 0)}};
      }
      if (method === 'GET' && path === '/api/state') return {status: 200, body: await board.read(headers)};
      if (method === 'GET' && (path === '/api/board' || path === '/api/completed')) return {status: 200, body: await board.board(headers, query, path === '/api/completed')};
      if (method === 'GET' && path === '/api/lane') return {status: 200, body: await board.lane(headers, query)};
      if (method === 'GET' && path === '/api/changes') return {status: 200, body: await board.changes(headers, query)};
      const ticketMatch = path.match(/^\/api\/tickets\/([^/]+)$/);
      if (method === 'GET' && ticketMatch) return {status: 200, body: await board.ticket(headers, decodeURIComponent(ticketMatch[1]))};
      if (method === 'GET' && path === '/api/agents') {
        const state = await store.read(); requireOwner(requireActor(state, headers, config, now()));
        return {status: 200, body: state.agents.map(({id, name, projects, expiresAt, revoked}) => ({id, name, projects, expiresAt, revoked}))};
      }
      if (['POST', 'PATCH'].includes(method) && path.startsWith('/api/')) {
        const importing = ['/api/imports/preview', '/api/imports/apply'].includes(path);
        if (importing) {
          const state = await (store.readAccess?.() || store.read()), actor = requireActor(state, headers, config, now());
          requireOwner(actor); requireMutation(headers, actor, config);
        }
        return await board.mutate(path, method, await body(importing ? 524288 : method === 'PATCH' && ticketMatch ? 262144 : 12000), headers);
      }
      throw new HttpError(404, 'Unknown workspace route.');
    } catch (error) {
      // Internal errors can contain credential-bearing URLs. Never echo them.
      return {status: error instanceof HttpError ? error.status : 503,
        body: {error: error instanceof HttpError ? error.message : 'The workspace is temporarily unavailable. Check configuration and database connectivity, then retry.'}};
    }
  };
}
