import {HttpError} from './auth.mjs';

const summary = ticket => ({id: ticket.id, project: ticket.project, title: ticket.title,
  status: ticket.status, columnId: ticket.columnId, revision: ticket.revision});

// Validate against the transaction's current tickets before changing any row.
export function relationshipChanges(tickets, ticket, body) {
  const changes = {};
  if (body.parentId !== undefined) {
    if (body.parentId !== null && (typeof body.parentId !== 'string' || !body.parentId || body.parentId.length > 120)) throw new HttpError(400, 'Choose a parent ticket or remove the parent.');
    const parent = body.parentId === null ? null : tickets.find(row => row.id === body.parentId && row.project === ticket.project);
    if (body.parentId !== null && !parent) throw new HttpError(400, 'Choose a parent ticket in the same project.');
    if (parent?.id === ticket.id) throw new HttpError(400, 'A ticket cannot be its own parent.');
    if (parent?.parentId) throw new HttpError(400, 'Sub-tasks cannot contain other sub-tasks. Choose a top-level parent.');
    if (parent && tickets.some(row => row.project === ticket.project && row.parentId === ticket.id)) throw new HttpError(409, 'Detach this ticket’s sub-tasks before assigning a parent.');
    changes.parentId = parent?.id ?? null;
  }
  if (body.radarUrl !== undefined) {
    if (typeof body.radarUrl !== 'string' || body.radarUrl.length > 2048) throw new HttpError(400, 'Use an HTTPS ticket link, or leave the reference empty.');
    const value = body.radarUrl.trim();
    if (value) {
      let url;
      try {url = new URL(value);} catch {throw new HttpError(400, 'Use an HTTPS link without embedded credentials.');}
      if (url.protocol !== 'https:' || url.username || url.password) throw new HttpError(400, 'Use an HTTPS link without embedded credentials.');
      changes.radarUrl = url.href;
    } else changes.radarUrl = '';
  }
  if ((changes.parentId === undefined ? ticket.parentId : changes.parentId) && (changes.radarUrl ?? ticket.radarUrl)) throw new HttpError(400, 'Keep the external reference on the parent. Remove this reference before attaching the ticket.');
  return changes;
}

export function relationshipDetails(tickets, ticket) {
  const rows = tickets.filter(row => row.project === ticket.project), parents = new Set(rows.map(row => row.parentId).filter(Boolean));
  const children = rows.filter(row => row.parentId === ticket.id);
  const parent = rows.find(row => row.id === ticket.parentId);
  return {parent: parent ? summary(parent) : null, children: children.map(summary),
    parentOptions: children.length ? [] : rows.filter(row => row.id !== ticket.id && !row.parentId).map(summary),
    childOptions: ticket.parentId ? [] : rows.filter(row => row.id !== ticket.id && !row.parentId && !row.radarUrl && !parents.has(row.id)).map(summary)};
}

export function relationshipSummaries(tickets, visible) {
  const byId = new Map(tickets.map(row => [row.id, row])), counts = new Map();
  for (const child of tickets) {
    if (!child.parentId || byId.get(child.parentId)?.project !== child.project) continue;
    const count = counts.get(child.parentId) || {completed: 0, total: 0};
    count.total++; if (child.status === 'completed') count.completed++;
    counts.set(child.parentId, count);
  }
  return Object.fromEntries(visible.map(ticket => {
    const parent = byId.get(ticket.parentId);
    return [ticket.id, {parent: parent?.project === ticket.project ? {id: parent.id, title: parent.title} : null,
      subtasks: counts.get(ticket.id) || {completed: 0, total: 0}}];
  }));
}

// Counts include children outside the current board page, filter and column.
// Only authorized, visible ticket IDs and their project IDs enter this query.
export async function sqlRelationshipSummaries(client, result) {
  if (!result.tickets?.length) return {...result, relationships: {}};
  const rows = (await client.query(`SELECT t.id, p.id AS parent_id, p.data->>'title' AS parent_title,
    count(c.id)::integer AS total,
    count(c.id) FILTER (WHERE c.data->>'status'='completed')::integer AS completed
    FROM project_plannr.entities t
    LEFT JOIN project_plannr.entities p ON p.kind='ticket' AND p.id=t.data->>'parentId' AND p.project_id=t.project_id
    LEFT JOIN project_plannr.entities c ON c.kind='ticket' AND c.project_id=t.project_id AND c.data->>'parentId'=t.id
    WHERE t.kind='ticket' AND t.id=ANY($1::text[]) AND t.project_id=ANY($2::text[])
    GROUP BY t.id, p.id, p.data->>'title'`, [result.tickets.map(row => row.id), [...new Set(result.tickets.map(row => row.project))]])).rows;
  return {...result, relationships: Object.fromEntries(rows.map(row => [row.id, {
    parent: row.parent_id ? {id: row.parent_id, title: row.parent_title} : null,
    subtasks: {completed: Number(row.completed), total: Number(row.total)}
  }]))};
}
