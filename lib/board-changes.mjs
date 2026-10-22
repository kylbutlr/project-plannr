import {createHash} from 'node:crypto';

// Metadata only, independent of search, paging and the truncated activity feed.
// Revisions increase on every ticket mutation, including agent notes and claims.
function token(selection, counts) {
  const rows = selection.projects.filter(p => selection.project === 'all' || p.id === selection.project)
    .map(p => [p.id, p.revision, p.archived, ...(counts.get(p.id) || ['0', '0'])])
    .sort((a, b) => a[0].localeCompare(b[0]));
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}
export function memoryChanges(state, selection) {
  const counts = new Map();
  for (const p of selection.projects) {
    const tickets = state.tickets.filter(t => t.project === p.id);
    counts.set(p.id, [String(tickets.length), tickets.reduce((sum, t) => sum + BigInt(t.revision), 0n).toString()]);
  }
  return token(selection, counts);
}
export async function sqlChanges(client, selection) {
  const rows = (await client.query(`SELECT project_id, count(*)::text AS ticket_count,
    coalesce(sum((data->>'revision')::bigint),0)::text AS revision_sum
    FROM project_plannr.entities WHERE kind='ticket' AND project_id=ANY($1::text[]) GROUP BY project_id`,
  [selection.projects.filter(p => selection.project === 'all' || p.id === selection.project).map(p => p.id)])).rows;
  return token(selection, new Map(rows.map(r => [r.project_id, [r.ticket_count, r.revision_sum]])));
}
