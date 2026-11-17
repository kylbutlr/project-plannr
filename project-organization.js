// Optional installation-wide categories. IDs are stored; labels and order may change.
export function parseProjectTypes(value) {
  if (!value?.trim()) return [];
  let types;
  try {types = JSON.parse(value);} catch {throw Error('PLANNR_PROJECT_TYPES must be a JSON array of {id, label} objects.');}
  if (!Array.isArray(types) || types.length > 100 || types.some(row => !row || typeof row !== 'object' || Array.isArray(row) ||
    typeof row.id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(row.id) || ['all', 'unassigned'].includes(row.id) ||
    typeof row.label !== 'string' || !row.label.trim() || row.label.trim().length > 60) || new Set(types.map(row => row.id)).size !== types.length)
    throw Error('PLANNR_PROJECT_TYPES requires up to 100 unique lowercase IDs and labels of 1 to 60 characters. IDs all and unassigned are reserved.');
  return types.map(({id, label}) => ({id, label: label.trim()}));
}
export const projectPreferenceKey = 'project-plannr:projects:v1';
export const projectType = project => typeof project.type === 'string' && project.type ? project.type : null;
export const effectiveProjectType = (project, types = []) => types.some(row => row.id === projectType(project)) ? project.type : 'unassigned';
const alphabet = new Intl.Collator('en', {sensitivity: 'base', numeric: true});
export function orderedProjects(projects, {type = 'all', sort = 'recent'} = {}, types = []) {
  const name = (a, b) => alphabet.compare(a.name, b.name) || a.id.localeCompare(b.id);
  const time = row => Number.isFinite(Date.parse(row.updatedAt)) ? Date.parse(row.updatedAt) : 0;
  const order = project => {const index = types.findIndex(row => row.id === projectType(project)); return index < 0 ? types.length : index;};
  return projects.filter(row => !types.length || type === 'all' || effectiveProjectType(row, types) === type).sort((a, b) =>
    (sort === 'type' && types.length ? order(a) - order(b)
      : sort === 'recent' ? time(b) - time(a) : 0) || name(a, b));
}
export function normalizeProjectPreferences(value, types = []) {
  return {type: types.length && ['all', 'unassigned', ...types.map(row => row.id)].includes(value?.type) ? value.type : 'all',
    sort: ['recent', 'alphabetical', ...(types.length ? ['type'] : [])].includes(value?.sort) ? value.sort : 'recent'};
}
export function readProjectPreferences(storage, types = []) {
  try {return normalizeProjectPreferences(JSON.parse(storage?.getItem(projectPreferenceKey) || '{}'), types);}
  catch {return normalizeProjectPreferences(undefined, types);}
}
export function saveProjectPreferences(storage, value, types = []) {
  try {if (!storage) return false; storage.setItem(projectPreferenceKey, JSON.stringify(normalizeProjectPreferences(value, types))); return true;}
  catch {return false;}
}
