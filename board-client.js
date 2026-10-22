import {checklistItems} from './ticket-checklist.js';
// Browser coordination, also exercised without a browser by regression tests.
export function createReadGate() {
  let generation = 0, sequence = 0;
  return {begin: () => ({generation, sequence: ++sequence}), invalidate: () => {generation++;},
    accept: token => token.generation === generation && token.sequence === sequence};
}

// Independent lane reads may finish in any order. Filters, mutations and sign-out
// invalidate all lanes together, without making one project cancel another.
export function createPageGate() {
  let generation = 0;
  const pending = new Map();
  return {
    begin(key) {if(pending.has(key))return null;const token={key, generation};pending.set(key,token);return token;},
    accept(token) {return token && token.generation === generation && pending.get(token.key) === token;},
    finish(token) {if(pending.get(token.key)===token)pending.delete(token.key);},
    invalidate() {generation++;pending.clear();},
    has: key => pending.has(key),
    get pending() {return pending.size > 0;},
  };
}

export function appendCompletedPage(state, page, project) {
  const ids = new Set(state.tickets.map(row => row.id));
  state.tickets.push(...page.tickets.filter(row => !ids.has(row.id)));
  const metadata = {...page, tickets: undefined, expanded: true};
  if (project) state.completedByProject[project] = metadata;
  else state.completed = metadata;
}

export const laneKey = (project, status) => JSON.stringify([project, status]);
export function projectFolds(storage) {
  const key = 'project-plannr:collapsed-projects';
  let ids;
  try {const value = JSON.parse(storage?.getItem(key) || '[]');ids = new Set(Array.isArray(value) ? value.filter(id => typeof id === 'string') : []);} catch {ids = new Set();}
  return {isCollapsed: (id, searching = false) => !searching && ids.has(id),
    toggle(id) {if(ids.has(id))ids.delete(id);else ids.add(id);try {storage?.setItem(key, JSON.stringify([...ids]));} catch {}}};
}
export const nearLaneEnd = ({scrollTop, clientHeight, scrollHeight}) => clientHeight > 0 && scrollHeight - clientHeight - scrollTop <= 96;
export function appendLanePage(state, page, key) {
  if (laneKey(page.project, page.status) !== key || !state.lanes?.[key]) throw Error('This page no longer matches the column. Refresh the board.');
  const ids = new Set(state.tickets.map(row => row.id));
  for (const row of page.tickets) if (!ids.has(row.id)) {state.tickets.push(row);ids.add(row.id);}
  state.lanes[key] = {...page, tickets: undefined, expanded: true};
}

export function createTicketUpdates({getTicket, readTicket, writeTicket, applyTicket, invalidate}) {
  const queues = new Map();
  const unchanged = (base, fresh, patch) => ['status', 'ownerId', 'leaseUntil', ...Object.keys(patch).filter(key => key !== 'comment')]
    .every(key => key === 'checklistChanges' ? JSON.stringify(checklistItems(base)) === JSON.stringify(checklistItems(fresh)) : base[key] === fresh[key]);
  return {
    get pending() {return queues.size > 0;},
    update(id, patch, expected) {
      invalidate();
      const work = (queues.get(id) || Promise.resolve()).catch(() => {}).then(async () => {
        const base = expected || getTicket(id);
        if (!base) throw Error('This ticket is no longer on the board. Refresh to find it again.');
        let result;
        try {result = await writeTicket(id, {revision: base.revision, ...patch});}
        catch (error) {
          if (error.status !== 409) throw error;
          const fresh = await readTicket(id); applyTicket(fresh); invalidate();
          if (!unchanged(base, fresh, patch)) throw Error(expected
            ? 'This ticket changed while you were editing. Your draft is kept. Review the latest ticket before saving again.'
            : 'Another person or agent changed this ticket’s status or ownership. Review the latest ticket before trying again.');
          // One safe retry only. A second conflict is surfaced, never looped.
          try {result = await writeTicket(id, {revision: fresh.revision, ...patch});}
          catch (retryError) {if(retryError.status===409)throw Error('This ticket changed again. Review the latest ticket before trying again.');throw retryError;}
        }
        invalidate(); applyTicket(result); return result;
      });
      queues.set(id, work);
      void work.finally(() => {if (queues.get(id) === work) queues.delete(id);}).catch(() => {});
      return work;
    },
  };
}
