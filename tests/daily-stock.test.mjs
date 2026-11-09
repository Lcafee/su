import test from 'node:test';
import assert from 'node:assert/strict';
import { readDailyStock, tehranDay, marbleProduct } from '../src/menu/dailyStock.mjs';
test('Tehran date changes at the Tehran midnight boundary', () => {
  assert.equal(tehranDay(new Date('2026-11-08T20:29:59Z')), '2026-11-08');
  assert.equal(tehranDay(new Date('2026-11-08T20:30:00Z')), '2026-11-09');
});
test('only confirmed integer stock for today is shown, including zero', () => {
  const now = new Date('2026-11-08T10:00:00Z');
  for (const remaining of [0, 1, 10]) assert.equal(readDailyStock({dailyRemaining:remaining,dailyDate:'2026-11-08'},now),remaining);
  for (const remaining of [-1,11,1.2,'5',null]) assert.equal(readDailyStock({dailyRemaining:remaining,dailyDate:'2026-11-08'},now),null);
  assert.equal(readDailyStock({dailyRemaining:10,dailyDate:'2026-11-07'},now),null);
  assert.equal(readDailyStock({},now),null);
});
test('replacement does not reuse pumpkin name, copy, price or price options', () => {
  const result=marbleProduct({id:'item-cd02bda6aac3',name:'کیک پامکین',price:'۵۵۰',description:'پاییز',options:[{price:'۵۵۰'}]});
  assert.equal(result.name,'ماربل براونی');
  assert.equal(result.price,null);
  assert.deepEqual(result.options,[]);
});
