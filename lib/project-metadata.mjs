import {projectType} from '../project-organization.js';

export function projectMetadata(state) {
  const times = new Map(Object.entries(state.projectActivity || {}));
  for (const row of state.activity) {
    if (row.project && row.action !== 'renew work claim' && Date.parse(row.time) > (Date.parse(times.get(row.project)) || 0)) times.set(row.project, row.time);
  }
  return state.projects.map(row => {
    const timestamp = Math.max(Date.parse(row.updatedAt) || 0, Date.parse(times.get(row.id)) || 0);
    return {...row, type: projectType(row), updatedAt: timestamp ? new Date(timestamp).toISOString() : null};
  });
}

// Return the recent feed and legacy project timestamps in one bounded-result
// read. Older projects do not lose their ordering when the global feed rotates.
export async function readProjectActivity(client, state, includeRecency = true) {
  const legacy = includeRecency ? state.projects.filter(row => !row.updatedAt).map(row => row.id) : [];
  const result = legacy.length ? await client.query(`WITH recent AS (
    SELECT data FROM project_plannr.audit ORDER BY happened_at DESC, id DESC LIMIT 100)
    SELECT 'activity' AS kind, data FROM recent
    UNION ALL SELECT 'project_recency', jsonb_build_object('id',project_id,'time',max(happened_at))
    FROM project_plannr.audit WHERE project_id=ANY($1::text[])
      AND coalesce(data->>'action','')<>'renew work claim' GROUP BY project_id`, [legacy])
    : await client.query('SELECT data FROM project_plannr.audit ORDER BY happened_at DESC, id DESC LIMIT 100');
  state.activity = result.rows.filter(row => row.kind !== 'project_recency').map(row => row.data)
    .sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')) || String(b.id || '').localeCompare(String(a.id || '')));
  state.projectActivity = Object.fromEntries(result.rows.filter(row => row.kind === 'project_recency').map(row => [row.data.id, row.data.time]));
}
