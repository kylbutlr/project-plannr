import {readFile} from 'node:fs/promises';
import {Client} from 'pg';
import {configuration, loadLocalEnv} from '../lib/config.mjs';

loadLocalEnv(); const config = configuration();
if (!config.databaseUrl || config.mode !== 'private') throw Error('Configure the private development database before migrating.');
const target = new URL(process.env.MIGRATION_DATABASE_URL || config.databaseUrl);
if (target.hostname !== (process.env.MIGRATION_DATABASE_URL ? process.env.PLANNR_MIGRATION_HOST : process.env.PLANNR_DATABASE_HOST)) throw Error('Migration URL does not match the explicitly configured development host.');
for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) target.searchParams.delete(key);
const client = new Client({connectionString: target.toString(), ssl: {rejectUnauthorized: true}, connectionTimeoutMillis: 15000, statement_timeout: 30000});
try {
  await client.connect(); await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(178507521, 1)');
  await client.query(await readFile(new URL('../migrations/001-workspace.sql', import.meta.url), 'utf8'));
  await client.query('COMMIT');
  const result = await client.query('SELECT version FROM project_plannr.migrations ORDER BY version');
  console.log(`PASS: development database migration verified. Schema versions: ${result.rows.map(row => row.version).join(', ')}. Production was not targeted.`);
} catch {
  await client.query('ROLLBACK').catch(() => {}); console.error('Migration failed. Check development connection configuration. Credentials are not logged.'); process.exitCode = 1;
} finally {await client.end();}
