import {categories, defaultColumns, workflowOf} from './workflow.js';

// Draft changes stay local until one revision-checked save commits the workflow.
export function workflowEditor({request, saved}) {
  const $=id=>document.getElementById(id);
  let draft, counts={}, removed=[];
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render() {
    $('workflow-columns').innerHTML=draft.columns.map((column,index)=>`<div class="workflow-column" data-column="${escape(column.id)}"><label>Column name<input data-column-name value="${escape(column.name)}" maxlength="60" required></label><label>Category<select data-column-category ${defaultColumns.some(row=>row.id===column.id)?'disabled':''}>${Object.entries(categories).map(([key,name])=>`<option value="${key}" ${key===column.category?'selected':''}>${name}</option>`).join('')}</select></label><label class="inline-choice"><input type="checkbox" data-column-enabled ${column.enabled?'checked':''}>Enabled</label><div class="column-actions"><button type="button" data-shift="-1" aria-label="Move ${escape(column.name)} up" ${index?'':'disabled'}>Up</button><button type="button" data-shift="1" aria-label="Move ${escape(column.name)} down" ${index<draft.columns.length-1?'':'disabled'}>Down</button><button type="button" data-remove-column aria-label="Remove ${escape(column.name)}">Remove</button></div><small>${counts[column.id]||0} tickets across all projects</small></div>`).join('');
    $('column-removals').innerHTML=removed.map(column=>`<label>Move tickets from ${escape(column.name)} to<select data-move-from="${escape(column.id)}" required><option value="">Choose a destination</option>${draft.columns.filter(row=>row.enabled).map(row=>`<option value="${escape(row.id)}">${escape(row.name)}</option>`).join('')}</select></label>`).join('');
  }
  async function open() {
    $('workflow-manager').hidden=false;$('manage-columns').setAttribute('aria-expanded','true');
    $('workflow-message').textContent='Loading columns...';
    try {const result=await request('/api/workflow');draft=structuredClone(workflowOf({workflow:result}));counts=result.counts||{};removed=[];render();$('workflow-message').textContent='New columns start in Waiting. Simple workflow turns off extra columns without deleting their tickets.';$('reload-workflow').hidden=true;$('workflow-columns').querySelector('input')?.focus();}
    catch(error){$('workflow-message').textContent=error.message;}
  }
  function close() {$('workflow-manager').hidden=true;$('manage-columns').setAttribute('aria-expanded','false');$('manage-columns').focus();}
  $('manage-columns').onclick=()=>{$('workflow-manager').hidden?void open():close();};
  $('close-columns').onclick=close;$('reload-workflow').onclick=()=>void open();
  $('workflow-columns').oninput=event=>{
    const row=event.target.closest('[data-column]'),column=draft?.columns.find(column=>column.id===row?.dataset.column);
    if(!column)return;
    if(event.target.matches('[data-column-name]'))column.name=event.target.value;
    if(event.target.matches('[data-column-category]'))column.category=event.target.value;
    if(event.target.matches('[data-column-enabled]'))column.enabled=event.target.checked;
  };
  $('workflow-columns').onclick=event=>{
    const row=event.target.closest('[data-column]');if(!row)return;
    const index=draft.columns.findIndex(column=>column.id===row.dataset.column);
    if(event.target.closest('[data-remove-column]')){const [column]=draft.columns.splice(index,1);if(counts[column.id])removed.push(column);render();}
    const shift=event.target.closest('[data-shift]');
    if(shift){const to=index+Number(shift.dataset.shift);if(to>=0&&to<draft.columns.length){[draft.columns[index],draft.columns[to]]=[draft.columns[to],draft.columns[index]];render();$('workflow-columns').querySelector(`[data-column="${row.dataset.column}"] [data-shift="${shift.dataset.shift}"]`)?.focus();}}
  };
  $('add-column').onclick=()=>{if(!draft)return;draft.columns.push({id:'column-'+crypto.randomUUID(),name:'New column',category:'waiting',enabled:true});render();const inputs=$('workflow-columns').querySelectorAll('[data-column-name]');inputs[inputs.length-1].focus();inputs[inputs.length-1].select();};
  $('simple-workflow').onclick=()=>{if(!draft)return;draft.columns=[...defaultColumns.map(column=>({...column})),...draft.columns.filter(column=>!defaultColumns.some(row=>row.id===column.id)).map(column=>({...column,enabled:false}))];removed=removed.filter(column=>!defaultColumns.some(row=>row.id===column.id));render();};
  $('workflow-form').onsubmit=async event=>{
    event.preventDefault();if(!draft)return;const button=event.submitter;button.disabled=true;
    const moves=Object.fromEntries([...$('column-removals').querySelectorAll('[data-move-from]')].map(select=>[select.dataset.moveFrom,select.value]));
    try {const result=await request('/api/workflow','PATCH',{revision:draft.revision,columns:draft.columns,moves});draft={revision:result.revision,columns:result.columns};counts=result.counts;removed=[];render();await saved();$('workflow-message').textContent='Columns saved. Disabled columns and their tickets remain available on the board.';$('reload-workflow').hidden=true;}
    catch(error){$('workflow-message').textContent=error.message;$('reload-workflow').hidden=error.status!==409;}
    finally{button.disabled=false;}
  };
}
