import {constants, lstat, mkdir, open, readFile, realpath} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {importPlan} from '../lib/project-import.mjs';
import {HttpError} from '../lib/auth.mjs';
import {planningOrigin} from '../lib/planning-client.mjs';

const exec = promisify(execFile), root = fileURLToPath(new URL('../', import.meta.url));
const git = async (repo, args) => (await exec('git', ['-C', repo, ...args], {maxBuffer: 2097152})).stdout;

export function onboardingArgs(args) {
  const options = {origin: 'https://project-plannr.netlify.app', apply: false, issueAgent: false};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply') options.apply = true;
    else if (args[i] === '--issue-agent') options.issueAgent = true;
    else if (['--repo', '--manifest', '--origin'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) options[args[i].slice(2)] = args[++i];
    else throw Error('Unknown or incomplete onboarding option.');
  }
  if (!options.repo || !options.manifest || options.issueAgent && !options.apply) throw Error('Supply --repo and --manifest. Credential issuance also requires --apply.');
  options.repo = resolve(options.repo); options.manifest = resolve(options.manifest); planningOrigin(options.origin);
  return options;
}

export async function onboardingSource(options) {
  const repo = await realpath(options.repo), top = (await git(repo, ['rev-parse', '--show-toplevel'])).trim();
  if (repo !== await realpath(top)) throw Error('--repo must be the repository root.');
  const info = await lstat(options.manifest);
  if (!info.isFile() || info.size > 500000) throw Error('Manifest must be an ordinary file under 500 KB.');
  const manifest = JSON.parse(await readFile(options.manifest, 'utf8')), plan = importPlan(manifest), sources = [];
  for (const path of plan.source.files) {
    const local = resolve(repo, path), canonical = await realpath(local);
    if (canonical !== local || !(await lstat(local)).isFile()) throw Error('Source file must not use symlinks.');
    const committed = await git(repo, ['show', `${plan.source.revision}:${path}`]), current = await readFile(local, 'utf8');
    if (current !== committed) throw Error('Source differs from its committed snapshot. Preserve and review uncommitted changes first.');
    sources.push({path, text: committed});
  }
  return {repo, manifest, plan, sources};
}

async function privateDirectory(path) {
  try {await mkdir(path, {mode: 0o700});} catch (error) {if (error.code !== 'EEXIST') throw error;}
  const info = await lstat(path);
  if (!info.isDirectory() || info.mode & 0o077 || process.getuid && info.uid !== process.getuid()) throw Error('Private directory must be owner-only and not a symlink.');
}

async function saveJSON(path, value) {
  const file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {await file.writeFile(JSON.stringify(value, null, 2) + '\n'); await file.sync();} finally {await file.close();}
}

export async function onboardingRun(options, {password = process.env.PLANNR_PASSWORD, fetcher = fetch,
    backupRoot = resolve(root, 'data/onboarding')} = {}) {
  const source = await onboardingSource(options), {repo, manifest, plan} = source;
  const summary = {project: plan.project, tickets: plan.tickets.length, statuses: Object.fromEntries(['next', 'in-progress', 'completed'].map(status => [status, plan.tickets.filter(row => row.status === status).length])),
    sourceNamespace: plan.source.namespace, sourceFilesVerified: source.sources.map(row => row.path), planHash: plan.hash};
  if (!options.apply) return {mode: 'offline preview', ...summary, items: plan.tickets.map(({sourceId, title, status, priority, priorityLevel}) => ({sourceId, title, status, priority, priorityLevel: priorityLevel ?? 'P2'})), next: 'Review full manifest coverage and status mapping. --apply signs in, checks live collisions, backs up, imports atomically, and verifies. No live data has been read or changed.'};
  if (typeof password !== 'string' || password.length < 16 || password.length > 256) throw Error('Set PLANNR_PASSWORD privately in the terminal, not a command argument.');
  // Reserve ignored local access storage BEFORE making any remote changes.
  let credentialFile, reserved;
  if (options.issueAgent) {
    if ((await git(repo, ['ls-files', '--', '.plannr'])).trim()) throw Error('Remove tracked credentials from the integration before setup.');
    await exec('git', ['-C', repo, 'check-ignore', '-q', '.plannr/agent.json']);
    await privateDirectory(resolve(repo, '.plannr'));
    credentialFile = resolve(repo, '.plannr/agent.json');
    reserved = await open(credentialFile, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try {await reserved.sync();} catch (error) {await reserved.close(); throw error;}
  }
  let cookie, csrf, importResult, agentName, granted;
  const request = async (path, method = 'GET', body, key) => {
    const response = await fetcher(options.origin + path, {method, redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: {'Content-Type': 'application/json', Origin: options.origin, ...(cookie ? {Cookie: cookie} : {}),
        ...(csrf ? {'X-CSRF-Token': csrf} : {}), ...(key ? {'Idempotency-Key': key} : {})}, body: body === undefined ? undefined : JSON.stringify(body)});
    if (!response.ok) throw Error(`Onboarding request failed (${response.status}) at ${path}. Review the backup and server response in a private session; no automatic retry.`);
    return response;
  };
  try {
    // Backups contain only this project, not sessions, agents, or the whole workspace.
    await mkdir(dirname(backupRoot), {recursive: true}); await privateDirectory(backupRoot);
    if (await realpath(backupRoot) !== resolve(backupRoot)) throw Error('Backup path must not contain symlinks.');
    const operation = randomUUID(), backup = resolve(backupRoot, operation); await privateDirectory(backup);
    await saveJSON(resolve(backup, 'source.json'), {manifest, sources: source.sources});
    const login = await request('/auth/login', 'POST', {password});
    cookie = login.headers.get('set-cookie')?.split(';')[0];
    if (!cookie) throw Error('Owner sign-in did not return a session.');
    csrf = (await (await request('/api/session')).json()).csrf;
    if (!csrf) throw Error('Owner session is unavailable.');
    const preview = await (await request('/api/imports/preview', 'POST', {manifest})).json();
    if (preview.planHash !== plan.hash) throw Error('Server and local import plans differ.');
    await saveJSON(resolve(backup, 'before.json'), preview);
    await saveJSON(resolve(backup, 'operation.json'), {idempotencyKey: operation, planHash: plan.hash, expectedState: preview.expectedState});
    importResult = await (await request('/api/imports/apply', 'POST', {manifest, expectedState: preview.expectedState}, operation)).json();
    if (importResult.planHash !== plan.hash || importResult.mapping.length !== plan.tickets.length) throw Error('Import response differs from plan.');
    await saveJSON(resolve(backup, 'receipt.json'), importResult);
    const verified = [];
    for (let i = 0; i < importResult.mapping.length; i++) {
      const row = importResult.mapping[i], item = plan.tickets[i];
      const ticket = await (await request(`/api/tickets/${encodeURIComponent(row.ticketId)}`)).json();
      if (row.sourceId !== item.sourceId || ticket.project !== importResult.project.id || ticket.importSource?.key !== item.key || ticket.importSource.hash !== item.hash || ticket.importSource.raw !== item.raw) throw Error('Import read-back failed. Keep the source ledger and inspect the receipt.');
      if (row.action === 'create' && (ticket.title !== item.title || ticket.description !== item.description || ticket.status !== item.status || ticket.priority !== item.priority || (ticket.priorityLevel ?? 'P2') !== (item.priorityLevel ?? 'P2') || JSON.stringify(ticket.comments.map(note => note.text)) !== JSON.stringify(item.notes))) throw Error('Imported ticket changed or failed read-back. Keep the source ledger.');
      verified.push(ticket);
    }
    await saveJSON(resolve(backup, 'verified.json'), verified);
    if (options.issueAgent) {
      agentName = `${plan.project.name.slice(0, 17)} local ${operation}`;
      granted = await (await request('/api/agents', 'POST', {name: agentName, projects: [importResult.project.id]}, `agent_${operation}`)).json();
      if (!/^plnr_[A-Za-z0-9_-]{43}$/.test(granted.token || '') || granted.projects?.length !== 1 || granted.projects[0] !== importResult.project.id) throw Error('Unexpected issued credential scope.');
      await reserved.truncate(0);
      await reserved.writeFile(JSON.stringify({origin: options.origin, ...granted}, null, 2) + '\n', {encoding: 'utf8'});
      await reserved.sync();
    }
    return {mode: 'applied and read-back verified', ...summary, created: importResult.created, preserved: importResult.preserved,
      projectId: importResult.project.id, backup, ...(granted ? {credentialFile, agentId: granted.id, expiresAt: granted.expiresAt} : {}),
      next: 'Review the board and backup before removing a repo ledger. This command never deletes source files.'};
  } catch (error) {
    // If issuance completed but local persistence failed, revoke only this operation's grant.
    if (agentName && cookie && csrf) {
      try {
        const agents = await (await request('/api/agents')).json();
        for (const agent of agents.filter(row => row.name === agentName && !row.revoked)) await request(`/api/agents/${agent.id}/revoke`, 'POST', {});
      } catch {throw Error('Onboarding stopped after credential issuance was attempted. Check and revoke this operation’s agent in the owner API before replacing access. Imported tickets may already exist; keep all ledgers and backups.');}
    }
    throw error;
  } finally {
    try {await reserved?.close();} finally {
      if (cookie && csrf) try {await request('/auth/logout', 'POST', {});} catch { /* Session expires server-side; never log cookies. */ }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.slice(2).join(' ') === '--help') console.log('Usage: npm run onboard -- --repo /absolute/project --manifest /absolute/manifest.json [--origin HTTPS_OR_LOOPBACK_ORIGIN] [--apply [--issue-agent]]\nDefault: offline preview. Apply uses PLANNR_PASSWORD privately from the environment. No ledger deletion, push, or deployment. See docs/project-onboarding.md.');
    else console.log(JSON.stringify(await onboardingRun(onboardingArgs(process.argv.slice(2))), null, 2));
  }
  catch (error) {
    console.error(error instanceof HttpError || error.message.startsWith('Onboarding request failed') ? error.message : 'Onboarding stopped. Check the manifest, committed source, password environment, and ignored owner-only access directory. Keep source ledgers and data/onboarding backups; an apply may already have committed. No automatic retry or cleanup. See docs/project-onboarding.md.');
    process.exitCode = 1;
  }
}
