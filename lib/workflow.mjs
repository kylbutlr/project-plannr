import {HttpError, audit, requireOwner} from './auth.mjs';
import {categories, categoryStates, defaultColumns, ticketColumn, workflowOf} from '../workflow.js';

export function selectColumn(workflow, id) {
  const column = workflow.columns.find(row => row.id === id && row.enabled);
  if (!column) throw new HttpError(400, 'Choose an enabled column.');
  return column;
}

export function moveToColumn(ticket, column, actor, now) {
  const status = categoryStates[column.category];
  if (ticket.status !== status) ticket.completedAt = status === 'completed' ? new Date(now).toISOString() : null;
  Object.assign(ticket, {columnId: column.id, status, owner: status === 'in-progress' ? actor.name : null,
    ownerId: status === 'in-progress' ? actor.id : null, leaseUntil: status === 'in-progress' ? now + 300000 : 0});
  if (status !== 'in-progress') delete ticket.claimFrom;
}

export function workflowDetails(state) {
  return {...workflowOf(state), counts: Object.fromEntries(workflowOf(state).columns.map(column =>
    [column.id, state.tickets.filter(ticket => ticketColumn(ticket) === column.id).length]))};
}

// The complete configuration and any explicit ticket moves share one transaction.
export function saveWorkflow(state, body, actor, now) {
  requireOwner(actor);
  const previous = workflowOf(state);
  if (body.revision !== previous.revision) throw new HttpError(409, 'Columns changed. Reload Columns and review your changes.');
  if (!Array.isArray(body.columns) || body.columns.length < 3 || body.columns.length > 24) throw new HttpError(400, 'Keep between 3 and 24 columns.');
  const ids = new Set(), names = new Set();
  const columns = body.columns.map(row => {
    if (!row || typeof row.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(row.id) || ids.has(row.id)) throw new HttpError(400, 'Each column needs a unique stable ID.');
    if (typeof row.name !== 'string' || !row.name.trim() || row.name.trim().length > 60 || names.has(row.name.trim().toLowerCase())) throw new HttpError(400, 'Use distinct column names between 1 and 60 characters.');
    if (!Object.hasOwn(categories, row.category) || typeof row.enabled !== 'boolean') throw new HttpError(400, 'Choose a category and enabled state for every column.');
    const core=defaultColumns.find(column=>column.id===row.id);
    if (core && core.category !== row.category) throw new HttpError(400, 'The default column IDs retain their Ready, Active, and Done categories. Rename or replace a column to change its purpose.');
    ids.add(row.id); names.add(row.name.trim().toLowerCase());
    return {id: row.id, name: row.name.trim(), category: row.category, enabled: row.enabled};
  });
  for (const category of ['ready', 'active', 'done']) {
    if (!columns.some(column => column.enabled && column.category === category)) throw new HttpError(400, `Keep at least one enabled ${categories[category]} column.`);
  }
  const moves = body.moves ?? {};
  if (!moves || typeof moves !== 'object' || Array.isArray(moves)) throw new HttpError(400, 'Choose destinations for removed columns.');
  const next = {revision: previous.revision + 1, columns};
  for (const ticket of state.tickets) {
    const id = ticketColumn(ticket), before = previous.columns.find(column => column.id === id);
    const after = columns.find(column => column.id === id);
    const destination = after || (moves[id] && selectColumn(next, moves[id]));
    if (!destination) throw new HttpError(400, 'Move every ticket to an enabled column before removing its column, including archived projects.');
    const changed = !after || before?.category !== after.category;
    if ((changed || before?.enabled && !after?.enabled) && ticket.ownerId && ticket.leaseUntil > now) throw new HttpError(409, 'Release active work claims before changing their column category, removing it, or turning it off.');
    if (changed) {
      moveToColumn(ticket, destination, actor, now);
      ticket.owner=null;ticket.ownerId=null;ticket.leaseUntil=0;delete ticket.claimFrom;ticket.revision++;
      audit(state, actor, ticket.id, 'moved with workflow change', ticket.project, now);
    }
  }
  state.workflow = next;
  audit(state, actor, 'Columns', 'updated workflow', null, now);
  return workflowDetails(state);
}
