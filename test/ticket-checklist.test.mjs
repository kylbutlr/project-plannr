import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyChecklistChanges, checklistDiff, checklistItems, checklistProgress} from '../ticket-checklist.js';
import {agentCommand} from '../lib/agent-command.mjs';
const apply=(ticket,changes)=>applyChecklistChanges(ticket,changes,()=> 'generated-id');
test('legacy tickets start empty without inferring completion from descriptions or comments',()=>{
 const legacy={description:'- [x] Old acceptance',comments:[{text:'All done'}]};
 assert.deepEqual(checklistItems(legacy),[]);assert.deepEqual(checklistProgress(legacy),{completed:0,total:0});
 const items=apply(legacy,[{action:'add',text:'  Review venue  '}]);
 assert.deepEqual(items,[{id:'generated-id',text:'Review venue',completed:false}]);assert.equal(legacy.checklist,undefined);
});
test('item identity survives edits; checking, unchecking and removal preserve other items',()=>{
 const base={checklist:[{id:'a',text:'Research',completed:false},{id:'b',text:'Review',completed:false}]};
 const checked=apply(base,[{action:'update',id:'a',completed:true},{action:'update',id:'b',text:'Owner review'}]);
 assert.deepEqual(checklistProgress({checklist:checked}),{completed:1,total:2});assert.equal(base.checklist[0].completed,false);
 assert.deepEqual(apply({checklist:checked},[{action:'update',id:'a',completed:false},{action:'remove',id:'b'}]),[{id:'a',text:'Research',completed:false}]);
 assert.deepEqual(checklistDiff(base,checked),[{action:'update',id:'a',text:'Research',completed:true},{action:'update',id:'b',text:'Owner review',completed:false}]);
 assert.deepEqual(checklistDiff(base,base.checklist),[]);
});
test('invalid and oversized batches cannot partially edit the checklist',()=>{
 const base={checklist:[{id:'a',text:'Keep',completed:false}]},before=structuredClone(base);
 for(const changes of [null,[],Array(201).fill({action:'remove',id:'a'}),[{action:'unknown'}],[{action:'add',id:'a',text:'Duplicate'}],
  [{action:'add',text:''}],[{action:'add',text:'x'.repeat(301)}],[{action:'add',text:'Valid',completed:'yes'}],[{action:'update',id:'a'}],
  [{action:'remove',id:'absent'}],[{action:'remove',id:'a',completed:true}],[{action:'update',id:'a',completed:true},{action:'add',id:'bad id',text:'No'}]]){
  assert.throws(()=>apply(base,changes));assert.deepEqual(base,before);
 }
 const full={checklist:Array.from({length:100},(_,i)=>({id:`item-${i}`,text:'Step',completed:false}))};
 assert.throws(()=>apply(full,[{action:'add',text:'Too many'}]),/100/);
 assert.equal(apply(full,[{action:'remove',id:'item-0'},{action:'add',text:'Replacement'}]).length,100);
});
test('agent checklist commands address exact items and always require the latest revision',()=>{
 const body=args=>agentCommand(args).body;
 assert.deepEqual(body(['checklist-add','PLNR-47','42','Owner review']),{revision:42,checklistChanges:[{action:'add',text:'Owner review'}]});
 assert.deepEqual(body(['checklist-check','PLNR-47','43','item']),{revision:43,checklistChanges:[{action:'update',id:'item',completed:true}]});
 assert.equal(body(['checklist-uncheck','PLNR-47','44','item']).checklistChanges[0].completed,false);
 assert.equal(body(['checklist-edit','PLNR-47','45','item','New text']).checklistChanges[0].text,'New text');
 assert.equal(body(['checklist-remove','PLNR-47','46','item']).checklistChanges[0].action,'remove');
 for(const args of [['checklist-add','PLNR-47','0','No'],['checklist-edit','PLNR-47','1','item'],['checklist-check','PLNR-47','1',''],['checklist-remove','PLNR-47','1','item','extra']])assert.throws(()=>agentCommand(args));
});
