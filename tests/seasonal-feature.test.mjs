import test from 'node:test';
import assert from 'node:assert/strict';
import { findSeasonalProduct, seasonalFrame, keepSeasonalIntro } from '../src/menu/seasonalFeature.mjs';

const pumpkin={id:'item-cd02bda6aac3',name:'کیک پامکین',price:'۵۵۰',metadata:{code:'22001'}};
test('uses the published product object so price edits stay authoritative',()=>{
 const updated={...pumpkin,price:'۶۰۰'};
 assert.equal(findSeasonalProduct([{items:[{name:'کیک دیگر'},updated]}]),updated);
});
test('does not promote an absent or archived product or category',()=>{
 assert.equal(findSeasonalProduct([{items:[]}]),null);
 assert.equal(findSeasonalProduct([{items:[{...pumpkin,archived:true}]}]),null);
 assert.equal(findSeasonalProduct([{archived:true,items:[pumpkin]}]),null);
 assert.equal(findSeasonalProduct([{items:[{...pumpkin,visible:false}]}]),null);
});
test('only fresh mobile entry keeps the introductory scene; category links keep their destination',()=>{
 assert.equal(keepSeasonalIntro('',true),true);
 assert.equal(keepSeasonalIntro('#cat-dessert',true),false);
 assert.equal(keepSeasonalIntro('',false),false);
});
test('shared image lands exactly in target bounds and reverses without accumulating drift',()=>{
 const source={x:30,y:180,width:300,height:300},target={x:210,y:160,width:140,height:140};
 assert.deepEqual(seasonalFrame(source,target,-10),{...source,progress:0});
 assert.deepEqual(seasonalFrame(source,target,1),{...target,progress:1});
 assert.deepEqual(seasonalFrame(source,target,4),{...target,progress:1});
 const middle=seasonalFrame(source,target,.5);
 assert.equal(middle.x,210); assert.equal(middle.width,140);
 assert.deepEqual(seasonalFrame(source,target,0),{...source,progress:0});
});
test('image reaches its own column before it descends through product text',()=>{
 const source={x:40,y:80,width:290,height:320},target={x:210,y:240,width:140,height:154.48};
 for(const progress of [.22,.3,.4,.6,.8,1]){
  const frame=seasonalFrame(source,target,progress);
  assert.equal(frame.x,target.x);
  assert.equal(frame.width,target.width);
 }
});
