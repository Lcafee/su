import test from 'node:test';
import assert from 'node:assert/strict';
import { findSeasonalProduct, seasonalFrame, keepSeasonalIntro, seasonalDetailsOpacity } from '../src/menu/seasonalFeature.mjs';

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
 assert.equal(middle.x,120); assert.equal(middle.width,220);
 assert.deepEqual(seasonalFrame(source,target,0),{...source,progress:0});
});
test('scale changes throughout the journey instead of collapsing in its first fifth',()=>{
 const source={x:60,y:12,width:270,height:295.457},target={x:202,y:360,width:172,height:188.246};
 let previous=source.width;
 for(let step=1;step<=100;step++){
  const frame=seasonalFrame(source,target,step/100);
  assert.ok(frame.width<previous);
  previous=frame.width;
 }
 assert.ok(seasonalFrame(source,target,.22).width>source.width*.9);
 assert.ok(seasonalFrame(source,target,.75).width>target.width);
});
test('viewport center never reverses during downward scroll and the copy reveals only after clearance',()=>{
 const source={x:60.45,y:12,width:269.1,height:294.47};
 const target={x:202.18,y:360.77,width:172.22,height:188.45};
 let previous=source.y+source.height/2;
 for(let step=1;step<=360;step++){
  const p=step/360, frame=seasonalFrame(source,target,p,360);
  const center=frame.y+frame.height/2-step;
  assert.ok(center<=previous+1e-6);
  previous=center;
  if(seasonalDetailsOpacity(p)>0) assert.ok(frame.x>=186.2);
 }
 assert.equal(seasonalDetailsOpacity(0),0);
 assert.equal(seasonalDetailsOpacity(.8),0);
 assert.equal(seasonalDetailsOpacity(1),1);
});
