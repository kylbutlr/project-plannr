import {HttpError, canAccess} from './auth.mjs';
import {memoryLaneBoard, sqlLaneBoard} from './lane-page.mjs';
import {boardSorts} from '../ticket-priority.js';

export const pageSize = 20;
const stamp = row => row.completedAt || '';
export const compareCompleted = (a, b) => stamp(a) < stamp(b) ? 1 : stamp(a) > stamp(b) ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
export function boardSelection(state, actor, params = new URLSearchParams()) {
  const project = params.get('project') || 'all', search = (params.get('q') || '').trim();
  const searchAll = params.get('searchScope') === 'all';
  const sort = params.get('sort') || 'default';
  if (!boardSorts.includes(sort)) throw new HttpError(400, 'Choose Default, Priority, or Recent sorting.');
  if (search.length > 120) throw new HttpError(400, 'Keep ticket search under 120 characters.');
  const projects = state.projects.filter(row => canAccess(actor, row.id));
  if (project !== 'all' && !projects.some(row => row.id === project && !row.archived)) throw new HttpError(404, 'Active project not found in your workspace.');
  let cursor = null;
  if (params.has('cursor')) {
    try {
      const value = params.get('cursor'); if (value.length > 1000) throw Error();
      cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      if (typeof cursor.id !== 'string' || !cursor.id || typeof cursor.time !== 'string' || cursor.project !== project || cursor.search !== search || Boolean(cursor.searchAll) !== searchAll) throw Error();
    } catch {throw new HttpError(400, 'This ticket page no longer matches your filters. Refresh the board.');}
  }
  return {prototype: false, projects, activity: state.activity.filter(row => actor.owner || projects.some(p => p.id === row.project)).slice(0, 100),
    ids: projects.filter(row => !row.archived && (project === 'all' || row.id === project)).map(row => row.id), project, search, searchAll, cursor,
    perProject: params.get('view') === 'swimlanes', view: params.get('view') || 'kanban',
    lanePaging: params.get('paging') === 'lanes', status: params.get('status'), sort};
}
export function completedPage(rows, total, selection) {
  const tickets = rows.slice(0, pageSize), last = tickets.at(-1);
  return {tickets, total, nextCursor: rows.length > pageSize && last ? Buffer.from(JSON.stringify({time: stamp(last), id: last.id,
    project: selection.project, search: selection.search, searchAll: selection.searchAll})).toString('base64url') : null};
}
export function memoryBoardPage(state, selection, completedOnly = false) {
  if (selection.lanePaging && !completedOnly) return memoryLaneBoard(state, selection);
  const scoped = state.tickets.filter(row => selection.ids.includes(row.project));
  const matches = scoped.filter(row => row.status === 'completed' && (!selection.search ||
    `${row.id}\n${row.title}\n${row.description}`.toLowerCase().includes(selection.search.toLowerCase()))).sort(compareCompleted);
  const rows = selection.cursor ? matches.filter(row => compareCompleted(row, {id: selection.cursor.id, completedAt: selection.cursor.time}) > 0) : matches;
  const completed = completedPage(rows, matches.length, selection);
  if (completedOnly) return completed;
  const completedByProject = selection.perProject ? Object.fromEntries(selection.ids.map(id => {
    const group = matches.filter(row => row.project === id);
    return [id, completedPage(group, group.length, {...selection, project: id})];
  })) : undefined;
  return {prototype: selection.prototype, projects: selection.projects.map(project => ({...project,
    ticketCount: state.tickets.filter(row => row.project === project.id).length})), activity: selection.activity,
    tickets: [...scoped.filter(row => row.status !== 'completed' && (!selection.searchAll || !selection.search || `${row.id}\n${row.title}\n${row.description}`.toLowerCase().includes(selection.search.toLowerCase()))), ...(completedByProject ? Object.values(completedByProject).flatMap(page => page.tickets) : completed.tickets)],
    completed: completedByProject ? undefined : {...completed, tickets: undefined},
    completedByProject: completedByProject && Object.fromEntries(Object.entries(completedByProject).map(([id, page]) => [id, {...page, tickets: undefined}]))};
}

// Bounded SQL reads: completed history is not loaded and then hidden in JS.
export async function sqlBoardPage(client, selection, completedOnly = false) {
  if (selection.lanePaging && !completedOnly) return sqlLaneBoard(client, selection);
  const search = selection.search.toLowerCase(), cursor = selection.cursor;
  const where = `kind='ticket' AND project_id=ANY($1::text[]) AND data->>'status'='completed'
    AND ($2='' OR strpos(lower(id || E'\\n' || (data->>'title') || E'\\n' || coalesce(data->>'description','')), $2)>0)`;
  let completed, completedByProject;
  if (selection.perProject && !completedOnly) {
    // One partitioned read, not a separate query or full snapshot per project.
    const groups = (await client.query(`WITH ranked AS (SELECT project_id, data,
      row_number() OVER (PARTITION BY project_id ORDER BY coalesce(data->>'completedAt','') COLLATE "C" DESC, id COLLATE "C" DESC) AS page_rank,
      count(*) OVER (PARTITION BY project_id) AS total
      FROM project_plannr.entities WHERE ${where})
      SELECT project_id, data, total FROM ranked WHERE page_rank<=21 ORDER BY project_id, page_rank`, [selection.ids, search])).rows;
    completedByProject = Object.fromEntries(selection.ids.map(id => {
      const group = groups.filter(row => row.project_id === id);
      return [id, completedPage(group.map(row => row.data), Number(group[0]?.total || 0), {...selection, project: id})];
    }));
  } else {
  const rows = (await client.query(`SELECT data FROM project_plannr.entities WHERE ${where}
    AND ($3::text IS NULL OR (coalesce(data->>'completedAt','') COLLATE "C", id COLLATE "C")<($3::text COLLATE "C",$4::text COLLATE "C"))
    ORDER BY coalesce(data->>'completedAt','') COLLATE "C" DESC, id COLLATE "C" DESC LIMIT 21`,
    [selection.ids, search, cursor?.time ?? null, cursor?.id ?? null])).rows.map(row => row.data);
  const total = Number((await client.query(`SELECT count(*)::integer AS total FROM project_plannr.entities WHERE ${where}`, [selection.ids, search])).rows[0].total);
  completed = completedPage(rows, total, selection);
  }
  if (completedOnly) return completed;
  const active = (await client.query(`SELECT data FROM project_plannr.entities WHERE kind='ticket'
    AND project_id=ANY($1::text[]) AND data->>'status'!='completed'
    ${selection.searchAll ? "AND ($2='' OR strpos(lower(id || E'\\n' || (data->>'title') || E'\\n' || coalesce(data->>'description','')), $2)>0)" : ''}
    ORDER BY id`, selection.searchAll ? [selection.ids, search] : [selection.ids])).rows.map(row => row.data);
  const counts = new Map((await client.query(`SELECT project_id, count(*)::integer AS total FROM project_plannr.entities
    WHERE kind='ticket' AND project_id=ANY($1::text[]) GROUP BY project_id`, [selection.projects.map(row => row.id)])).rows.map(row => [row.project_id, Number(row.total)]));
  return {prototype: selection.prototype, projects: selection.projects.map(row => ({...row, ticketCount: counts.get(row.id) || 0})),
    activity: selection.activity, tickets: [...active, ...(completedByProject ? Object.values(completedByProject).flatMap(page => page.tickets) : completed.tickets)],
    completed: completedByProject ? undefined : {...completed, tickets: undefined},
    completedByProject: completedByProject && Object.fromEntries(Object.entries(completedByProject).map(([id, page]) => [id, {...page, tickets: undefined}]))};
}
