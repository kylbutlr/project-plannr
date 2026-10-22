// Opt-in remote check. Removes its fixtures; preserves audit history.
import {configuration, loadLocalEnv} from '../lib/config.mjs';
import {postgresStore} from '../lib/store.mjs';
import {verifyStorage} from './verify-storage.mjs';

loadLocalEnv(); const config = configuration();
if (!config.databaseUrl || config.mode !== 'private' || !config.authConfigured) throw Error('Configure the private development database and workspace password first.');
try {
  await verifyStorage(() => postgresStore(config.databaseUrl), config);
  console.log('PASS: live development storage, transaction rollback, competing claims, retry deduplication and connection-pool restart persistence. Test project, ticket, replay and temporary session removed; audit history preserved.');
} catch {console.error('Database verification or fixture cleanup failed. Review development connectivity and verification data before retrying. No connection strings are logged.'); process.exitCode = 1;}
