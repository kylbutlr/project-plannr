// Pure command parsing. The CLI never chooses or starts work automatically.
import {compareActive} from '../ticket-priority.js';
export function agentCommand(args) {
  const [action='list',id,revision,value]=args;
  if(action==='list'&&args.length<=1)return {path:'/api/state',method:'GET'};
  if(action==='backlog'&&id&&args.length===2)return {path:`/api/board?${new URLSearchParams({project:id,view:'kanban'})}`,method:'GET',backlog:true};
  if(action==='show'&&id&&args.length===2)return {path:`/api/tickets/${encodeURIComponent(id)}`,method:'GET'};
  if(['checklist-add','checklist-edit','checklist-check','checklist-uncheck','checklist-remove'].includes(action)&&id&&/^[1-9]\d*$/.test(revision||'')&&Number.isSafeInteger(Number(revision))&&value?.trim()) {
    let change;
    if(action==='checklist-add'&&args.length===4)change={action:'add',text:value};
    if(action==='checklist-edit'&&args.length===5&&args[4]?.trim())change={action:'update',id:value,text:args[4]};
    if(['checklist-check','checklist-uncheck'].includes(action)&&args.length===4)change={action:'update',id:value,completed:action==='checklist-check'};
    if(action==='checklist-remove'&&args.length===4)change={action:'remove',id:value};
    if(change)return {path:`/api/tickets/${encodeURIComponent(id)}`,method:'PATCH',body:{revision:Number(revision),checklistChanges:[change]}};
  }
  if(['claim','renew','release','move','note'].includes(action)&&id&&/^[1-9]\d*$/.test(revision||'')&&Number.isSafeInteger(Number(revision))) {
    const claim=['claim','renew','release'].includes(action);
    if(claim&&args.length===3)return {path:`/api/tickets/${encodeURIComponent(id)}/${action}`,method:'POST',body:{revision:Number(revision)}};
    if(!claim&&args.length===4&&value?.trim()&&(action!=='move'||['next','in-progress','completed'].includes(value)))return {
      path:`/api/tickets/${encodeURIComponent(id)}`,method:'PATCH',body:{revision:Number(revision),[action==='move'?'status':'comment']:value}};
  }
  throw Error('Use list, backlog PROJECT_ID, show TICKET_ID, claim/renew/release TICKET_ID REVISION, or move/note TICKET_ID REVISION VALUE. For checklists use checklist-add TICKET_ID REVISION TEXT, checklist-edit TICKET_ID REVISION ITEM_ID TEXT, or checklist-check/checklist-uncheck/checklist-remove TICKET_ID REVISION ITEM_ID. Read the latest revision before changing a ticket.');
}
export function agentResult(command,result) {
  return command.backlog ? {projects:result.projects,tickets:result.tickets.filter(row=>row.status==='next').sort(compareActive)} : result;
}
