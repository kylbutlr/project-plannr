// Shared by browser, API pagination and agent clients. Numeric priority is the
// preserved legacy queue rank, not a severity. Missing levels default to P2.
export const priorityLevels = {P0: 'Critical', P1: 'High', P2: 'Normal', P3: 'Low'};
export const priorityLevel = row => Object.hasOwn(priorityLevels, row.priorityLevel) ? row.priorityLevel : 'P2';
export const priorityIndex = row => Number(priorityLevel(row).slice(1));
export const comparePriority = (a, b) => priorityIndex(a) - priorityIndex(b);
export const compareActive = (a, b) => comparePriority(a, b) || a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export const boardSorts = ['default', 'priority', 'recent'];
export const ticketSequence = row => /^PLNR-\d+$/.test(row.id) ? Number(row.id.slice(5)) : 0;
const descendingId = (a, b) => a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
export const compareRecent = (a, b) => a.status === 'completed'
  ? ((a.completedAt || '') < (b.completedAt || '') ? 1 : (a.completedAt || '') > (b.completedAt || '') ? -1 : descendingId(a, b))
  : ticketSequence(b) - ticketSequence(a) || descendingId(a, b);
export const compareLane = (a, b, sort = 'default') => sort === 'recent' || sort === 'default' && a.status === 'completed'
  ? compareRecent(a, b)
  : a.status === 'completed' ? comparePriority(a, b) || compareRecent(a, b) : compareActive(a, b);
