import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogWithoutSeasonal } from '../src/menu/seasonalFeature.mjs';
test('promoted item is excluded from catalog without mutating admin/public source data',()=>{
 const marble={id:'item-cd02bda6aac3',name:'ماربل براونی'};const other={id:'other'};
 const input=[{id:'dessert',items:[marble,other]},{id:'coffee',items:[{id:'latte'}]}];
 const result=catalogWithoutSeasonal(input);
 assert.deepEqual(result[0].items,[other]);assert.equal(input[0].items.length,2);assert.equal(result[1],input[1]);
});
test('empty category from promotion is omitted; unrelated products are preserved',()=>{
 const input=[{id:'dessert',items:[{id:'item-cd02bda6aac3'}]},{id:'coffee',items:[{id:'latte'}]}];
 assert.deepEqual(catalogWithoutSeasonal(input).map(c=>c.id),['coffee']);
 assert.equal(catalogWithoutSeasonal([input[1]])[0],input[1]);
});
