import {emptyState} from './store.mjs';
export function demoState() {
  const state = emptyState();
  state.projects = [{id: 'worldrawn', name: 'Worldrawn', kind: 'game', archived: false, revision: 1}, {id: 'track-forgr', name: 'Track Forgr', kind: 'game', archived: false, revision: 1}];
  state.tickets = [
    ['WR-POI-017', 'worldrawn', 'Town depth', 'Vary civic, commercial and resident activity. Illustrative copy, not an imported ledger.', 1, 'next'],
    ['WR-POI-018', 'worldrawn', 'Mine interiors', 'Explore alternate discoveries beyond the visual work rooms.', 2, 'next'],
    ['WR-POI-012', 'worldrawn', 'Connected discoveries', 'Broaden compatible landmark pairs after the first trail proves useful.', 3, 'next'],
    ['WR-DEMO-001', 'worldrawn', 'Resident greetings review', 'Illustrative completed ticket, not a new ledger status.', 4, 'completed'],
    ['TF-DEMO-001', 'track-forgr', 'Procedural course quality', 'Illustrative priority inspired by development targets.', 1, 'next'],
    ['TF-DEMO-002', 'track-forgr', 'Rival behavior review', 'Illustrative active work. No real agent has been assigned.', 2, 'in-progress'],
  ].map(([id, project, title, description, priority, status]) => ({id, project, title, description, priority, status, revision: 1,
    owner: status === 'in-progress' ? 'Example agent' : null, ownerId: status === 'in-progress' ? 'example' : null,
    leaseUntil: status === 'in-progress' ? Date.now() + 300000 : 0, comments: []}));
  return state;
}
