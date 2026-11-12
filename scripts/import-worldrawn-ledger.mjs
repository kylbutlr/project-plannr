import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {loadLocalEnv, configuration} from '../lib/config.mjs';
import {postgresStore} from '../lib/store.mjs';
import {planWorldrawnImport, importWorldrawnPlan} from './worldrawn-ledger.mjs';

const sourceRepo = resolve(process.argv[2] || '../worldrawn');
const apply = process.argv.includes('--apply');
const markdown = await readFile(resolve(sourceRepo, 'docs/poi-ledger.md'), 'utf8');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: sourceRepo, encoding: 'utf8'}).trim();
assert.equal(execFileSync('git', ['show', `${revision}:docs/poi-ledger.md`], {cwd: sourceRepo, encoding: 'utf8'}), markdown,
  'Commit the source before importing; immutable evidence must match every byte.');
const plan = planWorldrawnImport(markdown, revision);
console.log(JSON.stringify({mode: apply ? 'apply' : 'preview', source: plan.source, sourceHash: plan.sourceHash,
  tickets: plan.tickets.map(({key, title, status, priority, description, notes}) => ({key, title, status, priority, descriptionLength: description.length, notes: notes.length}))}, null, 2));
if (apply) {
  loadLocalEnv(); const config = configuration();
  if (config.mode !== 'private' || !config.databaseUrl || !config.authConfigured) throw Error('Configured private development database required.');
  // Never print connection errors, credentials, cookie or private backup contents.
  const store = postgresStore(config.databaseUrl);
  try {
    const before = await store.read();
    const projects = before.projects.filter(row => row.name === 'Worldrawn' && row.kind === 'game' && !row.archived);
    assert.equal(projects.length, 1, 'Resolve the existing Worldrawn project without creating a duplicate.');
    const project = projects[0], backupDir = resolve('data/import-backups');
    await mkdir(backupDir, {recursive: true, mode: 0o700});
    const backup = resolve(backupDir, `worldrawn-${plan.sourceHash}.json`);
    try {
      await writeFile(backup, JSON.stringify({source: plan.source, markdown, project,
        tickets: before.tickets.filter(row => row.project === project.id)}, null, 2), {flag: 'wx', mode: 0o600});
    } catch (error) {if (error.code !== 'EEXIST') throw error;}
    const preserved = before.tickets.map(row => JSON.stringify(row));
    const mapping = await importWorldrawnPlan(store, plan, project.id);
    await store.close();
    const fresh = postgresStore(config.databaseUrl);
    try {
      const after = await fresh.read();
      for (const row of preserved) assert.ok(after.tickets.some(ticket => JSON.stringify(ticket) === row), 'Existing ticket changed.');
      for (const item of plan.tickets) {
        const rows = after.tickets.filter(row => row.project === project.id && row.importSource?.key === item.sourceKey);
        assert.equal(rows.length, 1); const ticket = rows[0];
        assert.equal(ticket.importSource.raw, item.raw); assert.equal(ticket.importSource.hash, item.sourceHash);
        assert.equal(ticket.description, item.description); assert.equal(ticket.status, item.status);
        assert.equal(ticket.priority, item.priority); assert.deepEqual(ticket.comments.map(note => note.text), item.notes);
      }
      const exportPath = resolve(backupDir, `worldrawn-${plan.sourceHash}-imported.json`);
      await writeFile(exportPath, JSON.stringify({source: plan.source, project,
        mapping, tickets: after.tickets.filter(row => row.project === project.id)}, null, 2), {flag: 'wx', mode: 0o600});
      console.log(JSON.stringify({verified: true, projectId: project.id, imported: mapping.length, mapping, backup, exportPath}, null, 2));
    } finally {await fresh.close();}
  } catch {console.error('Import or verification failed. Source ledger was not removed. Review local backups and connectivity before retrying.'); process.exitCode = 1;}
  finally {await store.close().catch(() => {});}
}
