import {randomUUID} from 'node:crypto';
import {HttpError, audit, hash} from './auth.mjs';
import {priorityLevels} from '../ticket-priority.js';

const fail = message => {throw new HttpError(400, message);};
const bounded = (value, max, label, optional = false) => {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || value.length > max || !optional && !value.trim()) fail(`Invalid ${label}.`);
  return value;
};

// Source-specific extraction stays in each repo. This contract never guesses what Done means.
export function importPlan(manifest) {
  if (!manifest || manifest.version !== 1 || !manifest.project || !manifest.source) fail('Use import manifest version 1 with project and source.');
  const name = bounded(manifest.project.name, 80, 'project name').trim(), kind = manifest.project.kind;
  if (!['game', 'app', 'other'].includes(kind)) fail('Project kind must be game, app, or other.');
  const id = manifest.project.id;
  if (id !== undefined && (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(id))) fail('Invalid project ID.');
  const namespace = manifest.source.namespace;
  if (typeof namespace !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(namespace)) fail('Use a stable lowercase source namespace.');
  const url = bounded(manifest.source.url, 500, 'source URL', true);
  if (url) {
    let parsed; try {parsed = new URL(url);} catch {fail('Invalid source URL.');}
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) fail('Source links require HTTPS without credentials.');
  }
  const revision = bounded(manifest.source.revision, 40, 'source revision', true);
  if (revision && !/^[a-f0-9]{40}$/.test(revision)) fail('Source revision must be a full Git commit SHA.');
  const files = manifest.source.files ?? [];
  if (!Array.isArray(files) || files.length > 20 || files.some(file => typeof file !== 'string' || !file || file.length > 240 || file.startsWith('/') || file.split('/').some(part => ['..', '.', '.git', '.plannr'].includes(part) || part.startsWith('.env')) || file.includes('\\'))) fail('Source files must be ordinary repository-relative paths, not credentials.');
  if (files.length && !revision) fail('Committed source files require a source revision.');
  if (!Array.isArray(manifest.tickets) || manifest.tickets.length > 100) fail('Provide at most 100 tickets per manifest.');
  const seen = new Set();
  const tickets = manifest.tickets.map(item => {
    if (!item || typeof item.sourceId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(item.sourceId) || seen.has(item.sourceId)) fail('Every ticket needs a unique stable sourceId.');
    seen.add(item.sourceId);
    const title = bounded(item.title, 120, 'ticket title').trim();
    const raw = bounded(item.raw, 32000, 'original ticket text');
    const status = item.status;
    if (!['next', 'in-progress', 'completed'].includes(status)) fail('Map ticket status explicitly to next, in-progress, or completed.');
    if (!Number.isSafeInteger(item.priority) || item.priority < 0) fail('Ticket priority must be a nonnegative integer.');
    if (item.priorityLevel !== undefined && (typeof item.priorityLevel !== 'string' || !Object.hasOwn(priorityLevels, item.priorityLevel))) fail('Choose P0, P1, P2, or P3.');
    const description = bounded(item.description ?? (raw.length <= 4000 ? raw : 'Full source text is preserved in the imported notes.'), 4000, 'ticket description', true);
    const notes = item.notes ?? [];
    if (!Array.isArray(notes) || notes.length > 30) fail('Provide at most 30 notes per ticket.');
    const importedNotes = notes.map(note => bounded(note, 1800, 'ticket note'));
    if (raw.length > 4000 && item.description === undefined) for (let i = 0; i < raw.length; i += 1800) importedNotes.push(raw.slice(i, i + 1800));
    const data = {sourceId: item.sourceId, title, raw, status, priority: item.priority, description, notes: importedNotes,
      legacyStatus: bounded(item.legacyStatus, 120, 'legacy status', true), category: bounded(item.category, 120, 'category', true)};
    // Omission must retain the exact legacy hash for already imported sources.
    if (item.priorityLevel !== undefined) data.priorityLevel = item.priorityLevel;
    return {...data, key: `${namespace}:${data.sourceId}`, hash: hash(JSON.stringify(data))};
  });
  const plan = {version: 1, project: {name, kind, ...(id ? {id} : {})}, source: {namespace, url, revision, files}, tickets};
  return {...plan, hash: hash(JSON.stringify(plan))};
}

export function previewImport(state, plan) {
  const candidates = state.projects.filter(row => plan.project.id ? row.id === plan.project.id : row.name.toLowerCase() === plan.project.name.toLowerCase());
  if (candidates.length > 1) throw new HttpError(409, 'Ambiguous project. Supply its ID.');
  const project = candidates[0];
  if (plan.project.id && !project) throw new HttpError(404, 'Specified project not found.');
  if (project && (project.archived || project.kind !== plan.project.kind || project.name !== plan.project.name)) throw new HttpError(409, 'Project is archived or its name/type differs. Review the manifest, including renamed projects.');
  const existing = state.tickets.filter(row => row.project === project?.id);
  const mapping = plan.tickets.map(item => {
    const matches = existing.filter(row => row.importSource?.key === item.key);
    if (matches.length > 1 || matches.length && matches[0].importSource.hash !== item.hash) throw new HttpError(409, `Source ${item.sourceId} changed or is duplicated. No existing ticket will be overwritten.`);
    if (!matches.length && existing.some(row => row.title.toLowerCase() === item.title.toLowerCase())) throw new HttpError(409, `Review an existing title matching ${item.sourceId} before importing.`);
    return {sourceId: item.sourceId, ticketId: matches[0]?.id ?? null, action: matches.length ? 'preserve' : 'create'};
  });
  const before = {project: project ?? null, tickets: existing};
  return {planHash: plan.hash, expectedState: hash(JSON.stringify(before)), before, mapping,
    createProject: !project, createTickets: mapping.filter(row => row.action === 'create').length,
    preserveTickets: mapping.filter(row => row.action === 'preserve').length};
}

// Caller supplies the already-authenticated owner; one store transaction owns all writes.
export function applyImport(state, plan, expectedState, actor, now, mode) {
  const preview = previewImport(state, plan);
  if (preview.expectedState !== expectedState) throw new HttpError(409, 'Project changed since preview. Back up and review a fresh preview before applying.');
  let project = preview.before.project;
  if (!project) {
    project = {id: randomUUID(), ...plan.project, archived: false, revision: 1};
    state.projects.push(project); audit(state, actor, project.name, 'created project from import', project.id, now);
  }
  const mapping = preview.mapping.map((row, index) => {
    if (row.ticketId) return row;
    const item = plan.tickets[index];
    const ticket = {id: `${mode === 'demo' ? 'DEMO' : 'PLNR'}-${++state.counter}`, project: project.id,
      title: item.title, description: item.description, status: item.status, priority: item.priority,
      priorityLevel: item.priorityLevel ?? 'P2',
      revision: 1, owner: null, ownerId: null, leaseUntil: 0, completedAt: null,
      comments: item.notes.map(text => ({actor: actor.name, actorId: actor.id, text, time: new Date(now).toISOString()})),
      importSource: {key: item.key, hash: item.hash, snapshotHash: plan.hash, url: plan.source.url,
        revision: plan.source.revision, category: item.category, legacyStatus: item.legacyStatus, raw: item.raw}};
    state.tickets.push(ticket); audit(state, actor, ticket.id, `imported ${item.sourceId} with its recorded source status`, project.id, now);
    return {...row, ticketId: ticket.id};
  });
  return {project, planHash: plan.hash, mapping, created: preview.createTickets, preserved: preview.preserveTickets};
}
