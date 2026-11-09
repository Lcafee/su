import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDailyStock, stockComparableMetadata } from '../server-node/src/daily-stock.mjs';
test('API rejects invalid stock regardless of UI controls', () => {
  for (const dailyRemaining of [-1,11,2.2,'7',true]) assert.throws(()=>validateDailyStock({dailyRemaining}));
  for (const dailyRemaining of [null,0,7,10]) assert.doesNotThrow(()=>validateDailyStock({dailyRemaining}));
  assert.throws(()=>validateDailyStock({dailyDate:'yesterday'}));
  assert.throws(()=>validateDailyStock({dailyDate:'2026-02-31'}));
  assert.throws(()=>validateDailyStock({marbleBrownie:'true'}));
});
test('cashier inventory exception never permits changes to unrelated metadata or other items', () => {
  const metadata={code:'22001',caption:'photo',dailyRemaining:2,dailyDate:'2026-11-08',marbleBrownie:true};
  assert.deepEqual(stockComparableMetadata(metadata,true),{code:'22001',caption:'photo'});
  assert.deepEqual(stockComparableMetadata(metadata,false),metadata);
});
