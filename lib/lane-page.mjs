import {HttpError} from './auth.mjs';
import {compareLane, priorityLevel, priorityIndex, priorityLevels, boardSorts, ticketSequence} from '../ticket-priority.js';

export const laneStages = ['next', 'in-progress', 'completed'];
export const laneKey = (project, status) => JSON.stringify([project, status]);
export const laneSize = selection => selection.view === 'swimlanes' ? 5 : 10;
export const laneOrder = compareLane;

function validateView(selection) {
  if (!['swimlanes', 'kanban'].includes(selection.view)) throw new HttpError(400, 'Choose a valid board view.');
  if (!boardSorts.includes(selection.sort || 'default')) throw new HttpError(400, 'Choose a valid board sort.');
}
function validate(selection) {
  validateView(selection);
  if (!laneStages.includes(selection.status)) throw new HttpError(400, 'Choose a valid ticket column.');
  const c = selection.cursor;
  if (c && (c.sort !== (selection.sort || 'default') || c.status !== selection.status || c.view !== selection.view || !Number.isSafeInteger(c.priority) || c.priority < 0 || typeof c.priorityLevel !== 'string' || !Object.hasOwn(priorityLevels, c.priorityLevel))) throw new HttpError(400, 'This column page no longer matches your view or sort. Refresh the board.');
}
function page(rows, total, selection) {
  const size = laneSize(selection), tickets = rows.slice(0, size), last = tickets.at(-1);
  return {project: selection.project, status: selection.status, total,
    nextCursor: rows.length > size && last ? Buffer.from(JSON.stringify({id: last.id, time: last.completedAt || '', priority: last.priority, priorityLevel: priorityLevel(last),
      status: selection.status, project: selection.project, search: selection.search, searchAll: selection.searchAll, view: selection.view, sort: selection.sort || 'default'})).toString('base64url') : null,
    tickets};
}
const matches = (row, selection) => selection.ids.includes(row.project) && row.status === selection.status && (!selection.searchAll && row.status !== 'completed' || !selection.search ||
  `${row.id}\n${row.title}\n${row.description}`.toLowerCase().includes(selection.search.toLowerCase()));

export function memoryLanePage(state, selection) {
  validate(selection);
  const order = (a, b) => laneOrder(a, b, selection.sort);
  const all = state.tickets.filter(row => matches(row, selection)).sort(order);
  const rows = selection.cursor ? all.filter(row => order(row, {id: selection.cursor.id, status: selection.status, priority: selection.cursor.priority, priorityLevel: selection.cursor.priorityLevel, completedAt: selection.cursor.time}) > 0) : all;
  return page(rows, all.length, selection);
}
function boardResult(selection, pages, counts) {
  return {prototype: selection.prototype, laneView: selection.view, laneSort: selection.sort || 'default', projects: selection.projects.map(row => ({...row, ticketCount: counts.get(row.id) || 0})), activity: selection.activity,
    tickets: pages.flatMap(row => row.tickets), lanes: Object.fromEntries(pages.map(row => [laneKey(row.project, row.status), {...row, tickets: undefined}]))};
}
export function memoryLaneBoard(state, selection) {
  validateView(selection);
  const groups = selection.perProject ? selection.ids : [selection.project];
  const pages = groups.flatMap(project => laneStages.map(status => memoryLanePage(state, {...selection, project, status,
    ids: selection.perProject ? [project] : selection.ids, cursor: null})));
  return boardResult(selection, pages, new Map(selection.projects.map(project => [project.id, state.tickets.filter(row => row.project === project.id).length])));
}

const searchWhere = selection => `(${selection.searchAll ? '' : "data->>'status'!='completed' OR "}$2='' OR strpos(lower(id || E'\\n' || (data->>'title') || E'\\n' || coalesce(data->>'description','')), $2)>0)`;
export const sqlPriorityIndex = `CASE data->>'priorityLevel' WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P3' THEN 3 ELSE 2 END`;
export const sqlTicketSequence = `CASE WHEN id ~ '^PLNR-[0-9]+$' THEN substring(id FROM 6)::bigint ELSE 0 END`;
const sqlSortPriority = sort => sort === 'recent' ? '0::integer' : sort === 'priority' ? sqlPriorityIndex : `CASE WHEN data->>'status'='completed' THEN 0 ELSE (${sqlPriorityIndex}) END`;
const sqlOrder = sort => `(${sqlSortPriority(sort)}) ASC,
  CASE WHEN data->>'status'!='completed' THEN ${sort === 'recent' ? `(${sqlTicketSequence})` : "(data->>'priority')::bigint"} END ${sort === 'recent' ? 'DESC' : 'ASC'},
  CASE WHEN data->>'status'='completed' THEN coalesce(data->>'completedAt','') END COLLATE "C" DESC,
  CASE WHEN data->>'status'='completed' THEN id END COLLATE "C" DESC,
  CASE WHEN data->>'status'!='completed' THEN id END COLLATE "C" ${sort === 'recent' ? 'DESC' : 'ASC'}`;

export async function sqlLaneBoard(client, selection) {
  validateView(selection);
  const partition = selection.perProject ? "project_id, data->>'status'" : "data->>'status'";
  const rows = (await client.query(`WITH lane_ranked AS (SELECT project_id, data, data->>'status' AS status,
    row_number() OVER (PARTITION BY ${partition} ORDER BY ${sqlOrder(selection.sort)}) AS page_rank,
    count(*) OVER (PARTITION BY ${partition}) AS total FROM project_plannr.entities
    WHERE kind='ticket' AND project_id=ANY($1::text[]) AND ${searchWhere(selection)})
    SELECT project_id, data, status, total FROM lane_ranked WHERE page_rank<=$3 ORDER BY project_id, status, page_rank`,
  [selection.ids, selection.search.toLowerCase(), laneSize(selection) + 1])).rows;
  const groups = selection.perProject ? selection.ids : [selection.project];
  const pages = groups.flatMap(project => laneStages.map(status => {
    const group = rows.filter(row => row.status === status && (!selection.perProject || row.project_id === project)).sort((a, b) => laneOrder(a.data, b.data, selection.sort));
    return page(group.map(row => row.data), Number(group[0]?.total || 0), {...selection, project, status});
  }));
  const counts = new Map((await client.query(`SELECT project_id, count(*)::integer AS total FROM project_plannr.entities
    WHERE kind='ticket' AND project_id=ANY($1::text[]) GROUP BY project_id`, [selection.projects.map(row => row.id)])).rows.map(row => [row.project_id, Number(row.total)]));
  return boardResult(selection, pages, counts);
}

export async function sqlLanePage(client, selection) {
  validate(selection);
  const c = selection.cursor;
  const sort = selection.sort || 'default', priority = sqlSortPriority(sort);
  const boundary = `((${priority})>$8::integer OR ((${priority})=$8::integer AND CASE WHEN $3='completed' THEN
    (coalesce(data->>'completedAt','') COLLATE "C", id COLLATE "C")<($4::text COLLATE "C",$5::text COLLATE "C")
    ELSE (${sort === 'recent' ? `(${sqlTicketSequence})` : "(data->>'priority')::bigint"}, id COLLATE "C")${sort === 'recent' ? '<' : '>'}($6::bigint,$5::text COLLATE "C") END))`;
  const where = `kind='ticket' AND project_id=ANY($1::text[]) AND ${searchWhere(selection)} AND data->>'status'=$3`;
  const rows = (await client.query(`SELECT data FROM project_plannr.entities WHERE ${where}
    AND ($5::text IS NULL OR ${boundary}) ORDER BY ${sqlOrder(sort)} LIMIT $7`,
  [selection.ids, selection.search.toLowerCase(), selection.status, c?.time ?? null, c?.id ?? null, c ? sort === 'recent' ? ticketSequence(c) : c.priority : null, laneSize(selection) + 1, c ? sort === 'recent' || sort === 'default' && selection.status === 'completed' ? 0 : priorityIndex(c) : null])).rows.map(row => row.data);
  const total = Number((await client.query(`SELECT count(*)::integer AS total FROM project_plannr.entities WHERE ${where}`,
    [selection.ids, selection.search.toLowerCase(), selection.status])).rows[0].total);
  return page(rows, total, selection);
}
