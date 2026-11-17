import {createHmac, timingSafeEqual} from 'node:crypto';
import {HttpError, canAccess, hash} from './auth.mjs';

export const activityPageSize = 100;
const compare = (a, b) => a.time < b.time ? 1 : a.time > b.time ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
const stamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const sign = (value, key) => createHmac('sha256', key).update(value).digest('hex');

export function activitySelection(state, actor, params, now, signingKey) {
  const from = params.get('from'), until = params.get('until'), project = params.get('project');
  if (!stamp(from) || !stamp(until) || from >= until || Date.parse(until) - Date.parse(from) > 31 * 86400000) {
    throw new HttpError(400, 'Choose an ISO UTC activity window of at most 31 days.');
  }
  const ids = state.projects.filter(row => canAccess(actor, row.id)).map(row => row.id).sort();
  if (project !== null && !ids.includes(project)) throw new HttpError(404, 'Project not found in your workspace.');
  const selected = project === null ? ids : [project];
  const scope = hash(JSON.stringify({actor: actor.id, ids, project, from, until}));
  let cursor = null;
  if (params.has('cursor')) {
    try {
      const token = params.get('cursor');
      if (token.length > 2000) throw Error();
      const [encoded, signature, extra] = token.split('.'), expected = sign(encoded, signingKey);
      if (extra || typeof signature !== 'string' || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw Error();
      cursor = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      if (cursor.scope !== scope || !stamp(cursor.asOf) || Date.parse(cursor.asOf) > now || !stamp(cursor.time)
          || cursor.time < from || cursor.time >= until || cursor.time > cursor.asOf || typeof cursor.id !== 'string' || !cursor.id || cursor.id.length > 120) throw Error();
    } catch {throw new HttpError(400, 'This activity page no longer matches its authorized scope or window. Start the read again.');}
  }
  return {ids: selected, from, until, scope, cursor, asOf: cursor?.asOf || new Date(now).toISOString(), signingKey};
}

export function activityPage(rows, selection) {
  const page = rows.slice(0, activityPageSize), last = page.at(-1);
  let nextCursor = null;
  if (rows.length > activityPageSize && last) {
    const encoded = Buffer.from(JSON.stringify({scope: selection.scope, asOf: selection.asOf, time: last.time, id: last.id})).toString('base64url');
    nextCursor = `${encoded}.${sign(encoded, selection.signingKey)}`;
  }
  // Project-scoped audit metadata only, never ticket bodies, notes or secrets.
  const activity = page.map(row => Object.fromEntries(['id', 'actor', 'actorId', 'ticket', 'action', 'project', 'time'].filter(key => row[key] !== undefined).map(key => [key, row[key]])));
  return {activity, nextCursor, projectIds: selection.ids, from: selection.from, until: selection.until, asOf: selection.asOf};
}

export function memoryActivityPage(state, selection) {
  const rows = state.activity.filter(row => selection.ids.includes(row.project) && stamp(row.time) && row.time >= selection.from
    && row.time < selection.until && row.time <= selection.asOf && (!selection.cursor || compare(row, selection.cursor) > 0)).sort(compare);
  return activityPage(rows, selection);
}

export async function sqlActivityPage(client, selection) {
  const rows = (await client.query(`SELECT data FROM project_plannr.audit
    WHERE project_id=ANY($1::text[]) AND happened_at >= $2::timestamptz AND happened_at < $3::timestamptz
    AND happened_at <= $4::timestamptz
    AND ($5::timestamptz IS NULL OR (happened_at, id::text COLLATE "C") < ($5::timestamptz, $6::text COLLATE "C"))
    ORDER BY happened_at DESC, id::text COLLATE "C" DESC LIMIT 101`,
  [selection.ids, selection.from, selection.until, selection.asOf, selection.cursor?.time ?? null, selection.cursor?.id ?? null])).rows.map(row => row.data);
  return activityPage(rows, selection);
}
