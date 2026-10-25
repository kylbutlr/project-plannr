import {mkdir, open, readFile, rename, unlink} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {sqlBoardPage} from './board-page.mjs';
import {sqlLanePage} from './lane-page.mjs';
import {sqlChanges} from './board-changes.mjs';

export const emptyState = () => ({counter: 0, projects: [], tickets: [], agents: [], sessions: [], attempts: [], replays: [], activity: []});
const collections = {project: 'projects', ticket: 'tickets', agent: 'agents', session: 'sessions', attempt: 'attempts', replay: 'replays'};

// One process owns a file store. Hosted/multi-process callers use Postgres instead.
export async function fileStore(path, initial = emptyState()) {
  if (!path) return memoryStore(initial);
  await mkdir(dirname(path), {recursive: true, mode: 0o700});
  const lock = await open(`${path}.lock`, 'wx', 0o600).catch(() => {
    throw Error('Local data is already locked. Stop its server before opening another. After a crash, verify no server is using this file before removing its .lock file.');
  });
  await lock.writeFile(String(process.pid));
  try {
    let state;
    try { state = JSON.parse(await readFile(path, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; state = initial; }
    const persist = async next => {
      const temp = `${path}.${randomUUID()}.tmp`;
      const file = await open(temp, 'wx', 0o600);
      try { await file.writeFile(JSON.stringify(next)); await file.sync(); }
      finally { await file.close(); }
      try { await rename(temp, path); }
      catch (error) { await unlink(temp).catch(() => {}); throw error; }
    };
    return memoryStore({...emptyState(), ...state}, persist, async () => { await lock.close(); await unlink(`${path}.lock`); });
  } catch (error) { await lock.close(); await unlink(`${path}.lock`); throw error; }
}

export function memoryStore(initial = emptyState(), persist = async () => {}, close = async () => {}) {
  let state = structuredClone(initial), queue = Promise.resolve();
  return {
    async read() { await queue; return structuredClone(state); },
    transact(fn) {
      const result = queue.then(async () => {
        const next = structuredClone(state), value = await fn(next);
        await persist(next); state = next; return structuredClone(value);
      });
      queue = result.catch(() => {}); return result;
    },
    async close() { await queue; await close(); },
  };
}

export function postgresStore(connectionString, {pool: suppliedPool} = {}) {
  // Certificate verification is explicit, including URLs with sslmode=require.
  const url = new URL(connectionString);
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  const pool = suppliedPool || new Pool({connectionString: url.toString(), ssl: {rejectUnauthorized: true}, max: 3,
    idleTimeoutMillis: 10000, connectionTimeoutMillis: 15000, statement_timeout: 15000});
  pool.on('error', () => console.error('Database connection closed unexpectedly. No credentials are logged.'));
  async function load(client) {
    const state = emptyState();
    const meta = await client.query('SELECT counter FROM project_plannr.workspace WHERE id = 1');
    if (!meta.rowCount) throw Error('Apply the Project Plannr migration first.');
    state.counter = Number(meta.rows[0].counter);
    for (const row of (await client.query('SELECT kind, data FROM project_plannr.entities ORDER BY id')).rows) {
      state[collections[row.kind]].push(row.data);
    }
    state.activity = (await client.query('SELECT data FROM project_plannr.audit ORDER BY happened_at DESC, id DESC LIMIT 100')).rows.map(row => row.data);
    return state;
  }
  async function transaction(fn, write) {
    const client = await pool.connect();
    try {
      await client.query(write ? 'BEGIN' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      // A single workspace lock makes validation, claims, revisions and audit atomic.
      if (write) await client.query('SELECT id FROM project_plannr.workspace WHERE id = 1 FOR UPDATE');
      const before = await load(client), next = structuredClone(before), result = await fn(next);
      if (write) {
        for (const [kind, collection] of Object.entries(collections)) {
          const previous = new Map(before[collection].map(row => [row.id, JSON.stringify(row)]));
          for (const row of next[collection]) {
            const data = JSON.stringify(row);
            if (previous.get(row.id) !== data) await client.query(
              'INSERT INTO project_plannr.entities(kind,id,project_id,data) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(kind,id) DO UPDATE SET project_id=excluded.project_id,data=excluded.data',
              [kind, row.id, row.project ?? null, data]);
            previous.delete(row.id);
          }
          for (const id of previous.keys()) await client.query('DELETE FROM project_plannr.entities WHERE kind=$1 AND id=$2', [kind, id]);
        }
        const known = new Set(before.activity.map(row => row.id));
        for (const row of next.activity.filter(row => !known.has(row.id))) await client.query(
          'INSERT INTO project_plannr.audit(id,happened_at,project_id,data) VALUES($1,$2,$3,$4::jsonb)',
          [row.id, row.time, row.project ?? null, JSON.stringify(row)]);
        if (next.counter !== before.counter) await client.query('UPDATE project_plannr.workspace SET counter=$1 WHERE id=1', [next.counter]);
      }
      await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
  }
  async function selectedRead(fn, {activity = false} = {}) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const state = emptyState();
      for (const row of (await client.query("SELECT kind, data FROM project_plannr.entities WHERE kind IN ('project','agent','session') ORDER BY id")).rows) state[collections[row.kind]].push(row.data);
      // Only initial board snapshots return activity. Metadata, access and page
      // reads still authorize from the same fresh snapshot, without unused audit.
      if (activity) state.activity = (await client.query('SELECT data FROM project_plannr.audit ORDER BY happened_at DESC, id DESC LIMIT 100')).rows.map(row => row.data);
      const result = await fn(state, client); await client.query('COMMIT'); return result;
    } catch (error) {await client.query('ROLLBACK').catch(() => {}); throw error;}
    finally {client.release();}
  }
  return {read: () => transaction(state => state, false), transact: fn => transaction(fn, true), close: () => pool.end(),
    readAccess: () => selectedRead(state => state),
    readChanges: select => selectedRead((state, client) => sqlChanges(client, select(state))),
    readBoard: (select, completedOnly) => selectedRead(async (state, client) => {
      const selection = select(state), result = await sqlBoardPage(client, selection, completedOnly);
      return completedOnly ? result : {...result, changeToken: await sqlChanges(client, selection)};
    }, {activity: !completedOnly}),
    readLane: select => selectedRead((state, client) => sqlLanePage(client, select(state))),
    readTicket: (authorize, id) => selectedRead(async (state, client) => {
      const actor = authorize(state), row = (await client.query("SELECT data FROM project_plannr.entities WHERE kind='ticket' AND id=$1", [id])).rows[0]?.data;
      return {actor, ticket: row};
    })};
}
