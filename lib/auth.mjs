import {createHash, randomBytes, randomUUID, timingSafeEqual, scrypt} from 'node:crypto';
import {promisify} from 'node:util';

const derivePassword = promisify(scrypt);

export const hash = value => createHash('sha256').update(value).digest('hex');
export const secret = () => randomBytes(32).toString('base64url');
export const equal = (a, b) => typeof a === 'string' && typeof b === 'string' &&
  Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const cookieName = config => config.secure ? '__Host-plannr' : 'plannr_session';
export function cookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => {
    const index = part.indexOf('='); return index < 0 ? [] : [part.slice(0, index).trim(), part.slice(index + 1)];
  }).filter(part => part.length === 2));
}
export function cookie(config, name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax${maxAge === undefined ? '' : `; Max-Age=${maxAge}`}${config.secure ? '; Secure' : ''}`;
}
export function audit(state, actor, ticket, action, project = null, now = Date.now()) {
  state.activity.unshift({id: randomUUID(), actor: actor.name, actorId: actor.id, ticket, action, project, time: new Date(now).toISOString()});
}
export function authenticate(state, headers, config, now = Date.now()) {
  const authorization = headers.authorization;
  if (authorization) {
    if (!/^Bearer plnr_[A-Za-z0-9_-]{43}$/.test(authorization)) throw new HttpError(401, 'Invalid agent credential.');
    const agent = state.agents.find(row => equal(row.tokenHash, hash(authorization.slice(7))));
    if (!agent || agent.revoked || agent.expiresAt <= now) throw new HttpError(401, 'Agent credential expired, revoked, or unknown.');
    return {id: agent.id, name: agent.name, owner: false, projects: agent.projects};
  }
  if (config.passwordless) return {id: 'owner', name: 'Local owner', owner: true, csrf: config.localCsrf};
  const raw = cookies(headers.cookie)[cookieName(config)];
  if (!raw || !config.authConfigured) return null;
  const session = state.sessions.find(row => equal(row.id, hash(raw)) && row.expiresAt > now && row.ownerId === config.ownerId && equal(row.authVersion, config.passwordDigest));
  return session ? {id: 'owner', name: session.name, owner: true, sessionId: session.id, csrf: hash(`${raw}:csrf`)} : null;
}
export function requireActor(state, headers, config, now) {
  if (config.mode === 'demo') return {id: 'demo', name: 'Demo owner', owner: true};
  const actor = authenticate(state, headers, config, now);
  if (!actor) throw new HttpError(401, 'Sign in again to access this private workspace.');
  return actor;
}
export function requireOwner(actor) {
  if (!actor.owner) throw new HttpError(403, 'Only the workspace owner can manage projects or credentials.');
}
export function requireMutation(headers, actor, config) {
  if (config.mode === 'demo') {
    if (headers.origin && ![config.origin, config.origin.replace('127.0.0.1', 'localhost')].includes(headers.origin)) throw new HttpError(403, 'Cross-origin changes are blocked.');
    return;
  }
  if (actor.owner && (headers.origin !== config.origin || !equal(headers['x-csrf-token'], actor.csrf))) {
    throw new HttpError(403, 'This browser request failed its origin or CSRF check. Reload and try again.');
  }
  if (!actor.owner && headers.origin && headers.origin !== config.origin) throw new HttpError(403, 'Cross-origin changes are blocked.');
}
export function canAccess(actor, project) { return actor.owner || actor.projects.includes(project); }
export function requireProject(actor, project) {
  if (!canAccess(actor, project)) throw new HttpError(404, 'Project or ticket not found in your assigned projects.');
}

export function passwordAuth(store, config, {now = Date.now} = {}) {
  return async (body, headers, clientIP) => {
    if (config.mode === 'demo' || !config.authConfigured) throw new HttpError(503, 'Set the server-side workspace password before signing in.');
    if (headers.origin !== config.origin) throw new HttpError(403, 'Sign in from the configured Project Plannr address.');
    if (!body || typeof body.password !== 'string' || body.password.length > 256) throw new HttpError(400, 'Enter the workspace password.');
    if (body.remember !== undefined && typeof body.remember !== 'boolean') throw new HttpError(400, 'Remember me must be true or false.');
    const duration = body.remember === true ? 30 * 86400 : 8 * 3600;
    const timestamp = now(), window = 15 * 60000, address = hash(`login:${clientIP || 'unknown'}`);
    // Commit attempt counters even for rejected passwords. Shared across function instances.
    const result = await store.transact(async data => {
      data.attempts = (data.attempts || []).filter(row => row.expiresAt > timestamp);
      const global = data.attempts.find(row => row.id === 'global'), local = data.attempts.find(row => row.id === address);
      if ((global?.count || 0) >= 50 || (local?.count || 0) >= 5) return {limited: true};
      for (const id of ['global', address]) {
        const entry = data.attempts.find(row => row.id === id);
        if (entry) entry.count++;
        else data.attempts.push({id, count: 1, expiresAt: timestamp + window});
      }
      const digest = (await derivePassword(body.password, 'project-plannr:workspace-password:v1', 32)).toString('hex');
      if (!equal(digest, config.passwordDigest)) return {denied: true};
      const raw = secret(), prior = cookies(headers.cookie)[cookieName(config)];
      data.sessions = data.sessions.filter(row => row.expiresAt > timestamp && equal(row.authVersion, config.passwordDigest) && row.id !== hash(prior || ''));
      data.sessions.push({id: hash(raw), ownerId: config.ownerId, name: 'Workspace owner', authVersion: config.passwordDigest, expiresAt: timestamp + duration * 1000});
      data.attempts = data.attempts.filter(row => row.id !== address);
      audit(data, {id: 'owner', name: 'Workspace owner'}, 'Workspace', 'signed in', null, timestamp);
      return {raw};
    });
    if (result.limited) return {status: 429, body: {error: 'Too many sign-in attempts. Wait 15 minutes and try again.'}, headers: {'Retry-After': '900'}};
    if (result.denied) return {status: 401, body: {error: 'That password was not accepted. Try again.'}};
    return {status: 200, body: {signedIn: true}, headers: {'Set-Cookie': cookie(config, cookieName(config), result.raw, body.remember === true ? duration : undefined)}};
  };
}
