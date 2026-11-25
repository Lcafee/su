import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogWithoutSeasonal } from '../src/menu/seasonalFeature.mjs';
test('Velour is excluded from catalog while Marble keeps its regular dessert card',()=>{
 const marble={id:'item-cd02bda6aac3',name:'ماربل براونی'};
 const velour={id:'item-velour',name:'ولور'};
 const input=[{id:'dessert',items:[marble,velour]},{id:'coffee',items:[{id:'latte'}]}];
 const result=catalogWithoutSeasonal(input);
 assert.deepEqual(result[0].items,[marble]);
 assert.equal(input[0].items.length,2);
 assert.equal(result[1],input[1]);
});
test('empty category from promotion is omitted; unrelated products are preserved',()=>{
 const input=[{id:'dessert',items:[{id:'item-velour',name:'ولور'}]},{id:'coffee',items:[{id:'latte'}]}];
 assert.deepEqual(catalogWithoutSeasonal(input).map(c=>c.id),['coffee']);
 assert.equal(catalogWithoutSeasonal([input[1]])[0],input[1]);
});
