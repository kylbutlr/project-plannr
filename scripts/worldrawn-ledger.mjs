import {createHash} from 'node:crypto';
import {audit} from '../lib/auth.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const stages = {'Idea': 'next', 'Needs polish': 'next', 'In progress': 'in-progress', 'Done': 'completed'};
const chunks = text => Array.from({length: Math.ceil(text.length / 1800)}, (_, i) => text.slice(i * 1800, (i + 1) * 1800));

// A one-time administrative import, not a public API or a second editable ledger.
export function planWorldrawnImport(markdown, revision) {
  if (!/^[a-f0-9]{40}$/.test(revision)) throw Error('An immutable source commit is required.');
  const source = `https://github.com/kylbutlr/worldrawn/blob/${revision}/docs/poi-ledger.md`;
  const base = `https://github.com/kylbutlr/worldrawn/blob/${revision}/docs/`;
  const linked = text => text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (whole, label, url) =>
    `[${label}](${new URL(url, base).href})`);
  const lines = markdown.split(/(?<=\n)/), entries = [], context = [];
  let category = '', entry;
  for (const line of lines) {
    if (line.startsWith('## ')) {category = line.slice(3).trim(); entry = undefined;}
    const title = /^- \*\*(.+)\*\* \((POI-\d{3})\)\s*$/.exec(line);
    if (title) {entry = {key: title[2], name: title[1], category, raw: ''}; entries.push(entry);}
    else if (entry && line.trim() && !/^\s/.test(line)) entry = undefined;
    if (entry) entry.raw += line;
    else context.push(line);
  }
  const ids = new Set();
  for (const item of entries) {
    if (ids.has(item.key)) throw Error(`Duplicate source ID: ${item.key}`);
    ids.add(item.key);
    item.legacyStatus = /^  - Status: (.+)$/m.exec(item.raw)?.[1];
    item.status = stages[item.legacyStatus];
    if (!item.status) throw Error(`Unsupported source status: ${item.key}`);
  }
  // Require complete coverage of this explicitly authorized source snapshot.
  if (entries.length !== 34 || Array.from({length: 34}, (_, i) => `POI-${String(i + 1).padStart(3, '0')}`).some(id => !ids.has(id))) {
    throw Error('Expected every source ID from POI-001 through POI-034. Review a changed ledger before importing.');
  }
  const top = [...markdown.matchAll(/^- (POI-\d{3})(?: follow-up)?:/gm)].map(match => match[1]);
  if (top.join(',') !== 'POI-017,POI-018,POI-012') throw Error('Review changed roadmap priorities before importing.');
  const order = [...top, ...entries.map(item => item.key).filter(id => !top.includes(id))];
  entries.push({key: 'roadmap-context', name: 'Worldrawn roadmap context and standing requirements', category: 'Planning reference',
    legacyStatus: 'Reference', status: 'next', raw: context.join('')});
  const tickets = entries.map(item => {
    const body = linked(item.raw), reference = `Source: ${source}\nCategory: ${item.category}\nImported ledger status: ${item.legacyStatus}\n\n`;
    const title = item.key.startsWith('POI-') ? `${item.key}: ${item.name}` : item.name;
    const long = reference.length + body.length > 4000;
    const description = long ? `${reference}Full source notes are preserved in the imported notes below.\n\n${
      [...body.matchAll(/^  - (?:Next step|Remaining):[^\n]*(?:\n    [^\n]*)*/gm)].map(match => match[0]).join('\n\n') || 'Keep this planning reference available; it is not a new gameplay task.'}` : reference + body;
    if (description.length > 4000 || title.length > 120) throw Error(`Ticket exceeds editor limits: ${item.key}`);
    return {...item, title, description, notes: long ? chunks(body) : [], priority: item.key === 'roadmap-context' ? 35 : order.indexOf(item.key) + 1,
      sourceKey: `worldrawn-poi-ledger:${item.key}`, sourceHash: digest(item.raw)};
  });
  return {source, revision, sourceHash: digest(markdown), tickets};
}

export async function importWorldrawnPlan(store, plan, projectId, now = Date.now()) {
  return store.transact(state => {
    const project = state.projects.find(row => row.id === projectId);
    if (!project || project.name !== 'Worldrawn' || project.kind !== 'game' || project.archived) throw Error('Expected the existing active Worldrawn game project.');
    const existing = state.tickets.filter(row => row.project === projectId);
    // Check every collision before writing anything. Never refresh over subsequent board edits.
    for (const item of plan.tickets) {
      const matches = existing.filter(row => row.importSource?.key === item.sourceKey);
      if (matches.length > 1 || matches.length && matches[0].importSource.hash !== item.sourceHash) throw Error(`Changed or duplicate import source: ${item.key}`);
      if (!matches.length && existing.some(row => row.title === item.title || item.key.startsWith('POI-') && row.title.includes(item.key))) throw Error(`Review existing ticket before importing ${item.key}`);
    }
    const mapping = [];
    for (const item of plan.tickets) {
      let ticket = existing.find(row => row.importSource?.key === item.sourceKey);
      if (!ticket) {
        ticket = {id: `PLNR-${++state.counter}`, project: projectId, title: item.title, description: item.description,
          priority: item.priority, status: item.status, revision: 1, owner: null, ownerId: null, leaseUntil: 0, completedAt: null,
          comments: item.notes.map(text => ({actor: 'Worldrawn ledger import', actorId: 'owner', text, time: new Date(now).toISOString()})),
          importSource: {key: item.sourceKey, hash: item.sourceHash, snapshotHash: plan.sourceHash, url: plan.source,
            category: item.category, legacyStatus: item.legacyStatus, raw: item.raw}};
        state.tickets.push(ticket);
        audit(state, {id: 'owner', name: 'Worldrawn ledger import'}, ticket.id, `imported ${item.key} with its recorded ledger status`, projectId, now);
      }
      mapping.push({sourceId: item.key, ticketId: ticket.id, status: ticket.status, priority: ticket.priority});
    }
    return mapping;
  });
}
