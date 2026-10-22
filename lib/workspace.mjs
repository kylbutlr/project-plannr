import {applyChecklistChanges} from '../ticket-checklist.js';
import {randomUUID} from 'node:crypto';
import {HttpError, audit, canAccess, hash, requireActor, requireMutation, requireOwner, requireProject, secret} from './auth.mjs';
import {boardSelection, memoryBoardPage} from './board-page.mjs';
import {applyImport, importPlan, previewImport} from './project-import.mjs';
import {memoryLanePage} from './lane-page.mjs';
import {memoryChanges} from './board-changes.mjs';
import {priorityLevels} from '../ticket-priority.js';

const kinds = ['game', 'app', 'other'], stages = ['next', 'in-progress', 'completed'];
const text = (value, max, label) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new HttpError(400, `${label} must be between 1 and ${max} characters.`);
  return value.trim();
};
const expectRevision = (body, row) => {
  if (body.revision !== row.revision) throw new HttpError(409, 'This item changed. Refresh and review it before trying again.');
};
const activeProject = (state, id) => {
  const project = state.projects.find(row => row.id === id);
  if (!project) throw new HttpError(404, 'Project not found.');
  if (project.archived) throw new HttpError(409, 'Restore this project before changing its tickets.');
  return project;
};
export function snapshot(state, actor, mode) {
  const projects = state.projects.filter(row => canAccess(actor, row.id)), ids = new Set(projects.map(row => row.id));
  return {prototype: mode === 'demo', projects, tickets: state.tickets.filter(row => ids.has(row.project)),
    activity: state.activity.filter(row => actor.owner || ids.has(row.project)).slice(0, 100)};
}

export function workspace(store, config, {now = Date.now} = {}) {
  return {
    async changes(headers, params) {
      const select = data => boardSelection(data, requireActor(data, headers, config, now()), params);
      if (store.readChanges) return {changeToken: await store.readChanges(select)};
      const data = await store.read(); return {changeToken: memoryChanges(data, select(data))};
    },
    async lane(headers, params) {
      const select = data => boardSelection(data, requireActor(data, headers, config, now()), params);
      if (store.readLane) return store.readLane(select);
      const data = await store.read(); return memoryLanePage(data, select(data));
    },
    async board(headers, params, completedOnly = false) {
      const select = data => ({...boardSelection(data, requireActor(data, headers, config, now()), params), prototype: config.mode === 'demo'});
      if (store.readBoard) return store.readBoard(select, completedOnly);
      const data = await store.read(), selection = select(data), result = memoryBoardPage(data, selection, completedOnly);
      return completedOnly ? result : {...result, changeToken: memoryChanges(data, selection)};
    },
    async ticket(headers, id) {
      let actor, ticket;
      const authorize = data => requireActor(data, headers, config, now());
      if (store.readTicket) ({actor, ticket} = await store.readTicket(authorize, id));
      else {const data = await store.read(); actor = authorize(data); ticket = data.tickets.find(row => row.id === id);}
      if (!ticket) throw new HttpError(404, 'Ticket not found.');
      requireProject(actor, ticket.project); return ticket;
    },
    async read(headers) {
      const data = await store.read(), actor = requireActor(data, headers, config, now());
      return snapshot(data, actor, config.mode);
    },
    async mutate(path, method, body, headers) {
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Send a JSON object.');
      return store.transact(state => {
        const actor = requireActor(state, headers, config, now()); requireMutation(headers, actor, config);
        const key = headers['idempotency-key'];
        if (key && (typeof key !== 'string' || key.length > 100 || !/^[A-Za-z0-9_-]+$/.test(key))) throw new HttpError(400, 'Invalid idempotency key.');
        state.replays = state.replays.filter(row => row.expiresAt > now());
        const requestId = key && hash(`${actor.id}:${key}`), fingerprint = hash(JSON.stringify({path, method, body}));
        const previous = requestId && state.replays.find(row => row.id === requestId);
        if (previous) {
          if (previous.fingerprint !== fingerprint) throw new HttpError(409, 'This idempotency key was already used for a different request.');
          if (!actor.owner && previous.project && !canAccess(actor, previous.project)) throw new HttpError(403, 'This request is no longer in your project scope.');
          if (previous.credentialIssued) throw new HttpError(409, 'This credential was already issued. Its secret is shown only once. Revoke it before issuing a replacement.');
          return previous.result;
        }
        const result = execute(state, actor, path, method, body, now(), config.mode);
        // Never persist the plaintext credential returned once by issuance.
        if (key && !result.body.token) state.replays.push({id: requestId, fingerprint, result: structuredClone(result),
          project: result.project ?? null, expiresAt: now() + 86400000});
        if (key && result.body.token) state.replays.push({id: requestId, fingerprint, credentialIssued: true, expiresAt: now() + 86400000});
        return result;
      });
    },
  };
}

function execute(state, actor, path, method, body, now, mode) {
  if (path === '/api/imports/preview' && method === 'POST' || path === '/api/imports/apply' && method === 'POST') {
    requireOwner(actor);
    const plan = importPlan(body.manifest);
    if (path.endsWith('/preview')) return {status: 200, body: previewImport(state, plan)};
    const result = applyImport(state, plan, body.expectedState, actor, now, mode);
    return {status: 200, body: result, project: result.project.id};
  }
  const projectMatch = path.match(/^\/api\/projects\/([^/]+)$/);
  if (path === '/api/projects' && method === 'POST' || projectMatch && method === 'PATCH') {
    requireOwner(actor);
    const project = projectMatch && state.projects.find(row => row.id === decodeURIComponent(projectMatch[1]));
    if (projectMatch && !project) throw new HttpError(404, 'Project not found.');
    if (project) expectRevision(body, project);
    const name = text(body.name ?? project?.name, 80, 'Project name'), kind = body.kind ?? project?.kind;
    if (!kinds.includes(kind)) throw new HttpError(400, 'Choose Game, App, or Other.');
    if (state.projects.some(row => row !== project && row.name.toLowerCase() === name.toLowerCase())) throw new HttpError(400, 'A project with this name already exists, including archived projects.');
    if (body.archived !== undefined && typeof body.archived !== 'boolean') throw new HttpError(400, 'Archived must be true or false.');
    if (project) {
      Object.assign(project, {name, kind, archived: body.archived ?? project.archived, revision: project.revision + 1});
      audit(state, actor, project.name, body.archived === undefined ? 'edited project' : body.archived ? 'archived project' : 'restored project', project.id, now);
      return {status: 200, body: project, project: project.id};
    }
    const created = {id: randomUUID(), name, kind, archived: false, revision: 1};
    state.projects.push(created); audit(state, actor, created.name, 'created project', created.id, now);
    return {status: 201, body: created, project: created.id};
  }
  if (path === '/api/agents' && method === 'POST') {
    requireOwner(actor);
    const name = text(body.name, 60, 'Agent name');
    if (!Array.isArray(body.projects) || !body.projects.length || body.projects.length > 100 || !body.projects.every(id => typeof id === 'string')) throw new HttpError(400, 'Assign at least one active project.');
    const projects = [...new Set(body.projects)];
    for (const id of projects) activeProject(state, id);
    const token = `plnr_${secret()}`, created = {id: randomUUID(), name, projects, tokenHash: hash(token), revoked: false, expiresAt: now + 30 * 86400000};
    state.agents.push(created); audit(state, actor, created.id, 'issued a project-scoped agent credential', null, now);
    return {status: 201, body: {id: created.id, name, projects, expiresAt: created.expiresAt, token}};
  }
  const agentMatch = path.match(/^\/api\/agents\/([^/]+)\/revoke$/);
  if (agentMatch && method === 'POST') {
    requireOwner(actor);
    const agent = state.agents.find(row => row.id === decodeURIComponent(agentMatch[1]));
    if (!agent) throw new HttpError(404, 'Agent not found.');
    agent.revoked = true; audit(state, actor, agent.id, 'revoked agent credential', null, now);
    return {status: 200, body: {id: agent.id, revoked: true}};
  }
  if (path === '/api/tickets' && method === 'POST') {
    requireProject(actor, body.project); activeProject(state, body.project);
    const title = text(body.title, 120, 'Ticket title');
    if (body.priorityLevel !== undefined && (typeof body.priorityLevel !== 'string' || !Object.hasOwn(priorityLevels, body.priorityLevel))) throw new HttpError(400, 'Choose P0, P1, P2, or P3.');
    const ticket = {id: `${mode === 'demo' ? 'DEMO' : 'PLNR'}-${++state.counter}`, project: body.project, title,
      description: body.description === undefined ? '' : text(body.description, 4000, 'Description'),
      priority: Math.max(0, ...state.tickets.filter(row => row.project === body.project).map(row => row.priority)) + 1,
      priorityLevel: body.priorityLevel ?? 'P2',
      status: 'next', revision: 1, owner: null, ownerId: null, leaseUntil: 0, comments: [], checklist: []};
    state.tickets.push(ticket); audit(state, actor, ticket.id, 'created ticket', ticket.project, now);
    return {status: 201, body: ticket, project: ticket.project};
  }
  const match = path.match(/^\/api\/tickets\/([^/]+)(\/(claim|renew|release))?$/);
  const ticket = match && state.tickets.find(row => row.id === decodeURIComponent(match[1]));
  if (!ticket) throw new HttpError(404, 'Ticket not found.');
  requireProject(actor, ticket.project); activeProject(state, ticket.project); expectRevision(body, ticket);
  const action = match[3];
  if (action && method !== 'POST' || !action && method !== 'PATCH') throw new HttpError(404, 'Unknown workspace route.');
  if (action === 'claim') {
    if (ticket.status === 'completed' || ticket.ownerId && ticket.leaseUntil > now) throw new HttpError(409, 'Ticket is complete or already claimed.');
    Object.assign(ticket, {status: 'in-progress', owner: actor.name, ownerId: actor.id, leaseUntil: now + 300000});
  } else if (action === 'renew' || action === 'release') {
    if (ticket.ownerId !== actor.id || ticket.leaseUntil <= now) throw new HttpError(409, 'You do not have an active claim on this ticket.');
    if (action === 'renew') ticket.leaseUntil = now + 300000;
    else Object.assign(ticket, {status: 'next', owner: null, ownerId: null, leaseUntil: 0});
  } else {
    if (!actor.owner && (ticket.ownerId !== actor.id || ticket.leaseUntil <= now)) throw new HttpError(409, 'Claim this ticket before changing it, and renew expired claims.');
    if (body.status !== undefined && !stages.includes(body.status)) throw new HttpError(400, 'Unknown status.');
    if (body.priority !== undefined && (!Number.isSafeInteger(body.priority) || body.priority < 0)) throw new HttpError(400, 'Priority must be a nonnegative integer.');
    if (body.priorityLevel !== undefined && (typeof body.priorityLevel !== 'string' || !Object.hasOwn(priorityLevels, body.priorityLevel))) throw new HttpError(400, 'Choose P0, P1, P2, or P3.');
    if (body.comment !== undefined) text(body.comment, 2000, 'Note');
    if (body.title !== undefined) text(body.title, 120, 'Ticket title');
    if (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > 4000)) throw new HttpError(400, 'Description must be at most 4000 characters.');
    let checklist;
    if (body.checklistChanges !== undefined) {
      try {checklist = applyChecklistChanges(ticket, body.checklistChanges, randomUUID);}
      catch (error) {throw new HttpError(400, error.message);}
    }
    if (body.status !== undefined && body.status !== ticket.status) {
      ticket.completedAt = body.status === 'completed' ? new Date(now).toISOString() : null;
      Object.assign(ticket, {status: body.status, owner: body.status === 'in-progress' ? actor.name : null,
        ownerId: body.status === 'in-progress' ? actor.id : null, leaseUntil: body.status === 'in-progress' ? now + 300000 : 0});
    }
    if (body.priority !== undefined) ticket.priority = body.priority;
    if (body.priorityLevel !== undefined) ticket.priorityLevel = body.priorityLevel;
    if (body.comment !== undefined) ticket.comments.push({actor: actor.name, actorId: actor.id, text: body.comment.trim(), time: new Date(now).toISOString()});
    if (body.title !== undefined) ticket.title = body.title.trim();
    if (body.description !== undefined) ticket.description = body.description;
    if (checklist) ticket.checklist = checklist;
    if (!['status', 'priority', 'priorityLevel', 'comment', 'title', 'description', 'checklistChanges'].some(key => body[key] !== undefined)) throw new HttpError(400, 'Choose a ticket change.');
  }
  ticket.revision++; audit(state, actor, ticket.id, action ? `${action} work claim` : body.checklistChanges ? 'updated ticket checklist' : 'updated ticket', ticket.project, now);
  return {status: 200, body: ticket, project: ticket.project};
}
