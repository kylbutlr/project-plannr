import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePreferences,readPreferences,savePreferences,preferenceKey} from '../workspace-preferences.js';
test('personal settings survive storage roundtrip and reject malformed values',()=>{
 const rows=new Map(),storage={getItem:key=>rows.get(key),setItem:(key,value)=>rows.set(key,value)};
 const value={workspaceName:'  Fieldnotes  ',displayName:'Alex',theme:'light',density:'compact',defaultView:'kanban'};
 assert.equal(savePreferences(storage,value),true);assert.deepEqual(readPreferences(storage),{...value,workspaceName:'Fieldnotes'});
 rows.set(preferenceKey,'broken JSON');assert.equal(readPreferences(storage).theme,'dark');
 assert.deepEqual(normalizePreferences({theme:'red',density:'tiny',defaultView:'admin',workspaceName:'\n'}),normalizePreferences({}));
 assert.equal(normalizePreferences({workspaceName:'a'.repeat(100)}).workspaceName.length,64);
});
test('unavailable browser storage keeps defaults usable without throwing',()=>{
 const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
 assert.equal(readPreferences(denied).defaultView,'swimlanes');assert.equal(savePreferences(denied,{}),false);
});
