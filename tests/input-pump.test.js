import {test} from 'node:test';import assert from 'node:assert/strict';
test('network inputs keep flowing when no render frames advance',async()=>{
 const {InputPump}=await import('../src/multiplayer/input-pump.js');const messages=[];let parked=false,pump;
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{pump?.stop();reject(Error('input heartbeat stalled'));},2000);pump=new InputPump(()=>({parked,controls:{throttle:.5}}),m=>{messages.push(m);if(messages.length===1)parked=true;if(messages.length===3){clearTimeout(timeout);pump.stop();resolve();}},20);});
 assert.deepEqual(messages.map(m=>m.seq),[0,1,2]);assert.equal(messages[0].parked,false);assert.equal(messages[1].parked,true);
});
