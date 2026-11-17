export const preferenceKey = 'project-plannr:preferences:v1';
export const preferenceDefaults = Object.freeze({workspaceName: 'Your projects', displayName: '', theme: 'dark', density: 'comfortable', defaultView: 'swimlanes'});
const name = (value, fallback, limit) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit) || fallback : fallback;
export function normalizePreferences(value) {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {workspaceName: name(row.workspaceName, preferenceDefaults.workspaceName, 64), displayName: name(row.displayName, '', 48),
    theme: row.theme === 'light' ? 'light' : 'dark', density: row.density === 'compact' ? 'compact' : 'comfortable',
    defaultView: ['swimlanes','kanban','queue'].includes(row.defaultView) ? row.defaultView : 'swimlanes'};
}
export function readPreferences(storage) { try {return normalizePreferences(JSON.parse(storage?.getItem(preferenceKey) || '{}'));} catch {return {...preferenceDefaults};} }
export function savePreferences(storage, value) { try {if (!storage) return false;storage.setItem(preferenceKey, JSON.stringify(normalizePreferences(value)));return true;} catch {return false;} }
