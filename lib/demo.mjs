import {emptyState} from './store.mjs';
export function demoState() {
  const state = emptyState();
  state.projects = [{id: 'fieldnotes', name: 'Fieldnotes', kind: 'app', archived: false, revision: 1}, {id: 'atlas', name: 'Atlas', kind: 'app', archived: false, revision: 1}];
  state.tickets = [
    ['DEMO-101', 'fieldnotes', 'Review responsive navigation', 'Check the menu across desktop and phone layouts. Fictional demonstration data.', 1, 'next'],
    ['DEMO-102', 'fieldnotes', 'Refine product filters', 'Keep selected filters visible and easy to clear. Fictional demonstration data.', 2, 'next'],
    ['DEMO-103', 'fieldnotes', 'Prepare release notes', 'Document the changes and verification steps. Fictional demonstration data.', 3, 'next'],
    ['DEMO-104', 'fieldnotes', 'Verify keyboard focus', 'Illustrative completed review, not a claim about real work.', 4, 'completed'],
    ['DEMO-201', 'atlas', 'Review API error responses', 'Use consistent responses for invalid requests. Fictional demonstration data.', 1, 'next'],
    ['DEMO-202', 'atlas', 'Confirm loading and empty states', 'Illustrative active work. No real agent has been assigned.', 2, 'in-progress'],
  ].map(([id, project, title, description, priority, status]) => ({id, project, title, description, priority, status, revision: 1,
    owner: status === 'in-progress' ? 'Example agent' : null, ownerId: status === 'in-progress' ? 'example' : null,
    leaseUntil: status === 'in-progress' ? Date.now() + 300000 : 0, comments: []}));
  return state;
}
