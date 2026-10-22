import {constants, open, realpath} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {agentCommand} from './agent-command.mjs';
import {compareActive} from '../ticket-priority.js';

export function planningOrigin(value) {
  const url = new URL(value);
  if (url.origin !== value || url.username || url.password || !['http:', 'https:'].includes(url.protocol) || url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) throw Error('Use an exact HTTPS or loopback origin.');
  return value;
}

export async function readPrivateJSON(path) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > 524288 || info.mode & 0o077 || process.getuid && info.uid !== process.getuid()) throw Error('Use an owner-only ordinary file, not a symlink.');
    return JSON.parse(await file.readFile('utf8'));
  } finally {await file.close();}
}

export async function planningAccess(path) {
  if (await realpath(path) !== resolve(path)) throw Error('Credential path must not contain symlinks.');
  const access = await readPrivateJSON(path);
  planningOrigin(access.origin);
  if (access.projects?.length !== 1 || typeof access.projects[0] !== 'string' || !access.projects[0] ||
      !/^plnr_[A-Za-z0-9_-]{43}$/.test(access.token || '') || !Number.isFinite(access.expiresAt) || access.expiresAt <= Date.now()) throw Error('Missing, expired, or incorrectly scoped project credential.');
  return access;
}

export async function planningRun(args, path, fetcher = fetch) {
  const access = await planningAccess(path), project = access.projects[0];
  const [action = 'board', ...rest] = args;
  let command;
  if (action === 'board' && !rest.length) command = {method: 'GET', path: `/api/board?${new URLSearchParams({project, view: 'swimlanes'})}`};
  else if (action === 'backlog' && !rest.length) command = agentCommand(['backlog', project]);
  else if (['show', 'claim', 'renew', 'release', 'note'].includes(action) &&
      (action === 'show' && rest.length === 1 || ['claim', 'renew', 'release'].includes(action) && rest.length === 2 || action === 'note' && rest.length === 3)) command = agentCommand(args);
  else if (['checklist-add', 'checklist-edit', 'checklist-check', 'checklist-uncheck', 'checklist-remove'].includes(action)) command = agentCommand(args);
  else throw Error('Use board, backlog, show, claim, renew, release, note, or checklist-add/edit/check/uncheck/remove. Completion requires owner review.');
  const response = await fetcher(access.origin + command.path, {method: command.method, redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${access.token}`,
      ...(command.method !== 'GET' ? {'Idempotency-Key': randomUUID()} : {})}, body: command.body && JSON.stringify(command.body)});
  if (!response.ok) throw Error(`Planning request failed (${response.status}). For 401 renew access; for 409 re-read the revision and claim. No automatic retry.`);
  const result = await response.json();
  if (result.project && result.project !== project || result.projects?.some(row => row.id !== project) || result.tickets?.some(row => row.project !== project)) throw Error('Unexpected project in planning response.');
  if (action === 'backlog') result.tickets = result.tickets.filter(row => row.status === 'next').sort(compareActive);
  return result;
}
