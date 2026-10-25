// Three approved views share one authenticated workspace.
import {appendCompletedPage, appendLanePage, laneKey, nearLaneEnd, projectFolds, createPageGate, createReadGate, createChangeGate, createTicketUpdates} from './board-client.js';
import {priorityLevels, priorityLevel, compareActive, compareLane, boardSorts} from './ticket-priority.js';
import {checklistItems, checklistProgress, checklistDiff, checklistLimit, checklistTextLimit} from './ticket-checklist.js';
import {readPreferences,savePreferences,normalizePreferences,preferenceDefaults} from './workspace-preferences.js';
const $=id=>document.getElementById(id);
const names={A:'Kanban',B:'Project swimlanes',C:'Ranked queue'},viewKeys={A:'kanban',B:'swimlanes',C:'queue'};
const stages={'next':'Next','in-progress':'In progress','completed':'Completed'},kinds={game:'Game',app:'App',other:'Other'};
let state={projects:[],tickets:[],activity:[]},selected,dragged,savedView,session,epoch=0,lastActivity=Date.now(),loading=false,draftBase,draftChecklist=[],completedSearch='',reloadWanted=false;
const readGate=createReadGate(),pageGate=createPageGate();
const changeGate=createChangeGate();
let foldStorage;try{foldStorage=localStorage;}catch{}
const folds=projectFolds(foldStorage);
let preferences=readPreferences(foldStorage);
function applyPreferences(){
 document.documentElement.dataset.appStylrTheme=preferences.theme;
 document.documentElement.dataset.appStylrDensity=preferences.density;
 $('workspace-title').textContent=preferences.workspaceName;
 $('workspace-welcome').textContent=preferences.displayName?`${preferences.displayName}'s workspace. A clear view of what comes next.`:'A clear view of what comes next.';
 for(const [id,key] of [['workspace','workspaceName'],['name','displayName'],['theme','theme'],['density','density'],['view','defaultView']])$('preference-'+id).value=preferences[key];
}
applyPreferences();
const preferencePanel=$('workspace-settings');
$('toggle-preferences').onclick=()=>{preferencePanel.open=!preferencePanel.open;};
preferencePanel.addEventListener('toggle',()=>{$('toggle-preferences').setAttribute('aria-expanded',String(preferencePanel.open));});
$('preferences-form').onsubmit=event=>{event.preventDefault();preferences=normalizePreferences({workspaceName:$('preference-workspace').value,displayName:$('preference-name').value,theme:$('preference-theme').value,density:$('preference-density').value,defaultView:$('preference-view').value});const saved=savePreferences(foldStorage,preferences);applyPreferences();$('preferences-message').textContent=saved?'Saved for this browser. Your default view applies next time you open the app.':'Applied for this visit. Browser storage is unavailable.';};
$('reset-preferences').onclick=()=>{preferences={...preferenceDefaults};const saved=savePreferences(foldStorage,preferences);applyPreferences();$('preferences-message').textContent=saved?'Default preferences restored.':'Defaults applied for this visit. Browser storage is unavailable.';};
const laneErrors=new Map();
let laneObservers=[];
const invalidateReads=()=>{readGate.invalidate();pageGate.invalidate();changeGate.invalidate();};
async function ticketRequest(path,method,body){const version=epoch,result=await request(path,method,body);if(version!==epoch)throw Error('Workspace access changed. Sign in again before editing.');return result;}
const updates=createTicketUpdates({getTicket:id=>state.tickets.find(t=>t.id===id),readTicket:id=>ticketRequest(`/api/tickets/${encodeURIComponent(id)}`),
 writeTicket:(id,body)=>ticketRequest(`/api/tickets/${encodeURIComponent(id)}`,'PATCH',body),invalidate:invalidateReads,applyTicket:row=>{
  const index=state.tickets.findIndex(t=>t.id===row.id);if(index<0)state.tickets.push(row);else state.tickets[index]=row;
  render();if(selected===row.id)renderNotes(row);
 }});
try{savedView=localStorage.getItem('project-plannr:view');}catch{}
const params=new URL(location.href).searchParams;
let hasDefaultPreference=false;try{hasDefaultPreference=Boolean(JSON.parse(foldStorage?.getItem('project-plannr:preferences:v1')||'{}').defaultView);}catch{}
let variant=Object.keys(viewKeys).find(key=>viewKeys[key]===params.get('view'))||params.get('variant')||(hasDefaultPreference?Object.keys(viewKeys).find(key=>viewKeys[key]===preferences.defaultView):null)||savedView||'B';
if(!names[variant])variant='B';
let boardSort='default';try{const saved=localStorage.getItem('project-plannr:sort');if(boardSorts.includes(saved))boardSort=saved;}catch{}
$('board-sort').value=boardSort;
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const activeProjects=()=>state.projects.filter(p=>!p.archived);
const projectName=id=>state.projects.find(p=>p.id===id)?.name||'Unknown project';
const statusSelect=t=>`<label>Status for ${escape(t.id)}<select data-status="${escape(t.id)}">${Object.entries(stages).map(([key,name])=>`<option value="${key}" ${t.status===key?'selected':''}>${name}</option>`).join('')}</select></label>`;
function ticket(t){const level=priorityLevel(t),progress=checklistProgress(t);return `<article class="ticket" draggable="true" data-ticket="${escape(t.id)}"><div class="meta"><small>${escape(projectName(t.project))}<br>${escape(t.id)}</small><span class="priority-badge priority-${level.toLowerCase()}" aria-label="Priority ${level}: ${priorityLevels[level]}" title="${priorityLevels[level]}">${level}</span></div><button class="open" data-open="${escape(t.id)}">${escape(t.title)}</button><div class="ticket-progress"><small>${escape(t.owner||'Unassigned')}</small>${progress.total?`<small class="checklist-count">Checklist: ${progress.completed}/${progress.total} complete</small><progress value="${progress.completed}" max="${progress.total}" aria-label="Checklist for ${escape(t.id)}">${progress.completed}/${progress.total}</progress>`:''}</div>${statusSelect(t)}</article>`;}
const completedOrder=(a,b)=>(b.completedAt||'').localeCompare(a.completedAt||'')||b.id.localeCompare(a.id);
function lanes(items,project){return `<div class="lanes">${Object.entries(stages).map(([key,name])=>{
 const id=laneKey(project||$('project').value||'all',key),rows=items.filter(t=>t.status===key).sort((a,b)=>compareLane(a,b,boardSort)),page=state.lanes?.[id],size=variant==='B'?5:10,error=laneErrors.get(id);
 const order=key==='completed'&&boardSort!=='priority'?'Newest completion first.':boardSort==='recent'?'Newest added first.':key==='completed'?'P0 first; newest within each priority.':'P0 first.';
 const busy=pageGate.has(id),footer=page?`<div class="lane-pagination" data-page-end="${escape(id)}"><p role="status">Showing ${rows.length} of ${page.total}${completedSearch?' matching':''}. ${order}${busy?' Loading more...':''}</p>${error?`<p role="alert">${escape(error)}</p>`:''}${page.nextCursor?`<button data-load-lane="${escape(id)}" aria-label="${error?'Retry loading':`Load ${size} more`} ${name.toLowerCase()} tickets${project?` for ${escape(projectName(project))}`:''}" ${busy||updates.pending?'disabled':''}>${busy?'Loading...':error?'Retry loading':`Load ${size} more`}</button>`:''}</div>`:'';
 const cards=rows.map(ticket).join('')||`<p class="empty">${completedSearch?'No matching tickets.':'No tickets here.'}</p>`;
 const contents=`<div class="lane-history" data-scroll-lane="${escape(id)}" role="region" aria-label="${name} tickets for ${escape(project?projectName(project):$('project').value==='all'?'all projects':projectName($('project').value))}" tabindex="0" aria-busy="${busy}">${cards}${footer}</div>`;
 return `<section class="lane ${variant==='A'?'kanban-lane':'swimlane'}" data-drop="${key}"${project?` data-lane-project="${escape(project)}"`:''}><h2>${name}<span>${page?.total??rows.length}</span></h2>${contents}</section>`;
 }).join('')}</div>`;}
function swimlanes(items){return activeProjects().filter(p=>$('project').value==='all'||p.id===$('project').value).map(p=>{
 const collapsed=folds.isCollapsed(p.id,Boolean(completedSearch)),contentId=`project-lanes-${p.id}`;
 return `<section class="project-row"><div class="project-heading"><h2>${escape(p.name)} <small>${kinds[p.kind]}</small></h2><button data-fold="${escape(p.id)}" aria-expanded="${!collapsed}" aria-controls="${escape(contentId)}" aria-label="${collapsed?'Expand':'Collapse'} ${escape(p.name)}" ${completedSearch?'disabled':''}>${collapsed?'Expand':'Collapse'}</button></div><div id="${escape(contentId)}" ${collapsed?'hidden':''}>${lanes(items.filter(t=>t.project===p.id),p.id)}</div></section>`;
 }).join('');}
function queue(items){return `<h2>Priority order</h2><p>P0 first, then P1, P2, and P3. Existing queue ranks break ties. Completed history stays below, newest first.</p><ol class="queue">${items.sort((a,b)=>(a.status==='completed')-(b.status==='completed')||(a.status==='completed'?completedOrder(a,b):compareActive(a,b))).map(t=>`<li>${ticket(t)}</li>`).join('')}</ol>`;}
function refreshProjects(){
 for(const id of ['project','new-project']){
  const control=$(id),value=control.value;
  control.replaceChildren(...(id==='project'?[new Option('All projects','all')]:[]),...activeProjects().map(p=>new Option(p.name,p.id)));
  if([...control.options].some(o=>o.value===value))control.value=value;
 }
 $('new-project').disabled=$('add-ticket').disabled=!activeProjects().length;
 $('project-list').innerHTML=state.projects.map(p=>`<form data-project-edit="${escape(p.id)}"><label class="grow">Name for ${escape(p.name)}<input name="name" value="${escape(p.name)}" required maxlength="80"></label><label>Type for ${escape(p.name)}<select name="kind">${Object.entries(kinds).map(([key,name])=>`<option value="${key}" ${key===p.kind?'selected':''}>${name}</option>`).join('')}</select></label><small>${p.archived?'Archived':'Active'} · ${p.ticketCount??0} tickets</small><button>Save</button><button type="button" data-project-archive="${escape(p.id)}">${p.archived?'Restore':'Archive'}</button></form>`).join('')||'<p>No projects yet. Add your first one above.</p>';
}
const boardParams=()=>new URLSearchParams({project:$('project').value||'all',q:completedSearch,searchScope:'all',view:viewKeys[variant],...(variant==='C'?{}:{paging:'lanes',sort:boardSort})});
async function load(force=false){
 if(pageGate.pending){if(force)reloadWanted=true;return;}
 if(!session?.user||updates.pending||!force&&(loading||$('detail').open||state.completed?.expanded||Object.values(state.lanes||{}).some(page=>page.expanded)))return;
 pageGate.invalidate();
 changeGate.invalidate();
 const version=epoch,token=readGate.begin();loading=true;
 try{
  const response=await fetch(`/api/board?${boardParams()}`);if(version!==epoch||!readGate.accept(token))return;
  if(response.status===401){lock('Your session expired. Sign in again to continue.');return;}
  if(response.status===404&&$('project').value!=='all'){$('project').value='all';invalidateReads();loading=false;void load(true);return;}
  if(!response.ok)throw Error('Cannot load the board right now. Use Refresh to retry.');
  const next=await response.json();if(!force&&JSON.stringify(next)===JSON.stringify(state))return;
  if(version!==epoch||!readGate.accept(token))return;
  changeGate.invalidate();state=next;$('board-updates').hidden=true;laneErrors.clear();refreshProjects();render(false);
  if($('message').textContent.startsWith('Loading'))$('message').textContent='Drag a ticket between columns, or use its Status control.';
 }catch(error){if(version===epoch&&readGate.accept(token))$('message').textContent=error.message;}
 finally{if(readGate.accept(token)){loading=false;$('load-completed').disabled=pageGate.has('all')||updates.pending;}}
}
function lock(message){
 epoch++;invalidateReads();laneErrors.clear();laneObservers.forEach(observer=>observer.disconnect());laneObservers=[];reloadWanted=false;session=null;closeDetail();state={projects:[],tickets:[],activity:[]};loading=false;completedSearch='';
 $('private-board').hidden=$('header-controls').hidden=true;$('session-panel').hidden=false;
 $('board-updates').hidden=true;
 for(const id of ['board','detail','project-list','snapshot','activity'])$(id).replaceChildren();
 for(const id of ['boundary','activity-boundary','latest-activity','message','completed-count'])$(id).textContent='';
 for(const control of document.querySelectorAll('#private-board input,#private-board textarea'))control.value='';
 $('project').replaceChildren(new Option('All projects','all'));$('new-project').replaceChildren();
 $('session-heading').textContent='Private workspace';$('session-message').textContent=message;
 $('workspace-password').value='';$('remember-me').checked=false;$('project-manager').hidden=true;$('manage-projects').setAttribute('aria-expanded','false');
 $('sign-in').hidden=!authReady;$('session-retry').hidden=false;
}
let authReady=false;
async function checkSession(){
 const version=++epoch;$('session-heading').textContent='Checking workspace access';$('session-message').textContent='Checking your session. Private board data stays hidden until access is confirmed.';
 $('session-retry').hidden=$('sign-in').hidden=true;
 try{
  const response=await fetch('/api/session');if(!response.ok)throw Error('The workspace is unavailable. Check its server configuration, then retry.');
  const next=await response.json();if(version!==epoch)return;authReady=next.authConfigured;
  if(!next.user){
   lock(authReady?'Enter your workspace password to open your private board.':'Set PLANNR_PASSWORD in the server environment, then restart the server. The board stays locked until the password is configured.');return;
  }
  session=next;$('session-panel').hidden=true;$('private-board').hidden=$('header-controls').hidden=false;
  $('sign-out').hidden=next.mode==='demo'||next.authMode==='none';
 $('boundary').textContent=next.mode==='demo'?'Disposable local demo. These example tickets reset on restart. Real repository ledgers stay untouched.':`${next.authMode==='none'?'Local access without a password':`Signed in as ${next.user.name}`}. ${next.storage==='database'?'Database':'Local file'} storage is durable.`;
  $('activity-boundary').textContent=next.mode==='demo'?'Illustrative activity only. No real agent has been assigned.':'Browser and agent changes share the same transaction history. Actor identity is verified by the server.';
  await load(true);
 }catch(error){if(version===epoch){lock(error.message);$('session-heading').textContent='Connection unavailable';}}
}
function render(preserve=true){
 $('board-sort-control').hidden=$('sort-help').hidden=variant==='C';
 $('sort-help').textContent=boardSort==='default'?'Default: priority for active work; newest completion first for Completed.':boardSort==='priority'?'Priority: P0 first in every column; newest completion breaks Completed ties.':'Recent: newest added first for active work; newest completion first for Completed.';
 $('search-help').hidden=!completedSearch;
 laneObservers.forEach(observer=>observer.disconnect());laneObservers=[];
 const positions=new Map(preserve?[...document.querySelectorAll('[data-scroll-lane]')].map(lane=>[lane.dataset.scrollLane,lane.scrollTop]):[]);
 const focused=preserve&&document.activeElement?.closest('#board')?{fold:document.activeElement.dataset.fold,lane:document.activeElement.dataset.scrollLane,load:document.activeElement.dataset.loadLane,open:document.activeElement.dataset.open,status:document.activeElement.dataset.status}:null;
 const activeIds=new Set(activeProjects().map(p=>p.id));
 const items=state.tickets.filter(t=>activeIds.has(t.project)&&($('project').value==='all'||t.project===$('project').value)).sort(compareActive);
 const matchingView=variant==='C'?Boolean(state.completed):state.laneView===viewKeys[variant]&&state.laneSort===boardSort;
 $('board').innerHTML=!matchingView&&loading?'<p role="status">Loading this view...</p>':activeIds.size?(variant==='C'&&completedSearch&&!items.length?'<p>No matching tickets. Try another search or Clear.</p>':({A:lanes,B:swimlanes,C:queue}[variant])(items)):'<p>No active projects. Open Manage projects to add one or restore an archived project.</p>';
 document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===variant)));
 const latest=state.activity[0];$('latest-activity').textContent=latest?`Latest update: ${latest.actor} ${latest.action}: ${latest.ticket}`:'No activity yet.';
 $('activity').innerHTML=state.activity.map(a=>`<li>${escape(a.actor)} ${escape(a.action)}: ${escape(a.ticket)}</li>`).join('')||'<li>No changes yet.</li>';
 $('snapshot').textContent=JSON.stringify(state,null,2);
 const shown=items.filter(t=>t.status==='completed').length,total=state.completed?.total??shown;
 $('completed-count').textContent=variant!=='C'?'':!matchingView?'Loading completed history...':`Completed: showing ${shown} of ${total}${completedSearch?' matching':''} tickets. Newest first.`;
 $('load-completed').hidden=variant!=='C'||!matchingView||!state.completed?.nextCursor;$('load-completed').disabled=loading||pageGate.has('all')||updates.pending;
 for(const lane of document.querySelectorAll('[data-scroll-lane]')){
  if(positions.has(lane.dataset.scrollLane))lane.scrollTop=positions.get(lane.dataset.scrollLane);
  const end=lane.querySelector('[data-page-end]');
  if(end&&!lane.closest('[hidden]')&&state.lanes?.[lane.dataset.scrollLane]?.nextCursor&&typeof IntersectionObserver!=='undefined'){
   const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))void loadLane(lane.dataset.scrollLane);},{root:lane,rootMargin:'0px 0px 96px 0px'});observer.observe(end);laneObservers.push(observer);
  }
 }
 if(focused){const controls=[...$('board').querySelectorAll('[data-fold],[data-scroll-lane],[data-load-lane],[data-open],[data-status]')];
  const target=controls.find(control=>focused.fold&&control.dataset.fold===focused.fold||focused.load&&control.dataset.loadLane===focused.load||focused.open&&control.dataset.open===focused.open||focused.status&&control.dataset.status===focused.status||focused.lane&&control.dataset.scrollLane===focused.lane);
  (target||controls.find(control=>control.dataset.scrollLane===focused.load))?.focus({preventScroll:true});
 }
}
function renderNotes(t){if($('ticket-notes'))$('ticket-notes').innerHTML=t.comments.map(c=>`<li><strong>${escape(c.actor)}</strong><p>${escape(c.text)}</p></li>`).join('')||'<li>No notes yet.</li>';}
function fillEditor(t){
 draftChecklist=structuredClone(checklistItems(t));
 draftBase=structuredClone(t);$('edit-title').value=t.title;$('edit-description').value=t.description;
 $('edit-status').value=t.status;$('edit-priority').value=priorityLevel(t);$('editor-message').textContent='';$('reload-ticket').hidden=true;renderNotes(t);renderChecklist();
}
function openDetail(id){
 const t=state.tickets.find(t=>t.id===id);if(!t)return;selected=id;
 $('detail').innerHTML=`<header class="editor-header"><div><h2 id="editor-heading">Edit ticket</h2><p>${escape(projectName(t.project))} · ${escape(t.id)}</p></div><button type="button" id="close-detail">Close</button></header>
 <div class="editor-body"><form id="edit-ticket"><label>Title<input id="edit-title" required maxlength="120"></label><label>Description<textarea id="edit-description" maxlength="4000"></textarea></label>
 <div class="editor-fields"><label>Status<select id="edit-status">${Object.entries(stages).map(([key,name])=>`<option value="${key}">${name}</option>`).join('')}</select></label><label>Priority<select id="edit-priority">${Object.entries(priorityLevels).map(([key,name])=>`<option value="${key}">${key}: ${name}</option>`).join('')}</select></label></div>
 <section class="editor-checklist" aria-labelledby="checklist-heading"><div class="checklist-heading"><h3 id="checklist-heading">Checklist</h3><span id="checklist-progress" role="status"></span></div><p id="checklist-help">Checklist changes are saved with Save changes. Ticket status stays separate.</p><ol id="ticket-checklist"></ol><div class="checklist-add"><label class="grow">New checklist item<input id="new-checklist-item" maxlength="${checklistTextLimit}" placeholder="What needs to be done?"></label><button type="button" id="add-checklist-item">Add item</button></div><p id="checklist-message" role="status" aria-live="polite"></p></section>
 <p id="editor-message" role="status" aria-live="polite"></p><button type="button" id="reload-ticket" hidden>Use latest ticket and discard my draft</button>
 <div class="editor-actions"><button type="button" id="cancel-edit">Cancel</button><button class="primary" id="save-ticket">Save changes</button></div></form>
 <section class="editor-notes" aria-labelledby="notes-heading"><h3 id="notes-heading">Notes</h3><ol id="ticket-notes"></ol><form id="note"><label>Add a note<textarea id="note-text" required maxlength="2000"></textarea></label><button>Add note</button></form><p id="note-message" role="status"></p></section></div>`;
 fillEditor(t);$('detail').showModal();$('edit-title').focus();
}
function closeDetail(){const id=selected;$('detail').close();selected=null;draftBase=null;draftChecklist=[];$('detail').replaceChildren();document.querySelector(`[data-open="${id}"]`)?.focus();}
function updateChecklistProgress(){
 const {completed,total}=checklistProgress({checklist:draftChecklist});
 $('checklist-progress').textContent=`${completed}/${total} complete`;
 $('add-checklist-item').disabled=$('new-checklist-item').disabled=total>=checklistLimit;
 $('checklist-message').textContent=total>=checklistLimit?'This ticket has 100 checklist items. Remove an item to add another.':'';
}
function renderChecklist(){
 $('ticket-checklist').innerHTML=draftChecklist.map((item,index)=>`<li data-checklist-id="${escape(item.id)}"><label class="checklist-toggle"><input type="checkbox" data-checklist-completed ${item.completed?'checked':''} aria-label="Completed: ${escape(item.text)}"></label><label class="checklist-text"><span class="visually-hidden">Checklist item ${index+1}</span><input data-checklist-text value="${escape(item.text)}" required maxlength="${checklistTextLimit}"></label><button type="button" data-remove-checklist aria-label="Remove checklist item ${index+1}">Remove</button></li>`).join('')||'<li class="checklist-empty">No checklist items yet. Add the steps for this ticket below.</li>';
 updateChecklistProgress();
}
function addChecklistItem(){
 const input=$('new-checklist-item'),text=input.value.trim();
 if(!text){$('checklist-message').textContent='Enter a checklist item first.';input.focus();return false;}
 if(draftChecklist.length>=checklistLimit)return false;
 draftChecklist.push({id:crypto.randomUUID(),text,completed:false});input.value='';renderChecklist();input.focus();return true;
}
async function request(path,method='GET',body){
 const response=await fetch(path,{method,headers:method==='GET'?{}:{'Content-Type':'application/json','X-CSRF-Token':session?.csrf||'','Idempotency-Key':crypto.randomUUID()},body:body===undefined?undefined:JSON.stringify(body)});
 const result=await response.json();if(response.status===401)lock('Your session expired. Sign in again to continue.');if(!response.ok)throw Object.assign(Error(result.error),{status:response.status});return result;
}
async function update(id,patch,expected){
 const version=epoch;
 try{const result=await updates.update(id,patch,expected);if(version!==epoch)return null;$('message').textContent=`Updated ${id}.`;if(patch.status!==undefined)void load(true);return result;}
 catch(error){if(version===epoch){$('message').textContent=error.message;if(selected===id&&$('editor-message')){$('editor-message').textContent=error.message;$('reload-ticket').hidden=false;}}return null;}
 finally{if(version===epoch&&session?.user)render();}
}
function switchView(key){
 variant=key;try{localStorage.setItem('project-plannr:view',variant);}catch{}
 const url=new URL(location.href);url.searchParams.delete('variant');url.searchParams.set('view',viewKeys[variant]);history.replaceState(null,'',url);
 closeDetail();invalidateReads();loading=false;void load(true);render();
}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>switchView(button.dataset.view));
$('project').onchange=()=>{closeDetail();invalidateReads();loading=false;void load(true);};
$('manage-projects').onclick=()=>{const panel=$('project-manager');panel.hidden=!panel.hidden;$('manage-projects').setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)$('project-name').focus();};
$('add-project').onsubmit=async e=>{
 e.preventDefault();const button=e.submitter;button.disabled=true;
 try{const p=await request('/api/projects','POST',{name:$('project-name').value,kind:$('project-kind').value});$('project-name').value='';$('message').textContent=`Added ${p.name}.`;await load(true);}
 catch(error){$('message').textContent=error.message;}finally{button.disabled=false;}
};
$('project-list').addEventListener('submit',async e=>{
 e.preventDefault();const form=e.target,p=state.projects.find(p=>p.id===form.dataset.projectEdit),button=e.submitter;button.disabled=true;
 try{const data=new FormData(form);await request(`/api/projects/${encodeURIComponent(p.id)}`,'PATCH',{revision:p.revision,name:data.get('name'),kind:data.get('kind')});$('message').textContent='Project saved. Its tickets and history are preserved.';await load(true);}
 catch(error){$('message').textContent=error.message;}finally{button.disabled=false;}
});
$('project-list').addEventListener('click',async e=>{
 const button=e.target.closest('[data-project-archive]');if(!button)return;
 const p=state.projects.find(p=>p.id===button.dataset.projectArchive);button.disabled=true;
 try{await request(`/api/projects/${encodeURIComponent(p.id)}`,'PATCH',{revision:p.revision,archived:!p.archived});$('message').textContent=p.archived?`Restored ${p.name}.`:`Archived ${p.name}. Its tickets are preserved; use Restore to bring it back.`;await load(true);}
 catch(error){$('message').textContent=error.message;}finally{button.disabled=false;}
});
$('board').addEventListener('click',e=>{const fold=e.target.closest('[data-fold]');if(fold){folds.toggle(fold.dataset.fold);render();return;}const button=e.target.closest('[data-load-lane]');if(button){void loadLane(button.dataset.loadLane,true);return;}const row=e.target.closest('[data-ticket]');if(row&&!e.target.closest('label,select'))openDetail(row.dataset.ticket);});
$('board').addEventListener('scroll',e=>{const lane=e.target;if(lane.dataset?.scrollLane&&nearLaneEnd(lane))void loadLane(lane.dataset.scrollLane);},{capture:true,passive:true});
$('board').addEventListener('change',e=>{if(e.target.dataset.status)void update(e.target.dataset.status,{status:e.target.value});});
$('board').addEventListener('dragstart',e=>{dragged=e.target.closest('[data-ticket]')?.dataset.ticket;if(dragged)e.dataTransfer.setData('text/plain',dragged);});
$('board').addEventListener('dragover',e=>{const lane=e.target.closest('[data-drop]');if(lane){e.preventDefault();lane.classList.add('over');}});
$('board').addEventListener('dragleave',e=>e.target.closest('[data-drop]')?.classList.remove('over'));
$('board').addEventListener('drop',e=>{const lane=e.target.closest('[data-drop]');if(lane&&dragged){e.preventDefault();lane.classList.remove('over');void update(dragged,{status:lane.dataset.drop});dragged=null;}});
$('detail').addEventListener('click',async e=>{
 if(['close-detail','cancel-edit'].includes(e.target.id)){closeDetail();return;}
 if(e.target.id==='add-checklist-item')addChecklistItem();
 const remove=e.target.closest('[data-remove-checklist]');
 if(remove){const row=remove.closest('[data-checklist-id]'),index=draftChecklist.findIndex(item=>item.id===row.dataset.checklistId);draftChecklist.splice(index,1);renderChecklist();const next=$('ticket-checklist').querySelectorAll('[data-checklist-text]');(next[Math.min(index,next.length-1)]||$('new-checklist-item')).focus();}
 if(e.target.id==='reload-ticket'){try{const fresh=await request(`/api/tickets/${encodeURIComponent(selected)}`);if($('detail').open)fillEditor(fresh);}catch(error){if($('editor-message'))$('editor-message').textContent=error.message;}}
});
$('detail').addEventListener('input',e=>{
 const row=e.target.closest('[data-checklist-id]');if(!row)return;
 const item=draftChecklist.find(item=>item.id===row.dataset.checklistId);
 if(e.target.hasAttribute('data-checklist-text')){item.text=e.target.value;row.querySelector('[data-checklist-completed]').setAttribute('aria-label',`Completed: ${item.text}`);}
 if(e.target.hasAttribute('data-checklist-completed')){item.completed=e.target.checked;updateChecklistProgress();}
});
$('detail').addEventListener('keydown',e=>{if(e.target.id==='new-checklist-item'&&e.key==='Enter'){e.preventDefault();addChecklistItem();}});
$('detail').addEventListener('cancel',e=>{e.preventDefault();if(!$('save-ticket')?.disabled)closeDetail();});
$('detail').addEventListener('submit',async e=>{
 e.preventDefault();const id=selected,form=e.target;
 let patch;
 if(form.id==='note')patch={comment:$('note-text').value};
 else {
  if($('new-checklist-item').value.trim()&&!addChecklistItem())return;
  const values={title:$('edit-title').value.trim(),description:$('edit-description').value,status:$('edit-status').value,priorityLevel:$('edit-priority').value};
  patch=Object.fromEntries(Object.entries(values).filter(([key,value])=>(key==='priorityLevel'?priorityLevel(draftBase):draftBase[key])!==value));
  const changes=checklistDiff(draftBase,draftChecklist);if(changes.length)patch.checklistChanges=changes;
  if(!Object.keys(patch).length){closeDetail();return;}
 }
 const controls=[...$('detail').querySelectorAll('input,textarea,select,button')];
 controls.forEach(control=>control.disabled=true);
 const result=await update(id,patch,form.id==='note'?undefined:draftBase);
 controls.forEach(control=>control.disabled=false);
 if($('detail').open)updateChecklistProgress();
 if(!result||!$('detail').open)return;
 if(form.id==='note'){$('note-text').value='';$('note-message').textContent='Note added.';}
 else{closeDetail();await load(true);}
});
$('completed-filter').onsubmit=e=>{e.preventDefault();completedSearch=$('completed-search').value.trim();invalidateReads();loading=false;void load(true);};
$('clear-search').onclick=()=>{$('completed-search').value='';completedSearch='';invalidateReads();loading=false;void load(true);};
$('board-sort').onchange=()=>{boardSort=$('board-sort').value;try{localStorage.setItem('project-plannr:sort',boardSort);}catch{}invalidateReads();loading=false;void load(true);render(false);};
async function loadMore(project){
 const metadata=project?state.completedByProject?.[project]:state.completed;
 if(loading||updates.pending||!metadata?.nextCursor)return;
 const version=epoch,token=pageGate.begin(project||'all'),query=boardParams();if(!token)return;
 if(project)query.set('project',project);query.set('cursor',metadata.nextCursor);render();
 if(!project)$('load-completed').textContent='Loading completed tickets...';
 try{const page=await request(`/api/completed?${query}`);if(version!==epoch||!pageGate.accept(token))return;
  appendCompletedPage(state,page,project);render();
 }catch(error){if(version===epoch&&pageGate.accept(token))$('message').textContent=error.message;}
 finally{const current=pageGate.accept(token);pageGate.finish(token);if(version===epoch){render();$('load-completed').textContent='Load 20 more completed tickets';
  if(current&&project&&document.activeElement===document.body){const lane=[...document.querySelectorAll('[data-lane-project][data-drop="completed"]')].find(row=>row.dataset.laneProject===project);(lane?.querySelector('[data-load-project]')||lane?.querySelector('.lane-history'))?.focus({preventScroll:true});}
 }if(reloadWanted&&!pageGate.pending){reloadWanted=false;void load(true);}}
}
async function loadLane(key,retry=false){
 const metadata=state.lanes?.[key];
 if(loading||updates.pending||variant==='B'&&folds.isCollapsed(metadata?.project,Boolean(completedSearch))||!metadata?.nextCursor||!retry&&laneErrors.has(key))return;
 const version=epoch,restoreFocus=document.activeElement?.dataset.loadLane===key,token=pageGate.begin(key);if(!token)return;
 laneErrors.delete(key);
 const query=boardParams();query.set('project',metadata.project);query.set('status',metadata.status);query.set('cursor',metadata.nextCursor);render();
 try{const page=await request(`/api/lane?${query}`);if(version!==epoch||!pageGate.accept(token))return;appendLanePage(state,page,key);}
 catch(error){if(version===epoch&&pageGate.accept(token))laneErrors.set(key,error.message||'Cannot load this column. Retry when your connection is restored.');}
 finally{const current=pageGate.accept(token);pageGate.finish(token);if(version===epoch&&current){render();
  if(restoreFocus&&document.activeElement===document.body){const lane=[...document.querySelectorAll('[data-scroll-lane]')].find(node=>node.dataset.scrollLane===key);(lane?.querySelector('[data-load-lane]')||lane)?.focus({preventScroll:true});}
 }if(reloadWanted&&!pageGate.pending){reloadWanted=false;void load(true);}}
}
$('load-completed').onclick=()=>void loadMore();
$('create').onsubmit=async e=>{
 e.preventDefault();const button=e.submitter;button.disabled=true;
 try{const result=await request('/api/tickets','POST',{project:$('new-project').value,title:$('title').value,priorityLevel:$('new-priority').value});$('title').value='';$('message').textContent=`Created ${result.id}.`;await load(true);}
 catch(error){$('message').textContent=error.message;}finally{button.disabled=!activeProjects().length;}
};
$('session-retry').onclick=()=>void checkSession();$('refresh-board').onclick=()=>void load(true);
$('apply-updates').onclick=()=>void load(true);
async function checkChanges(){
 if(!session?.user||document.hidden||navigator.onLine===false||loading||updates.pending||!state.changeToken||!$('board-updates').hidden)return;
 const version=epoch,token=changeGate.begin(),baseline=state.changeToken;
 if(!token)return;
 const timeout=setTimeout(()=>token.abort(),30000);
 try{
  const response=await fetch(`/api/changes?project=${encodeURIComponent($('project').value||'all')}`,{signal:token.signal});
  if(version!==epoch||!changeGate.accept(token))return;
  if(response.status===401){lock('Your session expired. Sign in again to continue.');return;}
  if(response.status===404){$('board-updates').hidden=false;return;}
  if(!response.ok)return;
  const result=await response.json();
  if(version===epoch&&changeGate.accept(token)&&state.changeToken===baseline)$('board-updates').hidden=result.changeToken===baseline;
 }catch{/* A failed background read retries on the next normal interval. */}
 finally{clearTimeout(timeout);changeGate.finish(token);}
}
$('sign-in').onsubmit=async e=>{
 e.preventDefault();const button=$('unlock-workspace'),input=$('workspace-password'),choice=$('remember-me'),password=input.value,remember=choice.checked;button.disabled=choice.disabled=true;input.value='';
 $('session-message').textContent='Opening your workspace...';
 try{const response=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,remember})});const result=await response.json();if(!response.ok)throw Error(result.error);await checkSession();if(session?.user)$('manage-projects').focus();}
 catch(error){$('session-message').textContent=error.message;input.focus();}finally{button.disabled=choice.disabled=false;}
};
$('sign-out').onclick=async()=>{const button=$('sign-out');button.disabled=true;try{await request('/auth/logout','POST',{});lock('You signed out. Sign in again to reopen your private board.');}catch(error){$('message').textContent=error.message;}finally{button.disabled=false;}};
for(const event of ['pointerdown','keydown','wheel'])document.addEventListener(event,()=>{lastActivity=Date.now();},{passive:true});
await checkSession();setInterval(()=>{if(session?.user&&!document.hidden&&Date.now()-lastActivity<180000)void checkChanges();},30000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)changeGate.invalidate();else{lastActivity=Date.now();void checkChanges();}});
window.addEventListener('offline',()=>changeGate.invalidate());
window.addEventListener('online',()=>{if(!document.hidden){lastActivity=Date.now();void checkChanges();}});
window.addEventListener('pagehide',()=>changeGate.invalidate());
