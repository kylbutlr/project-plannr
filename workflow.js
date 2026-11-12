// Column identity is independent of the stable state used by older clients.
export const categories = {waiting: 'Waiting', ready: 'Ready', active: 'Active', done: 'Done'};
export const categoryStates = {waiting: 'waiting', ready: 'next', active: 'in-progress', done: 'completed'};
export const defaultColumns = [
  {id: 'next', name: 'Next', category: 'ready', enabled: true},
  {id: 'in-progress', name: 'In progress', category: 'active', enabled: true},
  {id: 'completed', name: 'Completed', category: 'done', enabled: true},
];
export const workflowOf = state => state.workflow || {revision: 1, columns: defaultColumns};
export const ticketColumn = ticket => ticket.columnId || ticket.status;
export const columnOf = (workflow, ticket) => workflow.columns.find(column => column.id === ticketColumn(ticket));
export const pickupReady = (workflow, ticket) => {
  const column = columnOf(workflow, ticket);
  return column?.enabled === true && column.category === 'ready';
};
export const stateColumn = (workflow, status) => {
  const matches = workflow.columns.filter(column => column.enabled && categoryStates[column.category] === status);
  return matches.find(column => column.id === status) || matches[0];
};
