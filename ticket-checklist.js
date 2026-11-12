// Shared checklist contract. Legacy tickets have an empty checklist; Markdown
// and notes are never interpreted as completion evidence.
export const checklistLimit = 100, checklistTextLimit = 300;
export const checklistItems = ticket => ticket.checklist ?? [];
export function checklistProgress(ticket) {
  const items = checklistItems(ticket);
  return {total: items.length, completed: items.filter(item => item.completed).length};
}
export function checklistDiff(base, draft) {
  const before = new Map(checklistItems(base).map(item => [item.id, item])), after = new Set(draft.map(item => item.id));
  const changes = checklistItems(base).filter(item => !after.has(item.id)).map(item => ({action: 'remove', id: item.id}));
  for (const item of draft) {
    const old = before.get(item.id), text = item.text.trim();
    if (!old) changes.push({action: 'add', id: item.id, text, completed: item.completed});
    else if (old.text !== text || old.completed !== item.completed) changes.push({action: 'update', id: item.id, text, completed: item.completed});
  }
  return changes;
}

// Work on a copy and validate the whole batch before the transaction changes
// anything. IDs survive text edits and allow agents to address one item safely.
export function applyChecklistChanges(ticket, changes, makeId) {
  if (!Array.isArray(changes) || !changes.length || changes.length > checklistLimit * 2) throw Error('Send 1 to 200 checklist changes.');
  const items = checklistItems(ticket).map(item => ({...item}));
  for (const change of changes) {
    if (!change || typeof change !== 'object' || Array.isArray(change) || !['add', 'update', 'remove'].includes(change.action)) throw Error('Choose add, update, or remove for each checklist change.');
    const allowed = change.action === 'remove' ? ['action', 'id'] : ['action', 'id', 'text', 'completed'];
    if (Object.keys(change).some(key => !allowed.includes(key))) throw Error('Unknown checklist change field.');
    const id = change.action === 'add' && change.id === undefined ? makeId() : change.id;
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw Error('Use a checklist item ID of 1 to 64 letters, numbers, underscores, or hyphens.');
    const index = items.findIndex(item => item.id === id);
    if (change.action === 'add' ? index !== -1 : index === -1) throw Error(change.action === 'add' ? 'Checklist item ID already exists.' : 'Checklist item no longer exists. Reload the ticket.');
    if (change.action === 'remove') {items.splice(index, 1);continue;}
    if (change.text !== undefined && (typeof change.text !== 'string' || !change.text.trim() || change.text.trim().length > checklistTextLimit)) throw Error('Checklist item text must be 1 to 300 characters.');
    if (change.completed !== undefined && typeof change.completed !== 'boolean') throw Error('Checklist completion must be true or false.');
    if (change.action === 'add') {
      if (change.text === undefined) throw Error('Add checklist item text.');
      items.push({id, text: change.text.trim(), completed: change.completed ?? false});
    } else {
      if (change.text === undefined && change.completed === undefined) throw Error('Choose a checklist item change.');
      if (change.text !== undefined) items[index].text = change.text.trim();
      if (change.completed !== undefined) items[index].completed = change.completed;
    }
    if (items.length > checklistLimit) throw Error('A ticket can have up to 100 checklist items.');
  }
  return items;
}
